import { useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Upload,
  Shield,
  Zap,
  Loader2,
  EyeOff,
  Eye,
  ChevronLeft,
  Globe,
  Lock,
  Command,
  Sparkles,
  ArrowUpRight,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

type AuthMode = 'login' | 'register' | 'forgot-password';

const APP_NAME = 'Shairley';
const APP_NAME_AR = 'شيّرلي';

const features = [
  {
    icon: Upload,
    title: 'مشاركة ذكية',
    desc: 'ارفع، نظّم وشارك ملفاتك بسحبٍ واحد. مزامنة فورية لكامل الفريق.',
  },
  {
    icon: Globe,
    title: 'وصول عالمي',
    desc: 'متاحة على كل جهاز وفي كل مكان — متصفح، جوال، تابلت، بدون مفاجآت.',
  },
  {
    icon: Lock,
    title: 'أمان مهني',
    desc: 'صلاحيات دقيقة، روابط محمية، وسجلات نشاط شفافة لكل مساحة.',
  },
  {
    icon: Command,
    title: 'أداء فائق',
    desc: 'بنية حديثة على Supabase تمنحك استجابةً لحظية وتجربة سلسة.',
  },
] as const;

const trustItems = [
  'تشفير من جانب التطبيق',
  'صلاحيات بـ 5 مستويات',
  'سجل نسخ كامل لكل ملف',
  'إشعارات لحظية',
] as const;

export default function LandingPage() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();
  const { login, register, forgotPassword, signInAsGuest } = useAuth();

  const heading = useMemo(() => {
    if (mode === 'login') return 'مرحباً بعودتك';
    if (mode === 'register') return 'أنشئ حسابك';
    return 'استعادة الوصول';
  }, [mode]);

  const subheading = useMemo(() => {
    if (mode === 'login') return 'سجّل دخولك للمتابعة إلى مساحاتك.';
    if (mode === 'register') return 'دقائق قليلة وتكون جاهزاً للعمل مع فريقك.';
    return 'أدخل بريدك وسنرسل رابط استعادة آمن.';
  }, [mode]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError('');
      setSuccess('');
      setLoading(true);

      try {
        if (mode === 'register') {
          if (!fullName.trim()) {
            setError('يرجى إدخال الاسم الكامل');
            return;
          }
          if (password.length < 6) {
            setError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
          }
          const result = await register(email, password, fullName);
          if (result.session) {
            setSuccess('تم إنشاء الحساب وتسجيل الدخول…');
            setTimeout(() => navigate('/dashboard'), 1200);
          } else {
            setSuccess('تم إنشاء الحساب بنجاح، يمكنك تسجيل الدخول الآن.');
            setMode('login');
          }
        } else if (mode === 'login') {
          await login(email, password);
          navigate('/dashboard');
        } else {
          await forgotPassword(email);
          setSuccess('تم إرسال رابط الاستعادة إلى بريدك.');
        }
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
      } finally {
        setLoading(false);
      }
    },
    [mode, email, password, fullName, register, login, forgotPassword, navigate],
  );

  const handleGuestAccess = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await signInAsGuest();
      navigate('/dashboard');
    } catch {
      setError('فشل الدخول كضيف، حاول مجدداً.');
    } finally {
      setLoading(false);
    }
  }, [signInAsGuest, navigate]);

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink text-fg-1" dir="rtl">
      {/* Decorative background */}
      <BackgroundDecor />

      {/* Header */}
      <header className="relative z-30">
        <div className="container mx-auto flex items-center justify-between px-6 py-5">
          <BrandMark />

          <nav className="hidden items-center gap-1 md:flex">
            <a href="#features" className="btn-ghost">
              الميزات
            </a>
            <a href="#trust" className="btn-ghost">
              الأمان
            </a>
            <a href="/blog/" className="btn-ghost">
              المدوّنة
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGuestAccess}
              disabled={loading}
              className="btn-secondary !py-2 text-xs"
            >
              <Sparkles className="h-3.5 w-3.5 text-brass-ring" />
              تجربة سريعة
            </button>
            <button
              onClick={() =>
                document
                  .getElementById('auth-section')
                  ?.scrollIntoView({ behavior: 'smooth' })
              }
              className="btn-primary !py-2 text-xs"
            >
              تسجيل الدخول
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Hero + Auth */}
      <main className="relative z-10">
        <section className="container mx-auto px-6 pb-20 pt-10 lg:pt-16">
          <div className="grid items-center gap-16 lg:grid-cols-[1.1fr_0.9fr]">
            {/* Hero copy */}
            <motion.div
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            >
              <span className="kicker">منصة مشاركة الملفات • {APP_NAME_AR}</span>

              <h1 className="mt-6 text-balance text-5xl font-bold leading-[1.05] tracking-tight text-fg-1 md:text-6xl lg:text-[68px]">
                مساحة عملك السحابية
                <br />
                <span className="bg-gradient-to-l from-brass-ring via-brass to-brass/70 bg-clip-text text-transparent">
                  بسلاسةٍ احترافية.
                </span>
              </h1>

              <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-fg-3 md:text-lg">
                {APP_NAME_AR} ({APP_NAME}) منصة حديثة لإدارة الملفات والتعاون
                بين الفرق — أمان عالٍ، أداء فائق، وتجربة مستخدم مصمَّمة لتكون
                واضحة وجميلة في آنٍ معاً.
              </p>

              <div className="mt-10 flex flex-wrap items-center gap-3">
                <button
                  onClick={() =>
                    document
                      .getElementById('auth-section')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="btn-primary"
                >
                  ابدأ الآن مجاناً
                  <ArrowUpRight className="h-4 w-4" />
                </button>
                <button
                  onClick={handleGuestAccess}
                  disabled={loading}
                  className="btn-secondary"
                >
                  استكشف كضيف
                </button>
              </div>

              {/* Mini stats / proof */}
              <dl className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-line/60 pt-8">
                <Stat label="وقت تشغيل" value="99.9%" />
                <Stat label="مزامنة" value="فورية" />
                <Stat label="تشفير" value="TLS 1.3" />
              </dl>
            </motion.div>

            {/* Auth card */}
            <motion.div
              id="auth-section"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, delay: 0.15, ease: 'easeOut' }}
              className="glass-card accent-top w-full max-w-md justify-self-start p-8 lg:justify-self-end"
            >
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-semibold tracking-tight">
                    {heading}
                  </h2>
                  <p className="mt-1 text-sm text-fg-3">{subheading}</p>
                </div>
                <div className="hidden h-10 w-10 items-center justify-center rounded-xl border border-brass/30 bg-brass/10 sm:flex">
                  <Shield className="h-4 w-4 text-brass-ring" />
                </div>
              </div>

              {/* Segmented mode switch */}
              <div className="mb-6 grid grid-cols-2 rounded-xl border border-line/70 bg-surface-1/70 p-1 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError('');
                    setSuccess('');
                  }}
                  className={`rounded-lg py-2 font-medium transition-all ${
                    mode !== 'register'
                      ? 'bg-surface-3 text-fg-1 shadow-depth-1'
                      : 'text-fg-3 hover:text-fg-1'
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError('');
                    setSuccess('');
                  }}
                  className={`rounded-lg py-2 font-medium transition-all ${
                    mode === 'register'
                      ? 'bg-surface-3 text-fg-1 shadow-depth-1'
                      : 'text-fg-3 hover:text-fg-1'
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                {mode === 'register' && (
                  <Field
                    label="الاسم الكامل"
                    type="text"
                    value={fullName}
                    onChange={setFullName}
                    placeholder="مثال: سارة عبد الله"
                    required
                  />
                )}

                <Field
                  label="البريد الإلكتروني"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="you@email.com"
                  required
                />

                {mode !== 'forgot-password' && (
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-fg-3">
                      كلمة المرور
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="field pl-11"
                        placeholder="••••••••"
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((s) => !s)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-fg-3 transition-colors hover:bg-surface-3 hover:text-fg-1"
                        aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                      >
                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                {error && (
                  <p className="rounded-lg border border-brick/30 bg-brick/10 px-3 py-2 text-center text-xs text-brick-soft">
                    {error}
                  </p>
                )}
                {success && (
                  <p className="rounded-lg border border-sage/30 bg-sage/10 px-3 py-2 text-center text-xs text-sage">
                    {success}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="btn-primary mt-2 w-full !py-3"
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : mode === 'login' ? (
                    'دخول'
                  ) : mode === 'register' ? (
                    'إنشاء الحساب'
                  ) : (
                    'إرسال رابط الاستعادة'
                  )}
                </button>
              </form>

              <div className="my-6 flex items-center gap-3 text-[10px] uppercase tracking-[0.18em] text-fg-4">
                <span className="h-px flex-1 bg-line/70" />
                أو
                <span className="h-px flex-1 bg-line/70" />
              </div>

              <button
                type="button"
                onClick={handleGuestAccess}
                disabled={loading}
                className="btn-secondary w-full !py-3"
              >
                <Sparkles className="h-4 w-4 text-brass-ring" />
                المتابعة كضيف
              </button>

              <div className="mt-5 flex items-center justify-between text-xs text-fg-3">
                {mode === 'login' ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('forgot-password');
                      setError('');
                      setSuccess('');
                    }}
                    className="link-brass hover:text-fg-1"
                  >
                    نسيت كلمة المرور؟
                  </button>
                ) : (
                  <span />
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === 'login' ? 'register' : 'login');
                    setError('');
                    setSuccess('');
                  }}
                  className="link-brass hover:text-fg-1"
                >
                  {mode === 'login' ? 'إنشاء حساب جديد' : 'لديك حساب؟ سجّل دخولك'}
                </button>
              </div>
            </motion.div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="container mx-auto px-6 py-20">
          <div className="mb-12 max-w-2xl">
            <span className="kicker">الميزات</span>
            <h2 className="mt-4 text-3xl font-semibold tracking-tight text-fg-1 md:text-4xl">
              كل ما يحتاجه فريقك — في مكان واحد.
            </h2>
            <p className="mt-3 text-fg-3">
              صُمّمت {APP_NAME_AR} لتكون أداتك اليومية: بسيطة عندما تحتاج، قوية
              عندما يجب.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {features.map((f, i) => (
              <motion.article
                key={f.title}
                initial={{ opacity: 0, y: 12 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: '-60px' }}
                transition={{ duration: 0.45, delay: i * 0.05 }}
                className="surface-elevated group relative overflow-hidden p-6 transition-colors hover:border-brass/40"
              >
                <div
                  className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-brass/25"
                  style={{
                    background:
                      'linear-gradient(180deg, hsl(var(--brass) / 0.18), hsl(var(--brass) / 0.04))',
                    boxShadow: 'inset 0 1px 0 0 hsl(var(--sheen) / 0.10)',
                  }}
                >
                  <f.icon className="h-5 w-5 text-brass-ring" />
                </div>
                <h3 className="text-base font-semibold tracking-tight text-fg-1">
                  {f.title}
                </h3>
                <p className="mt-2 text-sm leading-7 text-fg-3">{f.desc}</p>
              </motion.article>
            ))}
          </div>
        </section>

        {/* Trust strip */}
        <section id="trust" className="container mx-auto px-6 pb-24">
          <div className="surface-elevated accent-top grid items-center gap-8 p-8 md:grid-cols-[1.2fr_1fr]">
            <div>
              <span className="kicker">الأمان أولاً</span>
              <h3 className="mt-4 text-2xl font-semibold tracking-tight text-fg-1 md:text-3xl">
                بياناتك لك وحدك — ونحن نحرسها بصمت.
              </h3>
              <p className="mt-3 max-w-xl text-fg-3">
                نعتمد على Supabase Auth و Row-Level Security مع تشفير في النقل
                والتخزين. سياسات صارمة، شفافية كاملة، ولا حيل.
              </p>
              <div className="mt-6 flex flex-wrap gap-4">
                <button
                  onClick={() =>
                    document
                      .getElementById('auth-section')
                      ?.scrollIntoView({ behavior: 'smooth' })
                  }
                  className="btn-primary"
                >
                  جرّب الآن
                  <Zap className="h-4 w-4" />
                </button>
                <a href="/blog/" className="btn-secondary">
                  اقرأ من المدوّنة
                  <Layers className="h-4 w-4" />
                </a>
              </div>
            </div>

            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {trustItems.map((item) => (
                <li
                  key={item}
                  className="flex items-center gap-3 rounded-xl border border-line/70 bg-surface-1/60 px-4 py-3 text-sm text-fg-2"
                >
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-sage/10 text-sage">
                    <CheckCircle2 className="h-4 w-4" />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="relative z-10 border-t border-line/60">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-6 py-10 md:flex-row">
          <div className="flex items-center gap-3 text-sm text-fg-3">
            <BrandMark small />
            <span className="hidden md:inline">·</span>
            <span>
              © {new Date().getFullYear()} {APP_NAME}. جميع الحقوق محفوظة.
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-6 text-sm text-fg-3">
            <a href="#" className="link-brass hover:text-fg-1">
              الخصوصية
            </a>
            <a href="#" className="link-brass hover:text-fg-1">
              الشروط
            </a>
            <a href="/blog/" className="link-brass hover:text-fg-1">
              المدوّنة
            </a>
            <a href="mailto:hello@shairley.app" className="link-brass hover:text-fg-1">
              تواصل معنا
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  Sub-components                                                            */
/* -------------------------------------------------------------------------- */

function BrandMark({ small = false }: { small?: boolean }) {
  return (
    <a href="/" className="group inline-flex items-center gap-3">
      <div
        className={`relative grid place-items-center rounded-xl border border-brass/30 ${
          small ? 'h-8 w-8' : 'h-10 w-10'
        }`}
        style={{
          background:
            'linear-gradient(180deg, hsl(var(--brass) / 0.32), hsl(var(--brass) / 0.06))',
          boxShadow:
            'inset 0 1px 0 0 hsl(var(--sheen) / 0.25), 0 6px 18px -8px hsl(var(--brass) / 0.5)',
        }}
      >
        <span
          className={`font-serif font-bold leading-none text-[hsl(220_18%_6%)] ${
            small ? 'text-base' : 'text-lg'
          }`}
        >
          S
        </span>
      </div>
      <div className="leading-tight">
        <div className={`font-semibold tracking-tight ${small ? 'text-sm' : 'text-base'}`}>
          Shairley
        </div>
        <div className="text-[10px] uppercase tracking-[0.22em] text-fg-4">
          شيّرلي · workspace
        </div>
      </div>
    </a>
  );
}

function Field({
  label,
  type,
  value,
  onChange,
  placeholder,
  required,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-xs font-medium text-fg-3">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="field"
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-[0.18em] text-fg-4">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-fg-1">{value}</dd>
    </div>
  );
}

function BackgroundDecor() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--brass) / 0.18), transparent 70%)',
        }}
      />
      <div
        className="absolute -bottom-40 -left-40 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, hsl(220 60% 50% / 0.10), transparent 70%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
          backgroundSize: '48px 48px',
          maskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage:
            'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
    </div>
  );
}
