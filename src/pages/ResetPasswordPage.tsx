import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, KeyRound, Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { PageLoader } from '@/components/common/PageLoader';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { user, loading, resetPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const canSubmit = useMemo(() => password.length >= 6 && confirmPassword.length >= 6, [password, confirmPassword]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (password.length < 6) {
      setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين');
      return;
    }

    setSubmitting(true);

    try {
      await resetPassword(password);
      setSuccess('تم تحديث كلمة المرور بنجاح. سيتم تحويلك الآن إلى لوحة التحكم.');
      window.setTimeout(() => navigate('/dashboard', { replace: true }), 1200);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'تعذر تحديث كلمة المرور');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <PageLoader label="جاري التحقق من صلاحية رابط الاستعادة..." />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-ink text-fg-1 flex items-center justify-center p-4" dir="rtl">
        <div className="w-full max-w-md rounded-3xl border border-line/70 bg-surface-1/80 p-8 text-center shadow-2xl shadow-black/30">
          <div className="w-14 h-14 rounded-2xl bg-brick/10 text-brick-soft flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-bold mb-2">انتهت صلاحية الرابط أو الجلسة غير متاحة</h1>
          <p className="text-sm text-fg-3 leading-7 mb-6">
            أعد طلب رابط جديد لاستعادة كلمة المرور من صفحة تسجيل الدخول.
          </p>
          <button
            onClick={() => navigate('/', { replace: true })}
            className="w-full rounded-xl bg-brass py-3 text-sm font-medium transition hover:bg-brass-hover"
          >
            العودة إلى الصفحة الرئيسية
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ink text-fg-1 flex items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-md rounded-3xl border border-line/70 bg-surface-1/80 p-8 shadow-2xl shadow-black/30">
        <div className="text-center mb-6">
          <div className="w-14 h-14 rounded-2xl bg-brass/10 text-brass-ring flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-bold">تعيين كلمة مرور جديدة</h1>
          <p className="text-sm text-fg-3 mt-2 leading-7">
            اختر كلمة مرور جديدة قوية لحسابك ثم تابع إلى لوحة التحكم.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <Lock className="absolute right-3 top-3 w-5 h-5 text-fg-3" />
            <input
              type="password"
              placeholder="كلمة المرور الجديدة"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface-2/80 py-3 pr-11 pl-4 text-fg-1 placeholder:text-fg-4/80 focus:border-brass-ring focus:outline-none"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          <div className="relative">
            <Lock className="absolute right-3 top-3 w-5 h-5 text-fg-3" />
            <input
              type="password"
              placeholder="تأكيد كلمة المرور الجديدة"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="w-full rounded-xl border border-line-strong bg-surface-2/80 py-3 pr-11 pl-4 text-fg-1 placeholder:text-fg-4/80 focus:border-brass-ring focus:outline-none"
              minLength={6}
              autoComplete="new-password"
              required
            />
          </div>

          {error && (
            <div className="rounded-xl border border-brick/40 bg-brick/10 px-4 py-3 text-sm text-brick-soft">
              {error}
            </div>
          )}

          {success && (
            <div className="rounded-xl border border-sage/30 bg-sage/10 px-4 py-3 text-sm text-sage flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !canSubmit}
            className="w-full rounded-xl bg-brass py-3 text-sm font-medium transition hover:bg-brass-hover disabled:cursor-not-allowed disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                جاري التحديث...
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                تحديث كلمة المرور
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
