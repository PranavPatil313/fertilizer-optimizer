import React, { useState, useRef, useEffect } from "react";
import { PaperAirplaneIcon, ChatBubbleOvalLeftEllipsisIcon, XMarkIcon } from "@heroicons/react/24/solid";
import { askAgronomist } from "../api/api";

const ChatbotWidget = ({ plotContext }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      content: "Hello! I'm your AI Agronomist. How can I help you with this plot today?",
    },
  ]);
  const [userInput, setUserInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const toggleChat = () => {
    setIsOpen(!isOpen);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const newUserMessage = { role: "user", content: userInput };
    setMessages((prev) => [...prev, newUserMessage]);
    setUserInput("");
    setIsLoading(true);

    try {
      const history = [...messages, newUserMessage].map(({ role, content }) => ({
        // The backend llm.py already handles mapping 'assistant' to 'model'.
        role: role,
        content,
      }));

      const res = await askAgronomist({
        message: userInput,
        history: history.slice(0, -1), // Send history *before* the current user message
        plot_context: plotContext,
      });

      const assistantMessage = { role: "assistant", content: res.reply };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Failed to get response from AI Agronomist:", error);
      const errorDetail = error.response?.data?.detail || error.message || "Sorry, I'm having trouble connecting. Please try again later.";
      const errorMessage = {
        role: "assistant",
        content: `Connection Error: ${errorDetail}`,
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <button
          onClick={toggleChat}
          className="relative flex items-center justify-center bg-emerald-600 text-white rounded-full p-4 shadow-lg shadow-emerald-600/30 hover:bg-emerald-500 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 transition-all duration-300 transform hover:scale-110 active:scale-95"
          aria-label="Toggle Agronomist Chat"
        >
          <ChatBubbleOvalLeftEllipsisIcon className={`h-7 w-7 absolute transition-all duration-300 ${isOpen ? 'rotate-90 scale-0 opacity-0' : 'rotate-0 scale-100 opacity-100'}`} />
          <XMarkIcon className={`h-7 w-7 absolute transition-all duration-300 ${isOpen ? 'rotate-0 scale-100 opacity-100' : '-rotate-90 scale-0 opacity-0'}`} />
          {/* Placeholder to maintain button size */}
          <div className="h-7 w-7 opacity-0 pointer-events-none"></div>
        </button>
      </div>

      {/* Chat Window */}
      <div 
        className={`fixed bottom-24 right-4 sm:right-6 w-[calc(100%-2rem)] sm:w-[400px] h-[60vh] min-h-[450px] max-h-[600px] bg-white rounded-2xl shadow-2xl flex flex-col z-50 border border-slate-200 overflow-hidden transform transition-all duration-300 origin-bottom-right ${
          isOpen ? "opacity-100 scale-100 translate-y-0" : "opacity-0 scale-90 translate-y-8 pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-sm z-10">
            <div className="flex items-center space-x-2">
              <div className="w-2.5 h-2.5 bg-green-400 rounded-full animate-pulse"></div>
              <h3 className="text-base font-semibold tracking-wide">AI Agronomist</h3>
            </div>
            <button onClick={toggleChat} className="text-white/80 hover:text-white hover:bg-white/20 p-1.5 rounded-full transition-colors">
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-5 bg-slate-50/50">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-sm ${
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-br-sm"
                      : "bg-white border border-slate-100 text-slate-800 rounded-bl-sm"
                  }`}
                >
                  {msg.content.split('\n').map((line, i) => (
                    <p key={i} className="whitespace-pre-wrap min-h-[1rem]">
                      {/* Simple Bold Text Parser */}
                      {line.split(/(\*\*.*?\*\*)/g).map((part, j) => 
                        part.startsWith('**') && part.endsWith('**') 
                          ? <strong key={j}>{part.slice(2, -2)}</strong> 
                          : part
                      )}
                    </p>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 px-4 py-3 rounded-2xl rounded-bl-sm shadow-sm flex items-center space-x-1.5">
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-3 sm:p-4 bg-white border-t border-slate-100">
            <form onSubmit={handleSendMessage} className="relative flex items-center">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask a question..."
                className="w-full pl-4 pr-12 py-3 bg-slate-50 border border-slate-200 rounded-full focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 text-sm transition-all placeholder-slate-400"
                disabled={isLoading || !isOpen}
              />
              <button
                type="submit"
                className="absolute right-1.5 bg-emerald-600 text-white rounded-full p-2 hover:bg-emerald-500 focus:outline-none transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md transform hover:scale-105 active:scale-95"
                disabled={isLoading || !userInput.trim() || !isOpen}
              >
                <PaperAirplaneIcon className="h-4 w-4 -ml-0.5" />
              </button>
            </form>
          </div>
        </div>
    </>
  );
};

export default ChatbotWidget;

/*
  HOW TO USE THIS COMPONENT:

  1. Import it into your main page/layout component (e.g., Dashboard.jsx, App.jsx).
     import ChatbotWidget from './components/ChatbotWidget';

  2. If you are on a page that has specific plot data, pass it as a prop.
     This gives the AI context about the farm.

     // Example from a page showing a single plot's details
     const plotData = {
       crop_type: "Maize",
       soil_N: 25,
       pH: 6.8,
       // ... other relevant data from your plot object
     };

     return (
       <div>
         <h1>Plot Details</h1>
         { ... your page content ... }

         <ChatbotWidget plotContext={plotData} />
       </div>
     );

  3. If you are on a general page (like the main dashboard), you can use it
     without the context prop. The AI will act as a general agronomist.

      return (
       <div>
         <h1>Main Dashboard</h1>
         { ... your page content ... }

         <ChatbotWidget />
       </div>
     );
*/