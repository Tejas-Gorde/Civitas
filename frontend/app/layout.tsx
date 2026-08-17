import "./globals.css";
import { Toaster } from "sonner";
import HeaderNav from "../components/HeaderNav";

export const metadata = {
  title: "Civitas — Secure Digital Voting",
  description: "Multimodal verification & secure digital election platform",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body suppressHydrationWarning className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
        <HeaderNav />

        {/* Main Content Area */}
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
          {children}
        </main>

        {/* Footer */}
        <footer className="border-t border-slate-200 bg-white py-6 text-xs text-slate-500">
          <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
            <div>
              <p className="font-semibold text-slate-700">CIVITAS Secure Digital Voting System</p>
              <p className="mt-0.5 text-slate-500">
                Authorized Election Security Verification Platform
              </p>
            </div>
            <div className="flex items-center gap-4 text-slate-500">
              <span className="inline-flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                System Operational
              </span>
              <span>•</span>
              <span>Privacy Guaranteed</span>
              <span>•</span>
              <span>Anonymous Ballot</span>
            </div>
          </div>
        </footer>

        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
