'use client';

import { useEffect, useRef, useState } from 'react';

const AIChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<{ sender: string; text: string }[]>([
    { sender: 'bot', text: 'Hi! I\'m your AI Investment Assistant. Ask me anything about this deal.' },
  ]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const handleSend = () => {
    if (!input.trim()) return;

    const newMessages = [...messages, { sender: 'user', text: input }];
    setMessages(newMessages);
    setInput('');

    // Simulate AI response
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: 'user', text: input },
        {
          sender: 'bot',
          text: '🤖 This deal looks promising based on ROI and yield. Make sure to check mortgage terms and area demand!',
        },
      ]);
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
    <>
      <div style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
      }}>
        {!isOpen ? (
          <button
            onClick={() => setIsOpen(true)}
            style={{
              backgroundColor: '#3b82f6',
              color: 'white',
              borderRadius: '999px',
              padding: '14px 20px',
              fontWeight: 600,
              boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            💬 Ask AI
          </button>
        ) : (
          <div style={{
            width: '300px',
            height: '420px',
            backgroundColor: 'white',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
          }}>
            {/* Header */}
            <div style={{
              padding: '10px 14px',
              backgroundColor: '#1e293b',
              color: 'white',
              fontWeight: 600,
              fontSize: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}>
              AI Assistant
              <button
                onClick={() => setIsOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'white',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ×
              </button>
            </div>

            {/* Messages */}
            <div style={{
              flex: 1,
              padding: '12px',
              overflowY: 'auto',
              backgroundColor: '#f8fafc',
            }}>
              {messages.map((msg, i) => (
                <div
                  key={i}
                  style={{
                    marginBottom: '10px',
                    textAlign: msg.sender === 'user' ? 'right' : 'left',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    padding: '8px 12px',
                    borderRadius: '14px',
                    backgroundColor: msg.sender === 'user' ? '#3b82f6' : '#e2e8f0',
                    color: msg.sender === 'user' ? 'white' : '#1e293b',
                    fontSize: '14px',
                    maxWidth: '85%',
                  }}>
                    {msg.text}
                  </span>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>

            {/* Quick Prompts */}
            <div style={{
              padding: '6px 10px',
              display: 'flex',
              gap: '6px',
              flexWrap: 'wrap',
              justifyContent: 'center',
              backgroundColor: '#f1f5f9',
            }}>
              {['Is this a good investment?', 'Suggest exit strategies', 'Risk factors?'].map((text) => (
                <button
                  key={text}
                  onClick={() => handleQuickPrompt(text)}
                  style={{
                    backgroundColor: '#e0f2fe',
                    color: '#0c4a6e',
                    fontSize: '12px',
                    border: 'none',
                    borderRadius: '999px',
                    padding: '6px 10px',
                    cursor: 'pointer',
                  }}
                >
                  {text}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div style={{
              padding: '8px 10px',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              gap: '6px',
              backgroundColor: '#fff',
            }}>
              <input
                type="text"
                placeholder="Type a question..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                style={{
                  flex: 1,
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid #cbd5e1',
                  fontSize: '14px',
                }}
              />
              <button
                onClick={handleSend}
                style={{
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  fontWeight: 600,
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AIChatbot;
