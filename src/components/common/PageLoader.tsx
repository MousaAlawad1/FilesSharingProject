import { Loader2 } from 'lucide-react';

interface PageLoaderProps {
  label?: string;
}

export function PageLoader({ label = 'جاري التحميل...' }: PageLoaderProps) {
  return (
    <div className="min-h-screen bg-ink flex items-center justify-center text-fg-1" dir="rtl">
      <div className="flex flex-col items-center gap-4 text-center px-6">
        <div className="w-14 h-14 rounded-2xl bg-surface-2/60 border border-line/70 flex items-center justify-center shadow-2xl shadow-black/40">
          <Loader2 className="w-6 h-6 animate-spin text-brass-ring" />
        </div>
        <div className="space-y-1">
          <p className="text-sm font-medium text-fg-1">{label}</p>
          <p className="text-xs text-fg-3">يرجى الانتظار قليلاً</p>
        </div>
      </div>
    </div>
  );
}
