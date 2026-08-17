"use client";

import { useEffect, useRef, useState } from "react";
import { HelpCircle, MessageSquare, Send, Volume2, X } from "lucide-react";
import { api } from "../lib/api";
import { speakInstruction } from "../lib/voice";

interface Message {
  id: string;
  sender: "user" | "assistant";
  text: string;
  lang: "en" | "hi";
}

interface ChatbotProps {
  language: "en" | "hi";
  adminEnabled?: boolean;
  readAloudEnabled?: boolean;
}

const SUGGESTED_QUESTIONS = {
  en: [
    "How does verification work?",
    "Touch ID is not working",
    "Camera is not working",
    "How do I cast my vote?",
  ],
  hi: [
    "सत्यापन कैसे काम करता है?",
    "Touch ID काम नहीं कर रहा है",
    "कैमरा काम नहीं कर रहा है",
    "मैं अपना वोट कैसे डालूं?",
  ],
};

export default function Chatbot({ language = "en", adminEnabled = true, readAloudEnabled = true }: ChatbotProps) {
  const [open, setOpen] = useState(false);
  const [chatLang, setChatLang] = useState<"en" | "hi">(language);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Sync language with parent prop
  useEffect(() => {
    setChatLang(language);
  }, [language]);

  // Initial welcome message
  useEffect(() => {
    if (messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          sender: "assistant",
          text:
            chatLang === "hi"
              ? "नमस्ते! मैं सिविटास हेल्प असिस्टेंट हूँ। मैं आज वोटिंग सिस्टम का उपयोग करने में आपकी कैसे मदद कर सकता हूँ?"
              : "Hello! I am the Civitas Help Assistant. How can I help you operate the voting system today?",
          lang: chatLang,
        },
      ]);
    }
  }, [chatLang, messages.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (open) {
      scrollToBottom();
    }
  }, [messages, open]);

  if (!adminEnabled) {
    return null;
  }

  const handleSend = async (userMsgText?: string) => {
    const query = (userMsgText || input).trim();
    if (!query || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      sender: "user",
      text: query,
      lang: chatLang,
    };

    setMessages((prev) => [...prev, userMessage]);
    if (!userMsgText) setInput("");
    setLoading(true);

    try {
      const res = await api.post("/help/chat", {
        message: query,
        language: chatLang,
      });

      const answerText = res.data?.answer || (chatLang === "hi" ? "सहायता उत्तर प्राप्त हुआ।" : "Help answer received.");

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        sender: "assistant",
        text: answerText,
        lang: chatLang,
      };

      setMessages((prev) => [...prev, assistantMessage]);

      if (readAloudEnabled) {
        speakInstruction(answerText, { lang: chatLang });
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: "assistant",
          text:
            chatLang === "hi"
              ? "AI सहायता अस्थायी रूप से अनुपलब्ध है। कृपया स्क्रीन पर दिए गए निर्देशों का उपयोग करें।"
              : "AI assistance is temporarily unavailable. Please use the instructions displayed on the screen.",
          lang: chatLang,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed bottom-3 right-3 sm:bottom-5 sm:right-5 z-50">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full bg-slate-900 px-4 py-3 text-xs font-bold text-white shadow-xl hover:bg-slate-800 transition-all border border-slate-700"
        >
          <HelpCircle className="h-4 w-4 text-teal-400" />
          <span>{chatLang === "hi" ? "सहायता चाहिए? (Help)" : "Help Assistant"}</span>
        </button>
      )}

      {open && (
        <div className="flex h-[80vh] max-h-[520px] sm:h-[480px] w-[calc(100vw-24px)] max-w-[380px] flex-col rounded-2xl border border-slate-300 bg-white shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-teal-400" />
              <div>
                <h3 className="text-xs font-bold text-white">Civitas Help Assistant</h3>
                <p className="text-[10px] text-slate-300">System & Verification Guide</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setChatLang((l) => (l === "en" ? "hi" : "en"))}
                className="rounded bg-slate-800 px-2 py-0.5 text-[10px] font-bold text-teal-300 border border-slate-700 hover:bg-slate-700"
              >
                {chatLang === "en" ? "हिन्दी" : "English"}
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Messages Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50/50">
            {messages.map((m) => (
              <div
                key={m.id}
                className={`flex flex-col ${m.sender === "user" ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs font-normal leading-relaxed ${
                    m.sender === "user"
                      ? "bg-teal-700 text-white rounded-br-none"
                      : "bg-white text-slate-900 border border-slate-200 shadow-sm rounded-bl-none"
                  }`}
                >
                  {m.text}
                </div>

                {m.sender === "assistant" && (
                  <button
                    type="button"
                    onClick={() => speakInstruction(m.text, { lang: m.lang })}
                    className="mt-1 flex items-center gap-1 text-[10px] font-bold text-teal-700 hover:text-teal-800"
                  >
                    <Volume2 className="h-3 w-3" />
                    <span>{m.lang === "hi" ? "बोलकर सुनें" : "Read Aloud"}</span>
                  </button>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex items-start">
                <div className="rounded-2xl rounded-bl-none bg-white p-3 text-xs text-slate-500 border border-slate-200 shadow-sm animate-pulse">
                  {chatLang === "hi" ? "उत्तर तैयार किया जा रहा है..." : "Analyzing help query..."}
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Suggested Question Pills */}
          <div className="border-t border-slate-200 bg-white px-3 py-2">
            <p className="text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
              {chatLang === "hi" ? "सुझाए गए प्रश्न:" : "Suggested Questions:"}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {SUGGESTED_QUESTIONS[chatLang].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSend(q)}
                  className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-700 border border-slate-200 hover:bg-teal-50 hover:text-teal-900 hover:border-teal-300 transition-colors text-left"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Input Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            className="flex items-center gap-2 border-t border-slate-200 bg-white p-3"
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={chatLang === "hi" ? "अपना प्रश्न पूछें..." : "Type your question..."}
              className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs focus:border-teal-600 focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="rounded-xl bg-teal-700 p-2 text-white hover:bg-teal-800 disabled:opacity-50 transition-colors"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
