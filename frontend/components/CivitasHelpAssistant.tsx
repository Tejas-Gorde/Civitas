"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  MessageSquare,
  X,
  RotateCcw,
  Send,
  Sparkles,
  HelpCircle,
  ChevronRight,
  ShieldCheck,
} from "lucide-react";

interface FAQItem {
  id: number;
  question: string;
  answer: string;
}

const FAQ_DATA: FAQItem[] = [
  {
    id: 1,
    question: "What is CIVITAS?",
    answer:
      "CIVITAS is a secure digital voting platform designed to conduct elections with voter authentication, controlled election management, and secure vote recording.",
  },
  {
    id: 2,
    question: "How can I vote?",
    answer:
      "If you are a registered voter, open the voting portal provided by your election administrator. Enter your election and voter credentials, complete the required identity verification, and then cast your vote.",
  },
  {
    id: 3,
    question: "How do I find a live election?",
    answer:
      "Use the 'Live Elections' section from the main dashboard to view elections that are currently accepting votes. Select an election to access its voting information.",
  },
  {
    id: 4,
    question: "What do I need to vote?",
    answer:
      "You generally need the Election ID, your registered Voter ID/registration details, and the credentials provided by the election administrator. Additional identity verification may also be required.",
  },
  {
    id: 5,
    question: "Can I vote from my mobile phone?",
    answer:
      "Yes. If the election administrator has enabled remote/mobile voting, use the election's public voting link or scan its QR code with your phone.",
  },
  {
    id: 6,
    question: "How do I create an election?",
    answer:
      "If you want to create an election, select 'Create & Manage Election' from the CIVITAS dashboard and follow the election setup process. You can configure the election details, voters, candidates, schedule, and voting settings.",
  },
  {
    id: 7,
    question: "What can an election administrator manage?",
    answer:
      "An election administrator can manage the election configuration, registered voters, candidates, voting status, remote voting access, QR access, and election results according to their assigned permissions.",
  },
  {
    id: 8,
    question: "Can I change an election after creating it?",
    answer:
      "Election settings can be modified according to the election's current state and administrator permissions. Some sensitive settings may be restricted once voting has started to protect election integrity.",
  },
  {
    id: 9,
    question: "Is my vote anonymous?",
    answer:
      "CIVITAS is designed to separate voter authentication from ballot selection so that eligibility can be verified while maintaining ballot privacy. The exact behavior depends on the election's configured security and privacy rules.",
  },
  {
    id: 10,
    question: "I am using CIVITAS for the first time. Where should I start?",
    answer:
      "If you are a voter, start with 'Voter Portal' or 'Live Elections'. If you are setting up an election, select 'Create & Manage Election'. The assistant can guide you through the basic steps.",
  },
];

interface ChatMessage {
  id: string;
  sender: "assistant" | "user";
  text: string;
}

