'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { Property } from '@/types'; // shared app type

// ────────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────────
type ChatRole = 'user' | 'assistant';

interface Message {
  role: ChatRole;
  content: string;
}

interface AIChatbotProps {
  /** Accepts partial to avoid strict shape mismatches across files */
  property?: Partial<Property> | null;
  /** Optional: start open for debugging */
  defaultOpen?: boolean;
}

// ────────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────────
export default function AIChatbot({ property, defaultOpen = false }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        "Hi! I'm your AI Investment Assistant. Ask me anything about this deal.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  // Derived context for nicer quick prompts
  const dealLabel = useMemo(() => {
    const parts = [
      property?.title,
      property?.location,
      property?.price ? `£${Number(property.price).toLocaleString()}` : undefined,
    ].filter(Boolean);
    return parts.join(' · ');
  }, [property?.title, property?.location, property?.price]);

  const quickPrompts = useMemo(
    () =>
      [
        property?.yield_percent != null
          ? `Is a ${property.yield_percent}% yield strong for this area?`
          : 'Is this a good investment?',
        'Suggest exit strategies',
        'What are the key risks here?',
        property?.roi_percent != null
          ? `How realistic is an ROI of ${property.roi_percent}%?`
          : 'Help me sanity‑check the ROI.',
      ].filter(Boolean) as string[],
    [property?.yield_percent, property?.roi_percent]
  );

  // Autoscroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulated AI reply — replace with your backend later
    const hints: string[] = [];
    if (property?.yield_percent != null) hints.push(`yield ≈ ${property.yield_percent}%`);
    if (property?.roi_percent != null) hints.push(`ROI ≈ ${property.roi_percent}%`);
    if (property?.avg_rent != null) hints.push(`avg rent ≈ £${Number(property.avg_rent).toLocaleString()}`);

    setTimeout(() => {
      const botMsg: Message = {
        role: 'assistant',
        content:
          `🤖 Quick take on ${dealLabel || 'this deal'}:\n` +
          `• Based on ${hints.length ? hints.join(', ') : 'the inputs'}, it could be viable. ` +
          `\n• Validate finance terms, stress interest rates, and check area demand.\n• Next steps: request comps within 0.5–1.0 mile and confirm works scope.`,
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 650);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    // send next tick so the input state updates first
    setTimeout(() => handleSend(), 0);
  };

  // Tailwind note: avoid dynamic class names like text-${...}
  const bubbleBase =
    'inline-block px-3 py-2 rounded-xl max-w-[80%] whitespace-pre-line leading-relaxed';
  const bubbleUser = 'bg-blue-600 text-white';
  const bubbleBot = 'bg-gray-200 text-gray-800 dark:bg-neutral-800 dark:text-neutral-100';

  return (
    <div className="fixed bottom-5 right-5 z-[9999] print:hidden">
      {/* Toggle Button */}
      {!isOpen ? (
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white font-semibold px-5 py-3 rounded-full shadow-md hover:bg-blue-700 transition focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Open AI Assistant"
        >
          💬 Ask AI
        </button>
      ) : (
        <div className="w-80 h-[440px] bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 dark:bg-neutral-800 text-white px-3 py-2 flex justify-between items-center text-sm font-semibold">
            <span className="truncate" title={dealLabel || 'AI Assistant'}>
              {dealLabel || 'AI Assistant'}
            </span>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Close chat"
              className="text-white/90 text-xl leading-none hover:text-white focus:outline-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 dark:bg-neutral-950/40 text-sm">
            {messages.map((msg, i) => {
              const isUser = msg.role === 'user';
              return (
                <div key={i} className={`mb-2 ${isUser ? 'text-right' : 'text-left'}`}>
                  <span className={`${bubbleBase} ${isUser ? bubbleUser : bubbleBot}`}>
                    {msg.content}
                  </span>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="bg-slate-100 dark:bg-neutral-800/60 px-2 py-1 flex flex-wrap gap-2 justify-center">
            {quickPrompts.map((text) => (
              <button
                key={text}
                type="button"
                onClick={() => handleQuickPrompt(text)}
                className="bg-blue-100 text-blue-900 dark:bg-blue-900/30 dark:text-blue-200 text-[11px] rounded-full px-3 py-1 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition"
              >
                {text}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-2 border-t border-gray-200 dark:border-neutral-800 flex gap-2 bg-white dark:bg-neutral-900">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a question…"
              className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-neutral-700 rounded-md outline-none bg-white dark:bg-neutral-900 text-gray-900 dark:text-neutral-100"
              aria-label="Chat message"
            />
            <button
              type="button"
              onClick={handleSend}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
