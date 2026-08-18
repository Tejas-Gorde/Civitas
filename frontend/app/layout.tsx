import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "sonner";
import HeaderNav from "../components/HeaderNav";

export const metadata: Metadata = {
  metadataBase: new URL("https://civitas-frontend.onrender.com"),
  title: "Civitas \u2013 Secure Digital Voting System",
  description:
    "CIVITAS is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
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
  applicationName: "Civitas Secure Digital Voting System",
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
  alternates: {
    canonical: "https://civitas-frontend.onrender.com",
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://civitas-frontend.onrender.com",
    siteName: "Civitas",
    title: "Civitas \u2013 Secure Digital Voting System",
    description:
      "CIVITAS is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Civitas \u2013 Secure Digital Voting System",
    description:
      "CIVITAS is a secure digital voting platform featuring biometric authentication, real-time face verification, and multiple voting modes for transparent and tamper-evident elections.",
  },
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
