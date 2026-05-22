import { Link } from 'react-router-dom';
import { ArrowUpLeft } from 'lucide-react';

type BlogArticleLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

const BlogArticleLayout = ({
  title,
  description,
  children,
}: BlogArticleLayoutProps) => (
  <main className="relative min-h-screen bg-ink text-fg-1" dir="rtl">
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div
        className="absolute -right-32 -top-32 h-[380px] w-[380px] rounded-full blur-3xl"
        style={{
          background:
            'radial-gradient(closest-side, hsl(var(--brass) / 0.15), transparent 70%)',
        }}
      />
    </div>

    <header className="relative z-10 border-b border-line/60">
      <div className="container mx-auto flex items-center justify-between px-6 py-5">
        <Link to="/blog/" className="btn-ghost">
          <ArrowUpLeft className="h-4 w-4" />
          العودة إلى المدوّنة
        </Link>
        <Link to="/" className="text-xs tracking-[0.22em] text-fg-4 link-brass hover:text-fg-1">
          SHAIRLEY · شيّرلي
        </Link>
      </div>
    </header>

    <article className="relative z-10 mx-auto max-w-3xl px-6 py-14">
      <header className="border-b border-line/60 pb-10">
        <p className="kicker">مقالة من المدوّنة</p>
        <h1 className="mt-5 text-balance font-serif text-4xl leading-tight tracking-tight text-fg-1 sm:text-5xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-5 max-w-2xl text-pretty text-lg leading-8 text-fg-3">
            {description}
          </p>
        ) : null}
      </header>

      <div className="prose prose-invert prose-lg mt-10 max-w-none
        prose-headings:font-serif prose-headings:tracking-tight prose-headings:text-fg-1
        prose-p:text-fg-2 prose-p:leading-8
        prose-a:text-brass-ring prose-a:no-underline hover:prose-a:underline
        prose-strong:text-fg-1
        prose-code:rounded prose-code:bg-surface-3 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-brass-ring prose-code:before:hidden prose-code:after:hidden
        prose-pre:rounded-2xl prose-pre:border prose-pre:border-line prose-pre:bg-surface-2
        prose-blockquote:border-r-2 prose-blockquote:border-brass prose-blockquote:bg-surface-2/50 prose-blockquote:px-5 prose-blockquote:py-1 prose-blockquote:text-fg-2
        prose-li:text-fg-2
        prose-hr:border-line">
        {children}
      </div>
    </article>
  </main>
);

export default BlogArticleLayout;
