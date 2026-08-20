import Link from "next/link";
import { UserCheck, Shield, Activity, ArrowRight, Lock, CheckCircle2 } from "lucide-react";
import CivitasHelpAssistant from "../components/CivitasHelpAssistant";

const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "Civitas",
  "alternateName": ["CIVITAS"],
  "url": "https://civitas-frontend-nvp6.onrender.com/",
};

export default function Home() {
  return (
    <div className="space-y-5 sm:space-y-8 max-w-5xl mx-auto py-4 sm:py-6 px-2 sm:px-4 relative">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      {/* Brand Hero Header */}
      <div className="card p-6 sm:p-10 text-center space-y-3 sm:space-y-4 bg-gradient-to-b from-white to-slate-50 dark:from-[#0a0d11] dark:to-[#0a0d11] border-slate-200/80 dark:border-[#1a222c] shadow-xs relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-teal-500/10 dark:bg-teal-500/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute -bottom-12 -left-12 w-40 h-40 bg-sky-500/10 dark:bg-sky-500/5 rounded-full blur-2xl pointer-events-none"></div>

        <div className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-bold uppercase tracking-widest text-teal-800 dark:text-[#2dd4bf] bg-teal-50 dark:bg-[#051816] px-3 py-1.5 rounded-full border border-teal-200 dark:border-[#0e3834] shadow-xs">
          <Shield className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-teal-600 dark:text-teal-400 shrink-0" />
          <span>CIVITAS DIGITAL VOTING SYSTEM</span>
        </div>

        <h1 className="text-2xl sm:text-5xl font-black text-slate-900 dark:text-[#f5f7fa] tracking-tight">
          CIVITAS
        </h1>
        <p className="text-sm sm:text-lg font-medium text-slate-600 dark:text-[#a7b0bd] max-w-xl mx-auto leading-relaxed">
          End-to-End Encrypted, Secure & Role-Managed Digital Election Infrastructure
        </p>

        <div className="pt-1 sm:pt-2 text-xs sm:text-sm font-semibold text-slate-700 dark:text-[#f5f7fa]">
          What would you like to do?
        </div>
      </div>

      {/* 3 Primary Option Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        {/* OPTION 1: VOTER */}
        <Link
          href="/voter"
          className="group card p-5 sm:p-7 flex flex-col justify-between border-2 border-transparent dark:border-[#1a222c] hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-xl active:scale-[0.99] transition-all duration-200 bg-white dark:bg-[#0a0d11] dark:hover:bg-[#11161d] relative"
        >
          <div className="space-y-3.5 sm:space-y-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-teal-100/80 dark:bg-[#082421] text-teal-800 dark:text-[#2dd4bf] flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300 shadow-xs border border-transparent dark:border-[#0e3834]">
              <UserCheck className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block mb-0.5 sm:mb-1">
                Option 1
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#f5f7fa] group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                I'M A VOTER
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-[#707a88] mt-0.5">
                Vote in an existing election
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#a7b0bd] leading-relaxed">
              Access your ballot using your Election ID and voter credentials to securely cast your vote in active polls.
            </p>
          </div>

          <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-[#141a22] flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform min-h-[44px]">
            <span>Enter Voter Portal</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        {/* OPTION 2: I WANT TO CREATE / MANAGE */}
        <Link
          href="/local-admin"
          className="group card p-5 sm:p-7 flex flex-col justify-between border-2 border-transparent dark:border-[#1a222c] hover:border-teal-500 dark:hover:border-teal-500 hover:shadow-xl active:scale-[0.99] transition-all duration-200 bg-white dark:bg-[#0a0d11] dark:hover:bg-[#11161d] relative"
        >
          <div className="space-y-3.5 sm:space-y-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-teal-100/80 dark:bg-[#082421] text-teal-800 dark:text-[#2dd4bf] flex items-center justify-center group-hover:bg-teal-600 group-hover:text-white transition-colors duration-300 shadow-xs border border-transparent dark:border-[#0e3834]">
              <Shield className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-teal-700 dark:text-teal-400 uppercase tracking-wider block mb-0.5 sm:mb-1">
                Option 2
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#f5f7fa] group-hover:text-teal-700 dark:group-hover:text-teal-300 transition-colors">
                I WANT TO CREATE / MANAGE
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-[#707a88] mt-0.5">
                Local Admin Portal
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#a7b0bd] leading-relaxed">
              Sign in with your assigned Local Admin ID & Password or create a new election to manage voters, candidates, and live polls.
            </p>
          </div>

          <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-[#141a22] flex items-center justify-between text-xs font-bold text-teal-700 dark:text-teal-400 group-hover:translate-x-0.5 transition-transform min-h-[44px]">
            <span>Local Admin Entry Portal</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>

        {/* OPTION 3: ALL LIVE ELECTIONS */}
        <Link
          href="/live-elections"
          className="group card p-5 sm:p-7 flex flex-col justify-between border-2 border-transparent dark:border-[#1a222c] hover:border-sky-500 dark:hover:border-sky-500 hover:shadow-xl active:scale-[0.99] transition-all duration-200 bg-white dark:bg-[#0a0d11] dark:hover:bg-[#11161d] relative"
        >
          <div className="space-y-3.5 sm:space-y-4">
            <div className="h-11 w-11 sm:h-12 sm:w-12 rounded-xl bg-sky-100/80 dark:bg-[#0a2034] text-sky-800 dark:text-[#38bdf8] flex items-center justify-center group-hover:bg-sky-600 group-hover:text-white transition-colors duration-300 shadow-xs border border-transparent dark:border-[#0e2c47]">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6" />
            </div>

            <div>
              <span className="text-[10px] sm:text-[11px] font-bold text-sky-700 dark:text-sky-400 uppercase tracking-wider block mb-0.5 sm:mb-1">
                Option 3
              </span>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 dark:text-[#f5f7fa] group-hover:text-sky-700 dark:group-hover:text-sky-300 transition-colors">
                ALL LIVE ELECTIONS
              </h2>
              <p className="text-xs font-semibold text-slate-500 dark:text-[#707a88] mt-0.5">
                See currently active polls
              </p>
            </div>

            <p className="text-xs text-slate-600 dark:text-[#a7b0bd] leading-relaxed">
              Browse currently active public elections, view candidate rosters, voting schedules, and real-time statuses.
            </p>
          </div>

          <div className="pt-4 sm:pt-6 border-t border-slate-100 dark:border-[#141a22] flex items-center justify-between text-xs font-bold text-sky-700 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform min-h-[44px]">
            <span>View Live Elections</span>
            <ArrowRight className="h-4 w-4" />
          </div>
        </Link>
      </div>

      {/* Trust & Security Highlights */}
      <div className="card p-5 sm:p-6 bg-slate-900 dark:bg-[#0a0d11] text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-transparent dark:border-[#1a222c]">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-teal-500/20 dark:bg-[#082421] text-teal-400 dark:text-[#2dd4bf] flex items-center justify-center shrink-0 border border-transparent dark:border-[#0e3834]">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white dark:text-[#f5f7fa]">Encrypted & Audit-Verifiable Ballots</h4>
            <p className="text-[11px] sm:text-xs text-slate-400 dark:text-[#a7b0bd]">
              Identity checks are strictly severed from anonymous vote tallies to preserve voter secrecy.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[11px] sm:text-xs font-semibold text-teal-400 dark:text-[#2dd4bf] bg-slate-800/80 dark:bg-[#0d1117] px-3 py-1.5 rounded-md border border-slate-700 dark:border-[#1a222c] shrink-0 self-start sm:self-auto">
          <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
          <span>Role-Based Access Enforcement</span>
        </div>
      </div>

      {/* Public Home Help Assistant Component */}
      <CivitasHelpAssistant />
    </div>
  );
}

