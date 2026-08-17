import Link from "next/link";
import { AlertCircle } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 text-slate-900">
      <div className="card max-w-md p-8 text-center space-y-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-slate-100 text-slate-600 border border-slate-200">
          <AlertCircle className="h-8 w-8" />
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-teal-700">Error 404</span>
          <h2 className="text-2xl font-bold text-slate-900 mt-1">Page Not Found</h2>
          <p className="mt-2 text-xs text-slate-600">
            The requested voting portal page could not be located.
          </p>
        </div>

        <div className="pt-2">
          <Link href="/" className="button button-teal text-xs inline-block">
            Return to Voting Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
