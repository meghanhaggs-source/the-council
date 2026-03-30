import { useState, useRef, useEffect, useCallback } from 'react';
import useChat from '../hooks/useChat';
import './SessionPanel.css';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

const ACCEPTED_TYPES = {
  'application/pdf': 'application/pdf',
  'image/jpeg': 'image/jpeg',
  'image/png': 'image/png',
  'image/jpg': 'image/jpeg',
};

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Parse document markers from message ──
function parseDocument(text) {
  const match = text.match(/\[COUNCIL_DOC:\s*(.+?)\]([\s\S]*?)\[\/COUNCIL_DOC\]/);
  if (!match) return null;
  return { title: match[1].trim(), content: match[2].trim() };
}

function parseSheet(text) {
  const match = text.match(/\[COUNCIL_SHEET:\s*(.+?)\]([\s\S]*?)\[\/COUNCIL_SHEET\]/);
  if (!match) return null;
  return { title: match[1].trim(), content: match[2].trim() };
}

function stripDocMarkers(text) {
  return text
    .replace(/\[COUNCIL_DOC:\s*.+?\][\s\S]*?\[\/COUNCIL_DOC\]/, '')
    .replace(/\[COUNCIL_SHEET:\s*.+?\][\s\S]*?\[\/COUNCIL_SHEET\]/, '')
    .trim();
}

// ── Speech-to-text hook ──
function useSpeechToText(onTranscript) {
  const recogRef = useRef(null);
  const [listening, setListening] = useState(false);
  const callbackRef = useRef(onTranscript);
  callbackRef.current = onTranscript;

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recog = new SpeechRecognition();
    recog.continuous = true;
    recog.interimResults = true;
    recog.lang = 'en-US';

    recog.onresult = (e) => {
      let transcript = '';
      for (let i = 0; i < e.results.length; i++) {
        transcript += e.results[i][0].transcript;
      }
      callbackRef.current?.(transcript);
    };

    recog.onend = () => setListening(false);
    recog.onerror = () => setListening(false);

    recogRef.current = recog;
    return () => recog.abort();
  }, []);

  const toggle = useCallback(() => {
    const recog = recogRef.current;
    if (!recog) return;

    if (listening) {
      recog.stop();
    } else {
      recog.start();
      setListening(true);
    }
  }, [listening]);

  const stop = useCallback(() => {
    if (recogRef.current && listening) {
      recogRef.current.stop();
    }
  }, [listening]);

  return {
    listening,
    toggle,
    stop,
    supported: typeof (window.SpeechRecognition || window.webkitSpeechRecognition) !== 'undefined',
  };
}

