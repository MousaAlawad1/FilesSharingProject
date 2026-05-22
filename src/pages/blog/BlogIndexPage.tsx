import { Link } from 'react-router-dom';
import { ArrowUpLeft, BookOpen } from 'lucide-react';
import { blogPosts, getBlogRoute } from '@/lib/blog';

const BlogIndexPage = () => (
  <main className="relative min-h-screen bg-ink text-fg-1" dir="rtl">
    {/* Decorative background */}
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -right-40 -top-40 h-[420px] w-[420px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--brass) / 0.18), transparent 70%)',
        }}
      />
    </div>

    <header className="relative z-10 border-b border-line/60">
      <div className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/" className="btn-ghost">
          <ArrowUpLeft className="h-4 w-4" />
          عودة إلى Shairley
        </Link>
        <span className="kicker">المدوّنة</span>
      </div>
    </header>

    <section className="relative z-10 container mx-auto max-w-5xl px-6 py-16 sm:py-20">
      <div className="max-w-3xl">
        <span className="kicker">مدوّنة Shairley · شيّرلي</span>
        <h1 className="mt-5 text-balance text-4xl font-bold leading-tight tracking-tight text-fg-1 sm:text-5xl">
          مقالات عملية حول مشاركة الملفات وإدارة مساحات العمل بأمان.
        </h1>
        <p className="mt-5 text-pretty text-lg leading-8 text-fg-3">
          هنا ستجد شروحات وأفكاراً تساعدك على استخدام Shairley بكفاءة أكبر —
          من تنظيم الملفات إلى دعوة الأعضاء وتفعيل الوصول السريع للضيوف.
        </p>
      </div>

      <div className="mt-12 grid gap-5">
        {blogPosts.length > 0 ? (
          blogPosts.map((post) => (
            <article
              key={post.slug}
              className="surface-elevated group p-6 transition-all hover:-translate-y-0.5 hover:border-brass/40"
            >
              <div className="flex flex-wrap items-center gap-3 text-xs text-fg-4">
                {post.frontmatter.date ? <span>{post.frontmatter.date}</span> : null}
                {post.frontmatter.tags?.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-brass/25 bg-brass/10 px-3 py-1 text-brass-ring"
                  >
                    {tag}
                  </span>
                ))}
              </div>
              <h2 className="mt-4 font-serif text-2xl font-semibold text-fg-1">
                <Link
                  className="link-brass hover:text-brass-ring"
                  to={getBlogRoute(post.slug)}
                >
                  {post.title}
                </Link>
              </h2>
              <p className="mt-3 text-base leading-7 text-fg-3">
                {post.description}
              </p>
              <Link
                to={getBlogRoute(post.slug)}
                className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brass-ring link-brass"
              >
                اقرأ المقالة
                <ArrowUpLeft className="h-3.5 w-3.5" />
              </Link>
            </article>
          ))
        ) : (
          <section className="surface-elevated p-8">
            <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-brass/25 bg-brass/10 text-brass-ring">
              <BookOpen className="h-5 w-5" />
            </div>
            <h2 className="font-serif text-2xl font-semibold text-fg-1">
              لا توجد مقالات بعد
            </h2>
            <p className="mt-3 max-w-2xl text-base leading-7 text-fg-3">
              أضف ملفات Markdown داخل <code className="rounded bg-surface-3 px-1.5 py-0.5 text-brass-ring">seo/content/</code>
              {' '}ليتم توليد صفحات المدوّنة وروابطها تلقائياً.
            </p>
          </section>
        )}
      </div>
    </section>
  </main>
);

export default BlogIndexPage;
