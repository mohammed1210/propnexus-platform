'use client';

import { useEffect, useRef, useState } from 'react';
import type { Property } from '@/types';

/** Allow latitude/longitude and a few fields to be null (as your DB may return) */
type LooseProperty = Property & {
  latitude?: number | null;
  longitude?: number | null;
  avg_rent?: number | null;
  crime_index?: number | null;
  ofsted_summary?: string | null;
  transport_summary?: string | null;
};

type Message = { role: 'user' | 'assistant'; content: string };

interface AIChatbotProps {
  /** optional + loose to avoid strict shape issues when some fields are null/undefined */
  property?: Partial<LooseProperty>;
}

export default function AIChatbot({ property }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Investment Assistant. Ask me anything about this deal.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const sendLocalReply = (prompt: string) => {
    const hints: string[] = [];
    if (typeof property?.yield_percent === 'number') hints.push(`yield ≈ ${property.yield_percent}%`);
    if (typeof property?.roi_percent === 'number') hints.push(`ROI ≈ ${property.roi_percent}%`);
    if (typeof property?.price === 'number') hints.push(`price ≈ £${property.price.toLocaleString()}`);

    const base =
      hints.length > 0
        ? `🤖 Quick take: ${hints.join(' · ')}. Sense-check product fees, refi assumptions and local demand.`
        : '🤖 Share price, yield, ROI or postcode and I can give a sharper take.';

    // Very tiny heuristics
    const lower = prompt.toLowerCase();
    if (lower.includes('risk')) {
      return `${base} Key risks: down-valuation, refurb overrun, and void periods. Add contingency and model DSCR ≥ 1.25×.`;
    }
    if (lower.includes('exit')) {
      return `${base} Consider: let & refinance (BRRR), flip at GDV, or leave as vanilla BTL.`;
    }
    if (lower.includes('good') || lower.includes('invest')) {
      return `${base} Run both GDV and BRRR paths in the calculator and compare cash left in the deal.`;
    }
    return base;
  };

  const handleSend = () => {
    const text = input.trim();
    if (!text) return;
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => prev.concat(userMsg));
    setInput('');

    // Local simulated reply
    const reply = sendLocalReply(text);
    setTimeout(() => {
      setMessages((prev) =>
        prev.concat({
          role: 'assistant',
          content: reply,
        })
      );
    }, 500);
  };

  const handleQuickPrompt = (prompt: string) => {
    const userMsg: Message = { role: 'user', content: prompt };
    setMessages((prev) => prev.concat(userMsg));
    const reply = sendLocalReply(prompt);
    setTimeout(() => {
      setMessages((prev) => prev.concat({ role: 'assistant', content: reply }));
    }, 400);
  };

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Keep chat log bounded
  useEffect(() => {
    setMessages((prev) => (prev.length > 60 ? prev.slice(-60) : prev));
  }, [messages.length]);

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white font-semibold px-5 py-3 rounded-full shadow-md hover:bg-blue-700 transition"
          aria-label="Open AI assistant"
        >
          💬 Ask AI
        </button>
      ) : (
        <div
          className="w-80 h-[420px] bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="false"
          aria-label="AI Assistant"
        >
          {/* Header */}
          <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center text-sm font-semibold">
            AI Assistant
            <button
              onClick={() => setIsOpen(false)}
              className="text-white text-xl leading-none"
              aria-label="Close"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 dark:bg-neutral-950 text-sm">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}>
                <span
                  className={`inline-block px-3 py-2 rounded-xl max-w-[80%] break-words ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 dark:bg-neutral-800 dark:text-neutral-100'
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="bg-slate-100 dark:bg-neutral-900 px-2 py-1 flex flex-wrap gap-2 justify-center">
            {['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'].map((text) => (
              <button
                key={text}
                onClick={() => handleQuickPrompt(text)}
                className="bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-neutral-200 text-xs rounded-full px-3 py-1 hover:bg-blue-200 dark:hover:bg-neutral-700 transition"
              >
                {text}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-neutral-200 dark:border-neutral-800 flex gap-2 bg-white dark:bg-neutral-900">
            <label className="sr-only" htmlFor="ai-chat-input">Message</label>
            <input
              id="ai-chat-input"
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a question..."
              className="flex-1 px-3 py-2 text-sm border rounded-md outline-none bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700"
            />
            <button
              onClick={handleSend}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
