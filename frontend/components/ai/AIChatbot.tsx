// frontend/components/ai/AIChatbot.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { FiLock } from 'react-icons/fi';
import type { Property } from '@/types';
import { postAIChat } from '@/lib/api';
import { FF } from '@/lib/flags';
import { useUserPlan } from '@/lib/useUserPlan';
import { hasAccess } from '@/lib/planPermissions';
import { isAuthEnabled } from '@/lib/auth';
import { formatPercent, formatRoiDisplay, getRoiDisplay, getYieldPercent } from '@/lib/normalizeProperty';

type LooseProperty = Property & {
  latitude?: number | null;
  longitude?: number | null;
  avg_rent?: number | null;
  crime_index?: number | null;
  ofsted_summary?: string | null;
  transport_summary?: string | null;
};

type Message = { role: 'user' | 'assistant'; content: string };
type ChatbotPageMode = 'generic' | 'listings';

interface AIChatbotProps {
  property?: Partial<LooseProperty>;
  pageMode?: ChatbotPageMode;
}

const STORAGE_KEY_PREFIX = 'pn_chat_history_';
const initialMessage = (property?: Partial<LooseProperty>, pageMode: ChatbotPageMode = 'generic'): Message => ({
  role: 'assistant',
  content: property?.title
    ? `Hi! I'm your AI Investment Assistant. Ask me anything about ${property.title}.`
    : pageMode === 'listings'
      ? 'Hi! I can help with property trends, area research, sales evidence, yields and search strategy across these listings.'
      : 'Hi! I can help with UK property investing, area research, sales evidence and deal screening.',
});

const quickPrompts = (hasProperty: boolean, pageMode: ChatbotPageMode) => {
  if (hasProperty) return ['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'];
  if (pageMode === 'listings') return ['Which areas look strongest?', 'What trends should I check?', 'How do I compare sales?'];
  return ['Where should I invest?', 'What market trends matter?', 'How do I compare areas?'];
};

const formatPageSummary = (pageMode: ChatbotPageMode) => {
  if (pageMode === 'listings') {
    return [
      'Page: Listings search results.',
      'No single property is selected. Do not assume the user is asking about one specific listing unless they provide details.',
      'Focus on property trends, area trends, comparable sales evidence, rental demand, yields, pricing signals, search filters and investor research workflow.',
      'When useful, ask for a location, postcode, budget, property type, bedrooms, target yield or investment strategy before giving specific advice.',
    ].join('\n');
  }

  return [
    'Page: General PropNexus assistant.',
    'No single property is selected. Provide UK property investment guidance, area research pointers, sales evidence checks and deal-screening advice.',
  ].join('\n');
};

const formatPropertySummary = (property?: Partial<LooseProperty>) => {
  if (!property) return '';

  const yieldPct = getYieldPercent(property as any);
  const roiDisplay = getRoiDisplay(property as any);

  const details = [
    property.title ? `Title: ${property.title}` : null,
    property.location ? `Location: ${property.location}` : null,
    typeof property.price === 'number' ? `Price: £${property.price.toLocaleString()}` : null,
    typeof property.bedrooms === 'number' ? `Bedrooms: ${property.bedrooms}` : null,
    typeof property.bathrooms === 'number' ? `Bathrooms: ${property.bathrooms}` : null,
    property.propertyType ? `Property type: ${property.propertyType}` : null,
    property.investmentType ? `Investment type: ${property.investmentType}` : null,
    typeof yieldPct === 'number' ? `Yield: ${formatPercent(yieldPct)}` : null,
    typeof roiDisplay.value === 'number' ? `ROI: ${formatRoiDisplay(roiDisplay)}` : null,
    typeof property.top_deal_score === 'number' ? `Top deal score: ${property.top_deal_score}` : null,
    property.description ? `Description: ${String(property.description).slice(0, 600)}` : null,
  ].filter(Boolean);

  return details.join('\n');
};

