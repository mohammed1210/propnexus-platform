// frontend/components/ai/AIChatbot.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { Property } from '@/types';
import { postAIChat } from '@/lib/api';

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
  property?: Partial<LooseProperty>;
}

const STORAGE_KEY_PREFIX = 'pn_chat_history_';
const FEATURE_AI_CHATBOT = process.env.NEXT_PUBLIC_FEATURE_AI_CHATBOT === 'true';

export default function AIChatbot({ property }: AIChatbotProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: "Hi! I'm your AI Investment Assistant. Ask me anything about this deal.",
    },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const propertyId = property?.id || 'default';

  // Load conversation history from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const storageKey = STORAGE_KEY_PREFIX + propertyId;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
        }
      } catch (e) {
        // Ignore parse errors
      }
    }
  }, [propertyId]);

  // Save conversation history to localStorage whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length <= 1) return;
    const storageKey = STORAGE_KEY_PREFIX + propertyId;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, propertyId]);

  const sendLocalReply = (prompt: string) => {
    const hints: string[] = [];
    if (typeof property?.yield_percent === 'number')
      hints.push(`yield ≈ ${property.yield_percent}%`);
    if (typeof property?.roi_percent === 'number') hints.push(`ROI ≈ ${property.roi_percent}%`);
    if (typeof property?.price === 'number')
      hints.push(`price ≈ £${property.price.toLocaleString()}`);

    const base =
      hints.length > 0
        ? `🤖 Quick take: ${hints.join(' · ')}. Sense-check product fees, refi assumptions and local demand.`
        : '🤖 Share price, yield, ROI or postcode and I can give a sharper take.';

    const lower = prompt.toLowerCase();
    if (lower.includes('risk'))
      return `${base} Key risks: down-valuation, refurb overrun, and void periods. Add contingency and model DSCR ≥ 1.25×.`;
    if (lower.includes('exit'))
      return `${base} Consider: let & refinance (BRRR), flip at GDV, or leave as vanilla BTL.`;
    if (lower.includes('good') || lower.includes('invest'))
      return `${base} Run both GDV and BRRR paths in the calculator and compare cash left in the deal.`;
    return base;
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    
    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => prev.concat(userMessage));
    setInput('');
    setError(null);

    // If AI chatbot feature is disabled or no backend key, use local reply
    if (!FEATURE_AI_CHATBOT) {
      const reply = sendLocalReply(text);
      setTimeout(() => setMessages((p) => p.concat({ role: 'assistant', content: reply })), 500);
      return;
    }

    // Use real GPT backend
    setIsLoading(true);
    try {
      const context = {
        property_id: propertyId,
        summary: property?.title || '',
        area_key: property?.location || '',
        postcode: property?.location || '',
      };

      // Send only user messages to backend (exclude initial greeting)
      const conversationMessages = messages
        .filter((m) => m.role === 'user' || (m.role === 'assistant' && m.content !== messages[0].content))
        .concat(userMessage);

      const response = await postAIChat({
        messages: conversationMessages,
        context,
      });

      if (response.ok && response.reply) {
        setMessages((p) => p.concat({ role: 'assistant', content: response.reply }));
      } else {
        throw new Error('Invalid response from AI service');
      }
    } catch (err: any) {
      console.error('AI chat error:', err);
      setError('Sorry, I encountered an error. Please try again.');
      // Fallback to local reply
      const reply = sendLocalReply(text);
      setMessages((p) => p.concat({ role: 'assistant', content: reply }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    // Trigger send after a brief delay to show the prompt in input
    setTimeout(() => handleSend(), 100);
  };

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);
  useEffect(() => setMessages((p) => (p.length > 60 ? p.slice(-60) : p)), [messages.length]);

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

          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 dark:bg-neutral-950 text-sm">
            {messages.map((m, i) => (
              <div key={i} className={`mb-2 ${m.role === 'user' ? 'text-right' : 'text-left'}`}>
                <span
                  className={`inline-block px-3 py-2 rounded-xl max-w-[80%] break-words ${
                    m.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-200 text-gray-800 dark:bg-neutral-800 dark:text-neutral-100'
                  }`}
                >
                  {m.content}
                </span>
              </div>
            ))}
            {isLoading && (
              <div className="text-left mb-2">
                <span className="inline-block px-3 py-2 rounded-xl bg-gray-200 text-gray-800 dark:bg-neutral-800 dark:text-neutral-100">
                  <span className="animate-pulse">Thinking...</span>
                </span>
              </div>
            )}
            {error && (
              <div className="text-center mb-2">
                <span className="text-xs text-red-600 dark:text-red-400">{error}</span>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="bg-slate-100 dark:bg-neutral-900 px-2 py-1 flex flex-wrap gap-2 justify-center">
            {['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'].map((t) => (
              <button
                key={t}
                onClick={() => handleQuickPrompt(t)}
                className="bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-neutral-200 text-xs rounded-full px-3 py-1 hover:bg-blue-200 dark:hover:bg-neutral-700 transition"
              >
                {t}
              </button>
            ))}
          </div>

          <div className="p-2 border-t border-neutral-200 dark:border-neutral-800 flex gap-2 bg-white dark:bg-neutral-900">
            <label className="sr-only" htmlFor="ai-chat-input">
              Message
            </label>
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
              disabled={isLoading}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
