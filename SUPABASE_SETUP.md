# ⚡ Supabase Setup Guide - Vercel + Supabase Flow

> **المسار الصحيح الآن:** التطبيق يعمل عبر **Vercel + Supabase مباشرة** بدون backend مستقل.

## 1. Disable Email Confirmation (Immediate Sign-up)

1. Go to **Supabase Dashboard** → **Authentication** → **Providers**
2. Open **Email** provider
3. Toggle **OFF** "Confirm email"
4. Save

✅ التسجيل يصبح فورياً.

---

## 2. Disable/Increase Sign-up Rate Limits

1. Go to **Authentication** → **Settings**
2. Scroll to **Rate Limits**
3. Disable or increase **Sign up rate limit**
4. Save

✅ لن يتم منع إنشاء الحسابات بسرعة.

---

## 3. Disable CAPTCHA (if enabled)

1. Go to **Authentication** → **Settings**
2. Scroll to **CAPTCHA**
3. Toggle it **OFF**
4. Save

✅ تجربة تسجيل أسهل.

---

## 4. Run the SQL migration

كل الـ schema الآن في ملف واحد قابل لإعادة التشغيل (idempotent). افتح **Supabase SQL Editor** والصق محتوى:

- `supabase/migrations/001_init.sql`

ثم اضغط **Run**.

### ماذا يحوي هذا الملف؟

- جميع الجداول: `profiles`, `workspaces`, `workspace_members`, `workspace_files`,
  `audit_logs`, `file_versions`, `file_comments`, `notifications`
- الفهارس + فهرس فريد لمنع تكرار العضوية
- RLS مع دوال مساعدة `SECURITY DEFINER` (لتفادي الـ infinite recursion على `workspace_members`)
- Storage bucket `workspace-files` + سياساته
- التريغرز:
  - إنشاء profile تلقائياً عند تسجيل مستخدم
  - فحص حد التخزين قبل رفع ملف
  - تحديث `updated_at` للتعليقات
  - إشعارات لرفع/حذف الملفات، النسخ، التعليقات، انضمام الأعضاء، تجديد الدعوة
- RPCs:
  - `get_workspace_invite_preview(token)` — معاينة الدعوة (anon-safe)
  - `join_workspace_by_invite(token)` — انضمام آمن عبر رابط
  - `get_workspace_members_enriched(workspace_id)` — لائحة الأعضاء مع الأسماء والإيميل
  - `get_workspace_storage_usage(workspace_id)` — استهلاك التخزين
- إضافة الجداول إلى publication `supabase_realtime`

> 💡 الملف **idempotent**: تشغيله أكثر من مرة آمن، ولن يفقد بيانات.
> 💡 إذا كنت قادماً من نسخة قديمة عليها bugs، فقط شغّل هذا الملف — سيُسقط السياسات القديمة المتسرّبة (مثل `members_select_all USING(true)`) ويعيد إنشاء النسخة المضبوطة.

---

## 5. Frontend Environment Variables on Vercel

في **Vercel Project Settings → Environment Variables** أضف:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### مصدر القيم
من داخل Supabase:
1. **Project Settings**
2. **API**
3. انسخ:
   - Project URL
   - anon public key

---

## 6. Deploy to Vercel

1. ارفع الكود إلى GitHub
2. اربط المستودع مع Vercel
3. أضف Environment Variables السابقة
4. نفّذ Deploy

✅ التطبيق سيعمل كواجهة على Vercel مع اتصال مباشر بـ Supabase.

---

## 7. Local Development

أنشئ ملف `.env` محلياً:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

ثم شغّل:

```bash
npm install
npm run dev
```

---

## 8. Verify Features

### Test 1: Sign-up
- أنشئ حساب جديد
- يجب أن تدخل مباشرة بدون تأكيد بريد

### Test 2: Workspace flow
- أنشئ مساحة جديدة
- ادخل عليها
- ارفع ملفاً

### Test 3: Invite join
- انسخ رابط دعوة
- افتحه من حساب آخر
- يجب أن تظهر بطاقة المعاينة ثم ينجح الانضمام بدون خطأ RLS

### Test 4: Comments
- افتح تفاصيل ملف
- أضف تعليقاً
- يجب أن يظهر فوراً

### Test 5: File versions
- افتح ملفاً
- ارفع نسخة جديدة
- يجب أن يظهر سجل النسخ

### Test 6: Notifications
- أضف تعليقاً أو ارفع ملفاً من مستخدم آخر داخل نفس المساحة
- يجب أن تظهر الإشعارات داخل التطبيق

### Test 7: Member management
- افتح تبويب الأعضاء
- غيّر دور عضو أو أزله حسب صلاحياتك
- يجب أن ينعكس التغيير مباشرة

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Email confirmation still required | Disable confirm email in Supabase auth settings |
| Sign-up blocked | Raise or disable sign-up rate limits |
| `infinite recursion detected in policy` | شغّل `001_init.sql` مرة أخرى — يستخدم دوال `SECURITY DEFINER` لكسر الحلقة |
| Invite join shows RLS error | شغّل `001_init.sql` (يحتوي على RPC `join_workspace_by_invite`) |
| Comments do not appear | تأكد أن `001_init.sql` نُفّذ بالكامل دون خطأ |
| Notifications do not appear | تأكد من تفعيل Realtime في مشروع Supabase |
| Upload fails | تحقق من bucket `workspace-files` ومن سياسات Storage |
| Workspace data not loading on Vercel | تأكد من متغيرات البيئة على Vercel |
| Member role update fails | شغّل `001_init.sql` مرة أخرى للتأكد من سياسات `members_update_owner_or_admin` |

---

## Final Checklist

- ✅ Supabase project created
- ✅ Auth settings adjusted
- ✅ `supabase/migrations/001_init.sql` executed successfully
- ✅ Vercel env vars added
- ✅ GitHub connected to Vercel
- ✅ Frontend deployed
- ✅ Supabase direct flow active
