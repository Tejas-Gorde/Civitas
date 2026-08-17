"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function VoteFallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || searchParams.get("election");

  useEffect(() => {
    if (token) {
      router.replace(`/vote/${encodeURIComponent(token)}`);
    } else {
      router.replace("/");
    }
  }, [token, router]);

  return (
    <div className="card p-8 text-center space-y-2">
      <h2 className="text-lg font-bold text-slate-900">Redirecting to Secure Voting Portal...</h2>
      <p className="text-xs text-slate-600">Please wait while we resolve your voting link.</p>
    </div>
  );
}

export default function VoteFallbackPage() {
  return (
    <Suspense fallback={<div className="card p-8 text-center text-xs text-slate-500">Loading...</div>}>
      <VoteFallbackContent />
    </Suspense>
  );
}
