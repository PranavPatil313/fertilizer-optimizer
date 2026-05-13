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
      const errorMessage = {
        role: "assistant",
        content: "Sorry, I'm having trouble connecting. Please try again later.",
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
          className="bg-primary-600 text-white rounded-full p-4 shadow-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-transform transform hover:scale-110"
          aria-label="Toggle Agronomist Chat"
        >
          <ChatBubbleOvalLeftEllipsisIcon className="h-8 w-8" />
        </button>
      </div>

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-24 right-6 w-full max-w-md h-[60vh] bg-white rounded-xl shadow-2xl flex flex-col z-50 border border-gray-200">
          {/* Header */}
          <div className="flex justify-between items-center p-4 bg-gray-50 border-b border-gray-200 rounded-t-xl">
            <h3 className="text-lg font-semibold text-gray-800">AI Agronomist</h3>
            <button onClick={toggleChat} className="text-gray-400 hover:text-gray-600">
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg, index) => (
              <div
                key={index}
                className={`flex ${
                  msg.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg shadow ${
                    msg.role === "user"
                      ? "bg-primary-500 text-white"
                      : "bg-gray-200 text-gray-800"
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
                <div className="bg-gray-200 text-gray-800 px-4 py-2 rounded-lg shadow">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-0"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-200"></div>
                    <div className="w-2 h-2 bg-gray-500 rounded-full animate-pulse delay-400"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Form */}
          <div className="p-4 border-t border-gray-200 bg-white rounded-b-xl">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 w-full px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-primary-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                className="bg-primary-600 text-white rounded-full p-3 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:bg-gray-400"
                disabled={isLoading || !userInput.trim()}
              >
                <PaperAirplaneIcon className="h-5 w-5" />
              </button>
            </form>
          </div>
        </div>
      )}
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