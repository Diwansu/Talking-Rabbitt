import React, { useRef, useEffect } from 'react';
import { Send } from 'lucide-react';

export default function ChatInterface({
  chat,
  inputVal,
  setInputVal,
  handleSend,
  isTyping,
  agent,
  chartConfig,
  chartHint,
}) {
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chat, isTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getPlaceholder = () => {
    if (agent === 'analyst') {
      return "Ask e.g. 'Compare sales of TV vs Headphones'";
    } else if (agent === 'diagnostics') {
      return "Ask e.g. 'Why does Electric Toothbrush have zero price?'";
    }
    return "Ask e.g. 'Generate an advertising title for Office Chair'";
  };

  return (
    <>
      <div className="chat-messages">
        {chat.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.text}
          </div>
        ))}
        {isTyping && (
          <div className="typing-dots">
            <span></span>
            <span></span>
            <span></span>
          </div>
        )}
        {chartConfig.type === 'none' && chartHint && (
          <div className="hint-banner">{chartHint}</div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="chat-input-container">
        <input
          type="text"
          className="chat-input"
          placeholder={getPlaceholder()}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isTyping}
        />
        <button
          className="send-btn"
          onClick={handleSend}
          disabled={!inputVal.trim() || isTyping}
        >
          <Send size={18} />
        </button>
      </div>
    </>
  );
}