export default function AIChatbot(props: AIChatbotProps) {
  // If auth is disabled (or Clerk keys missing), we must not touch Clerk hooks.
  // Fail open so builds don't crash.
  if (!isAuthEnabled) {
    return <AIChatbotInner {...props} userHasAccess={true} />;
  }

  return <AIChatbotAuthed {...props} />;
}

function AIChatbotAuthed(props: AIChatbotProps) {
  const { plan } = useUserPlan();
  const userHasAccess = hasAccess(plan, 'investor');
  return <AIChatbotInner {...props} userHasAccess={userHasAccess} />;
}

function AIChatbotInner({
  property,
  pageMode = 'generic',
  userHasAccess,
}: AIChatbotProps & { userHasAccess: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([initialMessage(property, pageMode)]);

  const bottomRef = useRef<HTMLDivElement>(null);
  const chatContextKey = property?.id || pageMode;

  // Load conversation history whenever the active property changes.
  useEffect(() => {
    if (typeof window === 'undefined') {
      setMessages([initialMessage(property, pageMode)]);
      return;
    }

    const storageKey = STORAGE_KEY_PREFIX + chatContextKey;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed);
          return;
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    setMessages([initialMessage(property, pageMode)]);
  }, [property, pageMode, chatContextKey]);

  // Save conversation history to localStorage whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined' || messages.length <= 1) return;
    const storageKey = STORAGE_KEY_PREFIX + chatContextKey;
    localStorage.setItem(storageKey, JSON.stringify(messages));
  }, [messages, chatContextKey]);

  const sendLocalReply = (prompt: string) => {
    const hints: string[] = [];

    const yieldPct = property ? getYieldPercent(property as any) : null;
    const roiDisplay = property ? getRoiDisplay(property as any) : { value: null, isProxy: false };

    if (typeof yieldPct === 'number') hints.push(`yield ≈ ${formatPercent(yieldPct)}`);
    if (typeof roiDisplay.value === 'number') {
      hints.push(`ROI${roiDisplay.isProxy ? ' (proxy)' : ''} ≈ ${formatRoiDisplay(roiDisplay)}`);
    }
    if (typeof property?.price === 'number')
      hints.push(`price ≈ £${property.price.toLocaleString()}`);

    const base = hints.length > 0
      ? `🤖 Quick take: ${hints.join(' · ')}. Sense-check product fees, refi assumptions and local demand.`
      : pageMode === 'listings'
        ? '🤖 I can help compare locations, sale prices, rental demand, yields and filter strategy across the search results.'
        : '🤖 Share a location, budget, property type or postcode and I can give a sharper market view.';

    const lower = prompt.toLowerCase();
    if (!property && (lower.includes('trend') || lower.includes('area') || lower.includes('sales') || lower.includes('compare'))) {
      return `${base} Start with sold-price evidence, days-on-market, rent comps, supply levels, transport links and regeneration signals before narrowing to individual deals.`;
    }
    if (lower.includes('risk'))
      return `${base} Key risks: down-valuation, refurb overrun, and void periods. Add contingency and model DSCR ≥ 1.25×.`;
    if (lower.includes('exit'))
      return `${base} Consider: let & refinance (BRRR), flip at GDV, or leave as vanilla BTL.`;
    if (lower.includes('good') || lower.includes('invest'))
      return `${base} Run both GDV and BRRR paths in the calculator and compare cash left in the deal.`;
    return base;
  };

  const handleSend = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || isLoading) return;

    const userMessage: Message = { role: 'user', content: text };
    setMessages((prev) => prev.concat(userMessage));
    setInput('');
    setError(null);

    // If AI chatbot feature is disabled or no backend key, use local reply
    if (!FF.AI_CHAT) {
      const reply = sendLocalReply(text);
      setTimeout(() => setMessages((p) => p.concat({ role: 'assistant', content: reply })), 500);
      return;
    }

    // Use real GPT backend
    setIsLoading(true);
    try {
      const context = {
        property_id: property?.id,
        summary: property ? formatPropertySummary(property) : formatPageSummary(pageMode),
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

      if (response && response.reply) {
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
    void handleSend(prompt);
  };

  useEffect(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), [messages]);
  useEffect(() => setMessages((p) => (p.length > 60 ? p.slice(-60) : p)), [messages.length]);

  // Handle click on button - show upgrade modal if no access
  const handleButtonClick = () => {
    if (!userHasAccess) {
      setShowUpgradeModal(true);
    } else {
      setIsOpen(true);
    }
  };

  return (
    <>
      <div className="fixed bottom-24 right-5 z-[9999] lg:bottom-6 lg:right-[280px]">
        {!isOpen ? (
          <button
            onClick={handleButtonClick}
            className={`font-semibold px-5 py-3 rounded-full shadow-md transition flex items-center gap-2 ${
              userHasAccess
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gradient-to-r from-brand-500 to-brand-600 text-white hover:from-brand-400 hover:to-brand-500'
            }`}
            aria-label={userHasAccess ? 'Open AI assistant' : 'AI assistant requires upgrade'}
          >
            {userHasAccess ? (
              <>💬 Ask AI</>
            ) : (
              <>
                <FiLock className="w-4 h-4" />
                💬 Ask AI
              </>
            )}
          </button>
        ) : userHasAccess ? (
        <div
          className="w-80 h-[420px] bg-white dark:bg-neutral-900 rounded-xl shadow-lg border border-gray-200 dark:border-neutral-800 flex flex-col overflow-hidden"
          role="dialog"
          aria-modal="true"
          aria-labelledby="ai-assistant-title"
        >
          <div className="bg-gray-800 text-white px-4 py-2 flex justify-between items-center text-sm font-semibold">
            <span id="ai-assistant-title">AI Assistant</span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white text-xl leading-none focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded"
              aria-label="Close AI Assistant"
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

          <div className="bg-slate-100 dark:bg-neutral-900 px-2 py-1 flex flex-wrap gap-2 justify-center" role="group" aria-label="Quick prompt suggestions">
            {quickPrompts(Boolean(property), pageMode).map((t) => (
              <button
                key={t}
                onClick={() => handleQuickPrompt(t)}
                className="bg-blue-100 text-blue-800 dark:bg-neutral-800 dark:text-neutral-200 text-xs rounded-full px-3 py-1 hover:bg-blue-200 dark:hover:bg-neutral-700 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                aria-label={`Quick prompt: ${t}`}
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
              onClick={() => handleSend()}
              disabled={isLoading}
              className="bg-blue-600 text-white px-3 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              aria-label="Send message"
            >
              {isLoading ? '...' : 'Send'}
            </button>
          </div>
        </div>
      ) : null}
    </div>

    {/* Upgrade Modal */}
    {showUpgradeModal && (
      <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl max-w-md mx-4 p-6 space-y-4">
          <div className="flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-brand-500 to-brand-600 text-white mx-auto">
            <FiLock className="w-8 h-8" />
          </div>

          <h3 className="text-2xl font-bold text-center">AI Chat Assistant</h3>

          <p className="text-center text-gray-600 dark:text-gray-400">
            Get instant answers to your property investment questions with our AI-powered chatbot.
          </p>

          <div className="bg-gradient-to-br from-brand-50 to-emerald-50 dark:from-brand-950/30 dark:to-emerald-950/30 rounded-lg p-4 space-y-2">
            <p className="text-sm font-semibold text-gray-900 dark:text-white">✨ Premium Feature</p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Available with Investor plan
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={() => setShowUpgradeModal(false)}
              className="flex-1 px-4 py-2 rounded-lg border border-gray-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-colors"
            >
              Close
            </button>
            <Link
              href="/pricing"
              className="flex-1 px-4 py-2 rounded-lg bg-gradient-to-r from-brand-500 to-brand-600 text-white font-medium hover:from-brand-400 hover:to-brand-500 transition-all text-center"
            >
              View Plans
            </Link>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