export default function CivitasHelpAssistant() {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "Welcome to CIVITAS 👋\nI can help you understand how voting works or guide you through creating and managing an election.",
    },
  ]);
  const [inputVal, setInputVal] = useState<string>("");
  const [targetScrollId, setTargetScrollId] = useState<string | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const panelRef = useRef<HTMLDivElement | null>(null);

  // Smooth scroll specifically to the newly rendered answer message
  useEffect(() => {
    if (!targetScrollId) return;

    const timer = setTimeout(() => {
      const el = messageRefs.current.get(targetScrollId);
      const container = scrollContainerRef.current;
      if (el && container) {
        const containerRect = container.getBoundingClientRect();
        const elementRect = el.getBoundingClientRect();
        const relativeTop = elementRect.top - containerRect.top + container.scrollTop;

        // Position the answer comfortably in the viewport (with room for question above)
        const targetTop = Math.max(0, relativeTop - 36);
        container.scrollTo({
          top: targetTop,
          behavior: "smooth",
        });
      }
      setTargetScrollId(null);
    }, 60);

    return () => clearTimeout(timer);
  }, [targetScrollId, messages]);

  // Handle Escape key to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const handleSelectQuestion = (item: FAQItem) => {
    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now() + 1}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: item.question,
    };
    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: "assistant",
      text: item.answer,
    };

    setTargetScrollId(botMsgId);
    setMessages((prev) => [...prev, userMsg, botMsg]);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const query = inputVal.trim();
    if (!query) return;

    const userMsgId = `user-${Date.now()}`;
    const botMsgId = `bot-${Date.now() + 1}`;

    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: "user",
      text: query,
    };

    // Find best match in FAQ
    const lower = query.toLowerCase();
    const matched = FAQ_DATA.find(
      (f) =>
        f.question.toLowerCase().includes(lower) ||
        lower.includes(f.question.toLowerCase().replace("?", ""))
    );

    let replyText = "";
    if (matched) {
      replyText = matched.answer;
    } else {
      replyText =
        "I'm currently set up to answer common CIVITAS questions. Please choose one of the suggested questions below.";
    }

    const botMsg: ChatMessage = {
      id: botMsgId,
      sender: "assistant",
      text: replyText,
    };

    setTargetScrollId(botMsgId);
    setMessages((prev) => [...prev, userMsg, botMsg]);
    setInputVal("");
  };

  const handleResetConversation = () => {
    setTargetScrollId(null);
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: "Welcome to CIVITAS 👋\nI can help you understand how voting works or guide you through creating and managing an election.",
      },
    ]);
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({ top: 0, behavior: "smooth" });
    }
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-6 right-6 z-40">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          aria-label={isOpen ? "Close Help Assistant" : "Open CIVITAS Assistant"}
          aria-expanded={isOpen}
          className="group flex items-center gap-2.5 rounded-full bg-teal-600 hover:bg-teal-700 text-white shadow-xl shadow-teal-600/25 px-4 py-3 sm:px-4.5 sm:py-3.5 transition-all transform hover:scale-105 active:scale-95 border border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-400 focus:ring-offset-2"
        >
          {isOpen ? (
            <X className="h-5 w-5" />
          ) : (
            <MessageSquare className="h-5 w-5 stroke-[2.2]" />
          )}
          <span className="text-xs font-bold tracking-tight pr-0.5">
            {isOpen ? "Close" : "Need help?"}
          </span>
          {!isOpen && (
            <span className="hidden sm:inline-flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          )}
        </button>
      </div>

      {/* Floating Chat Panel */}
      {isOpen && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="CIVITAS Assistant"
          className="fixed bottom-20 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[400px] max-h-[580px] h-[520px] flex flex-col bg-white dark:bg-[#0a0d11] border border-slate-200 dark:border-[#1a222c] rounded-2xl shadow-2xl overflow-hidden animate-fade-in font-sans"
        >
          {/* Panel Header */}
          <div className="p-4 border-b border-slate-100 dark:border-[#141a22] flex items-center justify-between bg-slate-50/80 dark:bg-[#05070a]">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shadow-xs">
                <ShieldCheck className="h-5 w-5 stroke-[2.2]" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-[#f5f7fa] leading-tight">
                  CIVITAS Assistant
                </h3>
                <p className="text-[11px] text-slate-500 dark:text-[#707a88] font-medium">
                  How can we help you?
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={handleResetConversation}
                title="Start Over"
                aria-label="Start Over"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-[#707a88] dark:hover:text-[#f5f7fa] hover:bg-slate-200/70 dark:hover:bg-[#11161d] transition"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close"
                aria-label="Close Assistant"
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:text-[#707a88] dark:hover:text-[#f5f7fa] hover:bg-slate-200/70 dark:hover:bg-[#11161d] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Panel Scrollable Messages Body */}
          <div
            ref={scrollContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 text-xs custom-scrollbar bg-slate-50/30 dark:bg-[#030507]"
          >
            {messages.map((m) => {
              const isAssistant = m.sender === "assistant";
              return (
                <div
                  key={m.id}
                  ref={(el) => {
                    if (el) messageRefs.current.set(m.id, el);
                    else messageRefs.current.delete(m.id);
                  }}
                  className={`flex ${isAssistant ? "justify-start" : "justify-end"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl p-3.5 leading-relaxed ${
                      isAssistant
                        ? "bg-white dark:bg-[#0d1117] text-slate-800 dark:text-[#f5f7fa] border border-slate-200 dark:border-[#1a222c] shadow-xs rounded-tl-xs whitespace-pre-line font-medium"
                        : "bg-teal-600 text-white font-semibold rounded-tr-xs shadow-xs"
                    }`}
                  >
                    {m.text}
                  </div>
                </div>
              );
            })}

            {/* Predefined FAQ Buttons Section */}
            <div className="pt-2 space-y-2">
              <div className="text-[11px] font-bold text-slate-500 dark:text-[#707a88] uppercase tracking-wider px-1">
                Suggested Questions
              </div>
              <div className="flex flex-col gap-1.5">
                {FAQ_DATA.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelectQuestion(item)}
                    className="w-full text-left p-2.5 rounded-xl bg-white dark:bg-[#0a0d11] hover:bg-teal-50/80 dark:hover:bg-[#11161d] text-slate-700 dark:text-[#a7b0bd] hover:text-teal-700 dark:hover:text-[#f5f7fa] border border-slate-200/90 dark:border-[#1a222c] hover:border-teal-200 dark:hover:border-[#263342] text-xs font-semibold flex items-center justify-between gap-2 shadow-xs transition group cursor-pointer"
                  >
                    <span className="line-clamp-1">{item.question}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-teal-600 shrink-0 transition-transform group-hover:translate-x-0.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Controls & Input Bar */}
          <div className="p-3 border-t border-slate-100 dark:border-[#141a22] bg-white dark:bg-[#05070a] space-y-2">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              <input
                type="text"
                value={inputVal}
                onChange={(e) => setInputVal(e.target.value)}
                placeholder="Ask a question..."
                className="flex-1 px-3 py-2 rounded-xl bg-slate-50 dark:bg-[#080b0f] border border-slate-200 dark:border-[#1a222c] text-xs text-slate-800 dark:text-[#f5f7fa] placeholder-slate-400 dark:placeholder-[#707a88] focus:outline-none focus:border-teal-500 dark:focus:border-teal-500 focus:bg-white dark:focus:bg-[#080b0f]"
              />
              <button
                type="submit"
                disabled={!inputVal.trim()}
                aria-label="Send message"
                className="p-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white disabled:opacity-40 disabled:cursor-not-allowed transition shadow-xs"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>

            <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-[#707a88] px-1">
              <button
                type="button"
                onClick={handleResetConversation}
                className="hover:text-slate-700 dark:hover:text-[#f5f7fa] font-semibold flex items-center gap-1"
              >
                <RotateCcw className="h-3 w-3" />
                <span>Start Over</span>
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="hover:text-slate-700 dark:hover:text-[#f5f7fa] font-semibold"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
