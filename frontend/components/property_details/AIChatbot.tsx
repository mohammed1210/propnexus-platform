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
      content:
        "Hi! I'm your AI Investment Assistant. Ask me anything about this deal.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim()) return;
    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Lightweight, local “AI” reply with quick contextual hints
    const hints: string[] = [];
    if (property?.yield_percent != null) hints.push(`yield ≈ ${property.yield_percent}%`);
    if (property?.roi_percent != null) hints.push(`ROI ≈ ${property.roi_percent}%`);

    setTimeout(() => {
      const botMsg: Message = {
        role: 'assistant',
        content: hints.length
          ? `🤖 Quick take: ${hints.join(' · ')}. Also check product fees, refi assumptions and local demand.`
          : '🤖 Share price, yield, ROI or postcode and I can give a sharper take.',
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 600);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(handleSend, 50);
  };

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="fixed bottom-5 right-5 z-[9999]">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="bg-blue-600 text-white font-semibold px-5 py-3 rounded-full shadow-md hover:bg-blue-700 transition"
        >
          💬 Ask AI
        </button>
      ) : (
        <div className="w-80 h-[420px] bg-white rounded-xl shadow-lg border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center text-sm font-semibold">
            AI Assistant
            <button
              onClick={() => setIsOpen(false)}
              className="text-white text-xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 text-sm">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`mb-2 ${msg.role === 'user' ? 'text-right' : 'text-left'}`}
              >
                <span
                  className={`inline-block px-3 py-2 rounded-xl max-w-[80%] ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800'
                  }`}
                >
                  {msg.content}
                </span>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Quick Prompts */}
          <div className="bg-slate-100 px-2 py-1 flex flex-wrap gap-2 justify-center">
            {['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'].map(
              (text) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  className="bg-blue-100 text-blue-800 text-xs rounded-full px-3 py-1 hover:bg-blue-200 transition"
                >
                  {text}
                </button>
              )
            )}
          </div>

          {/* Input */}
          <div className="p-2 border-t flex gap-2 bg-white">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Type a question..."
              className="flex-1 px-3 py-2 text-sm border rounded-md outline-none"
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
