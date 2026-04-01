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

async function loadTransits() {
  try {
    const res = await fetch(`${API}/api/astro`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.report;
  } catch {
    return null;
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

function buildSystemWithMemos(baseSystem, memos, transits = null) {
  const docInstructions = `

DOCUMENT CREATION GUIDELINES:

When Meghan asks you to create a document, plan, report, brief, or any formal written deliverable, wrap the document content in [COUNCIL_DOC: Title Here]...[/COUNCIL_DOC] markers.

When she asks for a spreadsheet, budget, tracker, or tabular data, wrap it in [COUNCIL_SHEET: Title Here]...[/COUNCIL_SHEET] markers using tab-separated values (tabs between columns, newlines between rows).

Always include a brief conversational message OUTSIDE the markers explaining what you created. The markers trigger a Save to Google Drive button automatically.

DOCUMENT FORMATTING STANDARDS — follow these for every document:

1. TITLE: Start with the document title in all caps, followed by a blank line.
2. METADATA: Include a line with your name, role, and today's date. Example: Prepared by Vivienne | The Strategist | April 1, 2026
3. EXECUTIVE SUMMARY: If the document is longer than one page, begin with a 2-3 sentence summary of the key takeaway.
4. SECTIONS: Use clear section headers in all caps followed by a blank line. Number major sections (1. OVERVIEW, 2. ANALYSIS, etc.)
5. SUBSECTIONS: Use title case with a dash prefix for subsections (- Key Findings, - Next Steps).
6. ACTION ITEMS: When recommending actions, format them as a numbered list with owners and deadlines where applicable.
7. BULLET POINTS: Use dashes (-) not asterisks for bullet lists.
8. TONE: Write in a professional but warm tone consistent with your advisor personality. This is a council document, not a generic report.
9. LENGTH: Be thorough but not padded. Every sentence should earn its place.
10. CLOSING: End with a clear NEXT STEPS or RECOMMENDATION section.

For SPREADSHEETS: Use a clear header row, consistent data types per column, and include a NOTES row at the bottom if context is needed. Separate columns with tabs, rows with newlines.

These are Council documents for Meghan Gallagher. They should feel like they came from a real advisory team, not a chatbot.`;

  let system = baseSystem + docInstructions;

  if (transits) {
    system += `\n\nLIVE ASTROLOGICAL DATA — Use this real-time transit data in your readings. This is calculated via Swiss Ephemeris with astronomical precision. Reference these positions naturally in conversation — do not dump the raw data. Weave it into your observations the way you would after glancing at an ephemeris before a session.\n\n${transits}`;
  }

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
  const [transits, setTransits] = useState(null);
  const hasGreeted = useRef(false);

  useEffect(() => {
    if (!advisor) return;
    let cancelled = false;

    async function init() {
      const isPriya = advisor.name === 'Priya';

      const [stored, allMemos, transitData] = await Promise.all([
        loadMessages(advisor.name),
        loadMemos(),
        isPriya ? loadTransits() : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setMessages(stored);
      setMemos(allMemos);
      setTransits(transitData);

      if (stored.length === 0 && !hasGreeted.current) {
        hasGreeted.current = true;
        const system = buildSystemWithMemos(advisor.system, allMemos, transitData);
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
      const system = systemOverride || buildSystemWithMemos(adv.system, memos, transits);

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
    [advisor, messages, loading, memos, transits]
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
