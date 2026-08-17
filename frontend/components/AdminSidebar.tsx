"use client";

import React from "react";
import {
  LayoutGrid,
  Shield,
  Info,
  Globe,
  Plus,
  ChevronLeft,
  ChevronRight,
  Radio,
} from "lucide-react";

export type AdminTab =
  | "dashboard"
  | "audit"
  | "tunnel"
  | "settings";

interface AdminSidebarProps {
  activeTab: AdminTab;
  onSelectTab: (tab: AdminTab) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onCreateElection: () => void;
  unreadCount?: number;
}

export default function AdminSidebar({
  activeTab,
  onSelectTab,
  collapsed,
  onToggleCollapse,
  onCreateElection,
  unreadCount = 0,
}: AdminSidebarProps) {
  const navItems = [
    { id: "dashboard" as AdminTab, label: "Overview & Elections", icon: LayoutGrid },
    { id: "tunnel" as AdminTab, label: "Network Monitor", icon: Radio },
    { id: "audit" as AdminTab, label: "Security Logs", icon: Shield, badge: unreadCount },
    { id: "settings" as AdminTab, label: "System Info", icon: Info },
  ];

  return (
    <aside
      className={`bg-white text-slate-800 transition-all duration-300 flex flex-col justify-between border-r border-slate-200 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] z-30 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      {/* Top Section */}
      <div className="p-3 space-y-3">
        {/* Navigation List */}
        <nav className="space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectTab(item.id)}
                title={collapsed ? item.label : undefined}
                className={`w-full flex items-center gap-3 py-2.5 px-3.5 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-slate-100/90 text-slate-900 font-bold border border-slate-200/80 shadow-xs"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                } ${collapsed ? "justify-center px-0" : ""}`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 stroke-[2] ${
                    isActive ? "text-blue-600" : "text-slate-400"
                  }`}
                />
                {!collapsed && (
                  <span className="truncate flex-1 text-left">{item.label}</span>
                )}
                {!collapsed && item.badge ? (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Footer Section */}
      <div className="p-3 border-t border-slate-200 space-y-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="w-full py-2 px-3 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center gap-2 text-xs font-semibold transition"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
