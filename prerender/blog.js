import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import Markdown from 'markdown-to-jsx';
import { blogPosts, getBlogPost } from '../src/lib/blog.ts';

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getBaseUrl() {
  return process.env.VITE_SITE_URL?.replace(/\/+$/, '') || 'https://shairley.app';
}

function normalizePathname(url) {
  if (!url) return '/blog/';
  return url.endsWith('/') ? url : `${url}/`;
}

function getSlugFromUrl(url) {
  return normalizePathname(url)
    .replace(/^\/blog\/?/, '')
    .replace(/\/+$/, '');
}

function getRoutes() {
  return ['/blog/', ...blogPosts.map((post) => `/blog/${post.slug}/`)];
}

function buildHead({ title, description, pathname, tags = [] }) {
  const absoluteUrl = `${getBaseUrl()}${pathname}`;

  return {
    lang: 'ar',
    title,
    elements: new Set([
      { type: 'meta', props: { name: 'description', content: description } },
      { type: 'meta', props: { name: 'prerender-static-page', content: 'blog' } },
      { type: 'meta', props: { property: 'og:type', content: 'article' } },
      { type: 'meta', props: { property: 'og:title', content: title } },
      { type: 'meta', props: { property: 'og:description', content: description } },
      { type: 'meta', props: { property: 'og:url', content: absoluteUrl } },
      { type: 'meta', props: { name: 'twitter:card', content: 'summary_large_image' } },
      { type: 'meta', props: { name: 'twitter:title', content: title } },
      { type: 'meta', props: { name: 'twitter:description', content: description } },
      { type: 'link', props: { rel: 'canonical', href: absoluteUrl } },
      ...tags.map((tag) => ({
        type: 'meta',
        props: { property: 'article:tag', content: tag },
      })),
    ]),
  };
}

function renderIndexPage(posts) {
  return `
    <main dir="rtl" class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_36%),linear-gradient(180deg,_#f8fafc_0%,_#eff6ff_100%)] text-slate-900">
      <section class="mx-auto max-w-5xl px-6 py-16 sm:py-20">
        <div class="max-w-3xl space-y-5">
          <p class="text-sm font-semibold tracking-[0.24em] text-sky-700">مدونة Shairley</p>
          <h1 class="font-serif text-4xl leading-tight text-slate-950 sm:text-5xl">مقالات عملية حول مشاركة الملفات وإدارة مساحات العمل بأمان</h1>
          <p class="text-lg leading-8 text-slate-600">هنا ستجد شروحات وأفكاراً تساعدك على استخدام Shairley بكفاءة أكبر، من تنظيم الملفات إلى دعوة الأعضاء وتفعيل الوصول السريع للضيوف.</p>
        </div>
        <div class="mt-12 grid gap-6">
          ${posts
            .map(
              (post) => `
                <article class="rounded-3xl border border-sky-100 bg-white/90 p-6 shadow-sm shadow-sky-100/60 transition-transform duration-200">
                  <div class="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                    <span>${escapeHtml(post.frontmatter.date || '')}</span>
                    ${(post.frontmatter.tags || [])
                      .map(
                        (tag) =>
                          `<span class="rounded-full bg-sky-50 px-3 py-1 text-sky-700">${escapeHtml(tag)}</span>`
                      )
                      .join('')}
                  </div>
                  <h2 class="mt-4 font-serif text-2xl text-slate-950">
                    <a class="hover:text-sky-700" href="/blog/${post.slug}/">${escapeHtml(post.title)}</a>
                  </h2>
                  <p class="mt-3 text-base leading-7 text-slate-600">${escapeHtml(post.description)}</p>
                  <a class="mt-5 inline-flex text-sm font-semibold text-sky-700 underline underline-offset-4" href="/blog/${post.slug}/">اقرأ المقالة</a>
                </article>
              `
            )
            .join('')}
        </div>
      </section>
    </main>
  `;
}

function renderPostPage(post) {
  const articleBody = renderToStaticMarkup(
    React.createElement(
      'div',
      {
        className:
          'prose prose-slate prose-lg max-w-none text-right prose-headings:font-serif prose-headings:text-slate-950 prose-h1:mt-0 prose-h1:text-4xl prose-h1:leading-tight prose-h2:mt-12 prose-h2:border-t prose-h2:border-slate-200 prose-h2:pt-8 prose-h2:text-3xl prose-h2:leading-snug prose-h3:mt-10 prose-h3:text-2xl prose-h3:leading-snug prose-p:text-[1.06rem] prose-p:leading-8 prose-li:leading-8 prose-strong:text-slate-950 prose-code:rounded prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.9em] prose-code:font-medium prose-pre:rounded-3xl prose-pre:bg-slate-950 prose-pre:p-5 prose-pre:text-slate-50 prose-a:text-sky-700 prose-a:decoration-sky-300 prose-a:underline-offset-4 hover:prose-a:text-sky-800',
      },
      React.createElement(
        Markdown,
        {
          options: {
            forceBlock: true,
            overrides: {
              pre: { props: { className: 'overflow-x-auto text-left' } },
            },
          },
        },
        post.markdown
      )
    )
  );

  return `
    <main class="min-h-screen bg-slate-50 text-slate-900" dir="rtl">
      <div class="mx-auto max-w-4xl px-6 pt-8">
        <a href="/blog/" class="text-sm text-slate-500 underline-offset-4 hover:text-slate-900 hover:underline">العودة إلى المدونة</a>
      </div>
      <article class="mx-auto max-w-3xl px-6 py-12">
        <header class="border-b border-slate-200 pb-10">
          <p class="text-xs font-semibold tracking-[0.28em] text-sky-700">مقالة من المدونة</p>
          <h1 class="mt-4 font-serif text-4xl leading-tight text-slate-950 sm:text-5xl">${escapeHtml(post.title)}</h1>
          <p class="mt-5 max-w-2xl text-lg leading-8 text-slate-600">${escapeHtml(post.description)}</p>
        </header>
        <div class="mt-10">${articleBody}</div>
      </article>
    </main>
  `;
}

export async function prerender({ url }) {
  const pathname = normalizePathname(url);

  // Never replace the application root or non-blog routes with blog fallback HTML.
  // Let Vite keep the normal SPA shell for those routes.
  if (pathname === '/' || !pathname.startsWith('/blog')) {
    return {
      html: '',
      links: new Set(getRoutes()),
    };
  }

  if (pathname === '/blog/') {
    return {
      html: renderIndexPage(blogPosts),
      links: new Set(getRoutes()),
      head: buildHead({
        title: 'مدونة Shairley',
        description: 'مقالات عربية عملية حول إدارة الملفات ومساحات العمل والمشاركة الآمنة.',
        pathname,
      }),
    };
  }

  const slug = getSlugFromUrl(pathname);
  const post = getBlogPost(slug);

  if (!post) {
    return {
      html: '<main dir="rtl" class="min-h-screen flex items-center justify-center bg-slate-50 text-slate-900"><div class="text-center px-6"><h1 class="text-4xl font-bold mb-3">404</h1><p class="text-slate-600">المقالة غير موجودة.</p></div></main>',
      links: new Set(getRoutes()),
      head: buildHead({
        title: 'المقالة غير موجودة | Shairley',
        description: 'المقالة المطلوبة غير متاحة حالياً.',
        pathname,
      }),
    };
  }

  return {
    html: renderPostPage(post),
    links: new Set(getRoutes()),
    head: buildHead({
      title: `${post.title} | Shairley`,
      description: post.description,
      pathname,
      tags: post.frontmatter.tags || [],
    }),
  };
}
