# Shairley · شيّرلي

> منصة عمل سحابية حديثة لمشاركة الملفات والتعاون بين الفرق — مبنية على
> **React 18 + TypeScript + Vite + Supabase** ومُصمَّمة بنظام تصميم احترافي
> "Brass on Ink".

<p align="right">
  مصممة لتكون <strong>سريعة</strong>، <strong>آمنة</strong>،
  و<strong>أنيقة</strong> — وكلها في الآن نفسه.
</p>

---

## ✨ المميزات

- 🔐 **مصادقة كاملة** عبر Supabase Auth (بريد + كلمة مرور، ضيف، استعادة كلمة المرور).
- 📁 **رفع/تنزيل** ملفات عبر Supabase Storage مع تتبع للحصص.
- 👥 **مساحات عمل مشتركة** بخمسة أدوار: مالك، مشرف، عضو، مشاهد، ضيف.
- 🔗 **روابط دعوة** آمنة للانضمام إلى المساحات.
- ⚡ **مزامنة فورية** عبر Supabase Realtime.
- 💬 **تعليقات** مرتبطة بالملفات.
- 🕘 **سجل نسخ** كامل لكل ملف.
- 🔔 **إشعارات داخل التطبيق** مع شارة غير المقروء.
- 🌙 واجهة عربية **RTL** بنظام تصميم احترافي.

## 🎨 نظام التصميم — Brass on Ink

| المجال        | الرموز                                                |
| ------------- | ------------------------------------------------------ |
| القماشة       | `ink`, `surface-1..4`                                  |
| الخطوط        | `line`, `line-strong`                                  |
| النصوص        | `fg-1` (أساسي) → `fg-4` (خافت)                         |
| اللون المميّز | `brass`, `brass-hover`, `brass-ring` (ذهبي دافئ)       |
| الحالات       | `brick` (خطر) · `sage` (نجاح)                          |
| الأزرار       | `.btn-primary` `.btn-secondary` `.btn-ghost` `.btn-danger` |
| الأسطح        | `.surface-elevated` `.surface-floating` `.glass-card`  |
| النصوص الفنية | `.kicker` `.metric` `.accent-top`                      |

كل التوكنات مكتوبة كقيم HSL داخل `src/index.css`، لذا يمكنك استخدام
`bg-surface-2/70` أو `text-brass-ring/50` بأي مستوى شفافية.

---

## 🚀 الإعداد السريع

### 1) أنشئ مشروع Supabase

- أنشئ مشروعاً جديداً من [supabase.com](https://supabase.com).
- انسخ **Project URL** و **anon public key**.

### 2) شغّل ملف الـ SQL

كل المخطط (الجداول، RLS، الدوال، التريغرز، الـ Storage، الـ Realtime) في
ملف واحد قابل لإعادة التشغيل:

```
supabase/migrations/001_init.sql
```

افتح **SQL Editor** في Supabase، الصق الملف وشغّله.

### 3) أنشئ ملف البيئة

```bash
cp .env.example .env
```

ثم عدّل القيم:

```env
VITE_APP_TITLE="Shairley — شيّرلي"
VITE_APP_DESCRIPTION="شيّرلي — مساحة عمل سحابية..."
VITE_APP_LOGO_URL="/favicon.svg"

VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4) التشغيل محلياً

```bash
npm install
npm run dev
```

ثم افتح [http://localhost:3000](http://localhost:3000).

---

## ☁️ النشر على Vercel

1. ارفع المشروع إلى GitHub.
2. اربطه مع Vercel.
3. أضف متغيرات البيئة (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`،
   واختيارياً `VITE_APP_TITLE` و `VITE_APP_DESCRIPTION`).
4. انشر — `vercel.json` يهتم بـ SPA routing.

---

## 🧱 التقنيات

- **React 18** + **TypeScript**
- **Vite 5** + **vite-prerender-plugin** للمدوّنة
- **Tailwind CSS 3** + **shadcn/ui** + **@tailwindcss/typography**
- **Supabase** (Auth, DB, Storage, Realtime)
- **Framer Motion** للحركة
- **React Router v6**
- **Lucide Icons**

## 📝 الترخيص

جميع الحقوق محفوظة © Shairley.
