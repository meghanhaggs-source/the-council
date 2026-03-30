import { useState, useEffect, useCallback, useRef } from 'react';

const API = import.meta.env.DEV ? 'http://localhost:3001' : '';

async function loadMessages(name) {
  try {
    const res = await fetch(`${API}/api/conversations?advisor=${encodeURIComponent(name)}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(({ role, content }) => ({ role, content }));
  } catch {
    return [];
  }
}

async function saveMessage(advisorName, role, content) {
  try {
    await fetch(`${API}/api/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ advisor_name: advisorName, role, content }),
    });
  } catch (err) {
    console.error('Failed to persist message:', err);
  }
}

async function loadMemos() {
  try {
    const res = await fetch(`${API}/api/memos`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

function buildContentBlocks(text, attachments) {
  if (!attachments || attachments.length === 0) return text;

  const blocks = [];

  for (const file of attachments) {
    if (file.mediaType === 'application/pdf') {
      blocks.push({
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: file.data },
      });
    } else {
      blocks.push({
        type: 'image',
        source: { type: 'base64', media_type: file.mediaType, data: file.data },
      });
    }
  }

  if (text.trim()) {
    blocks.push({ type: 'text', text });
  }

  return blocks;
}

function buildSystemWithMemos(baseSystem, memos) {
  const docInstructions = `

DOCUMENT CREATION: When Meghan asks you to create a document, plan, report, brief, or any formal written deliverable, wrap the document content in [COUNCIL_DOC: Title Here]...[/COUNCIL_DOC] markers. When she asks for a spreadsheet, budget, tracker, or tabular data, wrap it in [COUNCIL_SHEET: Title Here]...[/COUNCIL_SHEET] markers using tab-separated values (tabs between columns, newlines between rows). Always include a brief conversational message outside the markers explaining what you created. The markers trigger a Save to Google Drive button automatically.`;

  let system = baseSystem + docInstructions;

  if (memos && memos.length > 0) {
    const memoBlock = memos.map((m) => m.content).join('\n\n---\n\n');
    system += `\n\nCOUNCIL BRIEFINGS — read these before responding:\n${memoBlock}`;
  }

  return system;
}

export default function useChat(advisor) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [briefing, setBriefing] = useState(false);
  const [memos, setMemos] = useState([]);
  const hasGreeted = useRef(false);

  useEffect(() => {
    if (!advisor) return;
    let cancelled = false;

    async function init() {
      const [stored, allMemos] = await Promise.all([
        loadMessages(advisor.name),
        loadMemos(),
      ]);
      if (cancelled) return;
      setMessages(stored);
      setMemos(allMemos);

      if (stored.length === 0 && !hasGreeted.current) {
        hasGreeted.current = true;
        const system = buildSystemWithMemos(advisor.system, allMemos);
        fetchReply(advisor, [{ role: 'user', content: 'We are meeting for the first time. Greet me briefly — introduce yourself and what you bring to the council. Keep it to 2-3 sentences.' }], true, system);
      }
    }

    init();

    return () => {
      cancelled = true;
      hasGreeted.current = false;
    };
  }, [advisor?.name]);

  async function fetchReply(adv, apiMessages, isGreeting = false, systemOverride = null) {
    setLoading(true);
    try {
      const system = systemOverride || buildSystemWithMemos(adv.system, memos);

      const res = await fetch(`${API}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4096,
          system,
          messages: apiMessages,
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new Error(`API ${res.status}: ${err}`);
      }

      const data = await res.json();
      const text = data.content?.[0]?.text || "I'm here.";

      await saveMessage(adv.name, 'assistant', text);

      setMessages((prev) => [...prev, { role: 'assistant', content: text }]);
    } catch (err) {
      console.error('Council API error:', err);
      const errorMsg = `*connection interrupted — ${err.message}*`;
      setMessages((prev) => [...prev, { role: 'assistant', content: errorMsg }]);
    } finally {
      setLoading(false);
    }
  }

  const send = useCallback(
    async (text, attachments) => {
      if (!advisor || loading) return;
      if (!text.trim() && (!attachments || attachments.length === 0)) return;

      const fileLabels = (attachments || []).map((f) => `[${f.name}]`).join(' ');
      const displayText = [fileLabels, text.trim()].filter(Boolean).join(' ');

      const userMsg = { role: 'user', content: displayText };
      const updated = [...messages, userMsg];
      setMessages(updated);

      await saveMessage(advisor.name, 'user', displayText);

      const apiMessages = updated.slice(0, -1).map((m) => ({ role: m.role, content: m.content }));

      const content = buildContentBlocks(text.trim() || 'Please review the attached file.', attachments);
      apiMessages.push({ role: 'user', content });

      if (updated[0]?.role === 'assistant') {
        apiMessages.unshift({
          role: 'user',
          content: 'We are meeting for the first time. Greet me briefly — introduce yourself and what you bring to the council. Keep it to 2-3 sentences.',
        });
      }

      fetchReply(advisor, apiMessages);
    },
    [advisor, messages, loading, memos]
  );

  const briefTheCouncil = useCallback(async () => {
    if (!advisor || messages.length < 4) return;
    setBriefing(true);

    try {
      const transcript = messages
        .map((m) => `${m.role === 'user' ? 'Meghan' : advisor.name}: ${m.content}`)
        .join('\n\n');

      const res = await fetch(`${API}/api/brief`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ advisor_name: advisor.name, conversation: transcript }),
      });

      if (!res.ok) throw new Error('Failed to generate memo');

      const memo = await res.json();
      setMemos((prev) => [...prev, memo]);
      return true;
    } catch (err) {
      console.error('Briefing error:', err);
      return false;
    } finally {
      setBriefing(false);
    }
  }, [advisor, messages]);

  const clearHistory = useCallback(async () => {
    if (!advisor) return;
    try {
      await fetch(`${API}/api/conversations?advisor=${encodeURIComponent(advisor.name)}`, { method: 'DELETE' });
    } catch (err) {
      console.error('Failed to clear history:', err);
    }
    setMessages([]);
  }, [advisor]);

  return { messages, loading, send, clearHistory, briefTheCouncil, briefing };
}
