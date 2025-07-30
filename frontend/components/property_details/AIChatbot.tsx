'use client';

import { useEffect, useRef, useState } from 'react';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi! I\'m your AI Investment Assistant. Ask me anything about this deal.' },
  ]);

  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim()) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');

    // Simulate AI reply
    setTimeout(() => {
      const botMsg: Message = {
        role: 'assistant',
        content: '🤖 This deal looks promising based on ROI and yield. Make sure to check mortgage terms and area demand!',
      };
      setMessages((prev) => [...prev, botMsg]);
    }, 800);
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput(prompt);
    setTimeout(() => handleSend(), 100);
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
            <button onClick={() => setIsOpen(false)} className="text-white text-xl leading-none">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-3 overflow-y-auto bg-gray-50 text-sm">
            {messages.map((msg, i) => (
              <div key={i} className={`mb-2 text-${msg.role === 'user' ? 'right' : 'left'}`}>
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
            {['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'].map((text) => (
              <button
                key={text}
                onClick={() => handleQuickPrompt(text)}
                className="bg-blue-100 text-blue-800 text-xs rounded-full px-3 py-1 hover:bg-blue-200 transition"
              >
                {text}
              </button>
            ))}
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
};

export default AIChatbot;
