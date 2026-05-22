import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function AuthErrorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [countdown, setCountdown] = useState(5);
  const errorMessage =
    searchParams.get('msg') || 'تعذر إكمال عملية المصادقة. قد يكون الرابط منتهي الصلاحية أو غير صالح.';

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((current) => {
        if (current <= 1) {
          window.clearInterval(timer);
          navigate('/', { replace: true });
          return 0;
        }
        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timer);
  }, [navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-ink p-6 text-center text-fg-1" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-line/70 bg-surface-1/80 p-8 shadow-2xl shadow-black/30 space-y-6">
        <div className="space-y-4">
          <div className="flex justify-center">
            <div className="relative">
              <div className="absolute inset-0 rounded-full bg-brick/20 blur-2xl" />
              <AlertCircle className="relative h-12 w-12 text-brick-soft" strokeWidth={1.5} />
            </div>
          </div>

          <h1 className="text-2xl font-bold">حدث خطأ في المصادقة</h1>
          <p className="text-sm leading-7 text-fg-2">{errorMessage}</p>
        </div>

        <div className="rounded-2xl border border-line/70 bg-surface-2/60 px-4 py-3 text-sm text-fg-2">
          {countdown > 0 ? (
            <>
              سيتم إعادتك إلى الصفحة الرئيسية خلال{' '}
              <span className="font-bold text-brass-ring">{countdown}</span>{' '}
              ثوانٍ.
            </>
          ) : (
            'جاري التحويل...'
          )}
        </div>

        <button
          onClick={() => navigate('/', { replace: true })}
          className="w-full rounded-xl bg-brass py-3 text-sm font-medium transition hover:bg-brass-hover flex items-center justify-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          العودة إلى الرئيسية
        </button>
      </div>
    </div>
  );
}
