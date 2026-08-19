import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import HeaderNav from "../components/HeaderNav";
import { ThemeProvider } from "../components/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_PUBLIC_APP_URL || "https://civitas-frontend-nvp6.onrender.com"
  ),
  title: "Civitas \u2013 Secure Digital Voting System",
  description:
    "Civitas is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
  keywords: [
    "Civitas",
    "secure digital voting",
    "biometric authentication",
    "face verification",
    "digital election platform",
    "multiple voting modes",
    "tamper-evident voting",
    "voter authentication",
    "liveness detection",
  ],
  authors: [{ name: "Civitas" }],
  creator: "Civitas",
  publisher: "Civitas",
  applicationName: "Civitas",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  // Removed hardcoded canonical to prevent conflicting canonical configuration on subpages

  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://civitas-frontend-nvp6.onrender.com",
    siteName: "Civitas",
    title: "Civitas \u2013 Secure Digital Voting System",
    description:
      "Civitas is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Civitas \u2013 Secure Digital Voting System",
    description:
      "Civitas is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
  },
  verification: {
    google: "-V0qciSSJoLVrcZdmDGlkPrSA6wEn4C2yyvSXy-qctM",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var stored = localStorage.getItem('civitas-theme');
                  var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                  if (stored === 'dark' || (!stored && prefersDark)) {
                    document.documentElement.classList.add('dark');
                    document.documentElement.style.colorScheme = 'dark';
                  } else {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.style.colorScheme = 'light';
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body suppressHydrationWarning className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200">
        <ThemeProvider>
          <HeaderNav />

          {/* Main Content Area */}
          <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
            {children}
          </main>

          {/* Footer */}
          <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 py-6 text-xs text-slate-500 dark:text-slate-400 transition-colors duration-200">
            <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-3 px-4 sm:flex-row sm:px-6">
              <div>
                <p className="font-semibold text-slate-700 dark:text-slate-300">CIVITAS Secure Digital Voting System</p>
                <p className="mt-0.5 text-slate-500 dark:text-slate-500">
                  Authorized Election Security Verification Platform
                </p>
              </div>
              <div className="flex items-center gap-4 text-slate-500 dark:text-slate-400">
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
        </ThemeProvider>
      </body>
    </html>
  );
}