export default function SessionPanel({ advisor, onClose }) {
  const { messages, loading, send, briefTheCouncil, briefing } = useChat(advisor);
  const [input, setInput] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [toast, setToast] = useState(null);
  const [speaking, setSpeaking] = useState(false);
  const [speakingIdx, setSpeakingIdx] = useState(null);
  const [savingDoc, setSavingDoc] = useState(null);
  const [driveConnected, setDriveConnected] = useState(false);
  const messagesEnd = useRef(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const audioRef = useRef(null);

  const canUpload = true;
  const canBrief = messages.length >= 4;
  const locked = speaking || loading;

  const stt = useSpeechToText((transcript) => setInput(transcript));

  // Check Google Drive connection status
  useEffect(() => {
    fetch(`${API}/api/google/status`)
      .then((r) => r.json())
      .then((d) => setDriveConnected(d.connected))
      .catch(() => setDriveConnected(false));
  }, []);

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setSpeaking(false);
    setSpeakingIdx(null);
  }

  // ── Save to Google Drive ──
  async function saveToGDrive(doc, type = 'doc') {
    if (!driveConnected) {
      window.open(`${API}/api/google/auth`, '_blank');
      return;
    }

    setSavingDoc(doc.title);
    try {
      const res = await fetch(`${API}/api/google/create-doc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: doc.title,
          content: doc.content,
          advisorName: advisor.name,
          type,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to save');
      }

      const result = await res.json();
      window.open(result.url, '_blank');
      setToast('sent');
    } catch (err) {
      console.error('Google Drive save error:', err);
      setToast('error');
    } finally {
      setSavingDoc(null);
    }
  }

  async function playMessage(text, msgIndex) {
    if (!advisor?.voiceId) return;

    stopAudio();
    setSpeaking(true);
    setSpeakingIdx(msgIndex);

    try {
      const res = await fetch(`${API}/api/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voiceId: advisor.voiceId }),
      });

      if (!res.ok) {
        stopAudio();
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeaking(false);
        setSpeakingIdx(null);
      };
      audio.onerror = () => {
        URL.revokeObjectURL(url);
        audioRef.current = null;
        setSpeaking(false);
        setSpeakingIdx(null);
      };

      audio.play().catch(() => {
        setSpeaking(false);
        setSpeakingIdx(null);
      });
    } catch (err) {
      console.error('[TTS] Error:', err.message);
      setSpeaking(false);
      setSpeakingIdx(null);
    }
  }

  useEffect(() => {
    return () => stopAudio();
  }, [advisor?.name]);

  useEffect(() => {
    messagesEnd.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [advisor?.name]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleFileChange(e) {
    const files = Array.from(e.target.files);
    const newAttachments = [];

    for (const file of files) {
      const mediaType = ACCEPTED_TYPES[file.type];
      if (!mediaType) continue;

      const data = await fileToBase64(file);
      newAttachments.push({ name: file.name, mediaType, data });
    }

    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = '';
  }

  function removeAttachment(index) {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (locked) return;
    if (!input.trim() && attachments.length === 0) return;
    if (stt.listening) stt.stop();
    send(input, attachments.length > 0 ? attachments : undefined);
    setInput('');
    setAttachments([]);
  }

  async function handleBrief() {
    const success = await briefTheCouncil();
    setToast(success ? 'sent' : 'error');
  }

  if (!advisor) return null;

  return (
    <div className="session-overlay" onClick={onClose}>
      <div
        className="session-panel"
        style={{ '--accent': advisor.color }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="session-header">
          <div className="session-identity">
            <div className={`session-avatar-ring${speaking ? ' session-avatar-speaking' : ''}`}>
              <img src={advisor.avatar} alt={advisor.name} className="session-avatar" />
            </div>
            <div className="session-info">
              <h2 className="session-name">{advisor.name}</h2>
              <p className="session-role">{advisor.role}</p>
            </div>
          </div>
          <div className="session-header-actions">
            {canBrief && (
              <button
                className="brief-btn"
                onClick={handleBrief}
                disabled={briefing || locked}
                title="Brief the Council"
              >
                {briefing ? (
                  <span className="brief-spinner" />
                ) : (
                  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                    <path d="M3 3h12v2H3zM3 7h12v2H3zM3 11h8v2H3z" fill="currentColor" />
                    <path d="M13 11l2 2-2 2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <span className="brief-label">Brief the Council</span>
              </button>
            )}
            <button className="session-close" onClick={onClose} aria-label="Close session">
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
                <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        </header>

        {/* Toast */}
        {toast && (
          <div className={`briefing-toast ${toast}`}>
            {toast === 'sent'
              ? 'Saved to Google Drive'
              : 'Failed — try again'}
          </div>
        )}

        {/* Messages */}
        <div className="session-messages">
          {messages.map((msg, i) => {
            const doc = msg.role === 'assistant' ? parseDocument(msg.content) : null;
            const sheet = msg.role === 'assistant' ? parseSheet(msg.content) : null;
            const displayText = doc || sheet ? stripDocMarkers(msg.content) : msg.content;

            return (
              <div key={i} className={`message message-${msg.role}`}>
                {msg.role === 'assistant' && (
                  <div className="message-avatar-small">
                    <img src={advisor.avatar} alt="" />
                  </div>
                )}
                <div className="message-bubble">
                  {displayText}
                  {doc && (
                    <button
                      className="gdrive-btn"
                      onClick={() => saveToGDrive(doc, 'doc')}
                      disabled={savingDoc === doc.title}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M5.5 1L1 8.5l2.5 4h9l2.5-4L10.5 1h-5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" />
                        <path d="M1 8.5h14" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M10.5 1L6 8.5" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      <span>{savingDoc === doc.title ? 'Saving...' : `Save to Drive: ${doc.title}`}</span>
                    </button>
                  )}
                  {sheet && (
                    <button
                      className="gdrive-btn gdrive-btn--sheet"
                      onClick={() => saveToGDrive(sheet, 'sheet')}
                      disabled={savingDoc === sheet.title}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <rect x="1.5" y="2" width="13" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
                        <path d="M1.5 6h13M1.5 10h13M6 2v12" stroke="currentColor" strokeWidth="1.2" />
                      </svg>
                      <span>{savingDoc === sheet.title ? 'Saving...' : `Save Sheet: ${sheet.title}`}</span>
                    </button>
                  )}
                </div>
                {msg.role === 'assistant' && advisor.voiceId && (
                  <button
                    className={`msg-play-btn${speakingIdx === i ? ' msg-play-btn--active' : ''}`}
                    onClick={() => speakingIdx === i ? stopAudio() : playMessage(displayText, i)}
                    aria-label={speakingIdx === i ? 'Stop' : 'Play message'}
                  >
                    {speakingIdx === i ? (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
                      </svg>
                    ) : (
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <path d="M3 1.5v11l9.5-5.5z" fill="currentColor" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            );
          })}
          {loading && (
            <div className="message message-assistant">
              <div className="message-avatar-small">
                <img src={advisor.avatar} alt="" />
              </div>
              <div className="message-bubble typing">
                <span /><span /><span />
              </div>
            </div>
          )}
          <div ref={messagesEnd} />
        </div>

        {/* Attachment preview chips */}
        {attachments.length > 0 && (
          <div className="attachment-bar">
            {attachments.map((file, i) => (
              <div key={i} className="attachment-chip">
                <span className="attachment-icon">
                  {file.mediaType === 'application/pdf' ? '📄' : '🖼'}
                </span>
                <span className="attachment-name">{file.name}</span>
                <button className="attachment-remove" onClick={() => removeAttachment(i)} aria-label="Remove file">×</button>
              </div>
            ))}
          </div>
        )}

        {/* Speaking indicator + stop button */}
        {speaking && (
          <div className="speaking-bar">
            <span className="speaking-label">{advisor.name} is speaking...</span>
            <button className="stop-btn" onClick={stopAudio} aria-label="Stop speaking">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <rect x="2" y="2" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
              <span>Stop</span>
            </button>
          </div>
        )}

        {/* Input */}
        <form className="session-input" onSubmit={handleSubmit}>
          {canUpload && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                multiple
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <button
                type="button"
                className="upload-btn"
                onClick={() => fileRef.current?.click()}
                disabled={locked}
                aria-label="Attach file"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M15.5 8.5l-6.4 6.4a4 4 0 01-5.6-5.7l6.3-6.3a2.7 2.7 0 013.8 3.8L7.3 13a1.3 1.3 0 01-1.9-1.9l5.7-5.6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </>
          )}
          {stt.supported && (
            <button
              type="button"
              className={`mic-btn${stt.listening ? ' mic-btn--active' : ''}`}
              onClick={stt.toggle}
              disabled={locked}
              aria-label={stt.listening ? 'Stop listening' : 'Start listening'}
            >
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <rect x="6.5" y="1.5" width="5" height="9" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
                <path d="M3.5 8.5a5.5 5.5 0 0011 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
                <path d="M9 14.5v2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              </svg>
            </button>
          )}
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={stt.listening ? 'Listening...' : speaking ? `${advisor.name} is speaking...` : `Speak with ${advisor.name}...`}
            disabled={locked}
          />
          <button type="submit" disabled={locked || (!input.trim() && attachments.length === 0)} aria-label="Send message">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M2 9h14M10 3l6 6-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
