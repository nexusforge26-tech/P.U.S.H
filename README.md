# PUSH — Palestine University Students Hub

منصة طلابية تجمع الملخصات والامتحانات والملفات وفيديوهات الشرح لطلاب الجامعات الفلسطينية، مع حسابات Google ومساهمات تتم مراجعتها قبل النشر.

## التقنية

- Next.js 14 (App Router) + TypeScript + Tailwind CSS
- Supabase Auth (PKCE Flow) + PostgreSQL + Row Level Security
- Google OAuth للحسابات
- رفع مباشر قابل للاستئناف (Resumable Upload) إلى Google Drive عبر REST API بدون مكتبات ضخمة
- Vercel للاستضافة

## إعداد Supabase

> **الهيكل: جامعة ← مساق ← منشورات (بدون كليات).**
> - قاعدة جديدة: نفّذ **كامل ملف `supabase/schema.sql`**.
> - قاعدة قائمة: نفّذ ملفات الترحيل في `supabase/migrations/` بالترتيب:
>   1. `supabase/migrations/2026-10-13-remove-faculties.sql` (إذا كانت القاعدة قديمة وتحتوي على جدول `faculties`)
>   2. `supabase/migrations/2026-10-15-security-and-features.sql` (لتحديثات الأمان، الفهارس، تطبيع البحث العربي، الإشعارات، والبلاغات)

لتعيين بريد المالك الأساسي في قاعدة البيانات أيضًا (اختياري بجانب متغير البيئة `OWNER_EMAIL`):

```sql
insert into public.app_settings(key, value)
values ('owner_email', 'your-owner-email@example.com')
on conflict (key) do update set value = excluded.value;
```

### تفعيل Google Auth

من لوحة تحكم Supabase:
1. Authentication → Providers → Google → فعّل Google.
2. أضف بيانات OAuth الخاصة بتطبيق Google.
3. أضف رابط إعادة التوجيه الخاص بالمشروع:
   - في الإنتاج: `https://YOUR-DOMAIN.com/auth/callback`
   - محليًا: `http://localhost:3000/auth/callback`

## متغيرات البيئة

انسخ ملف `.env.example` إلى `.env.local` واضبط المتغيرات التالية:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOi...

# بريد المالك الأساسي للمنصة (أو عدة عناوين مفصولة بفاصلة)
OWNER_EMAIL=your-owner-email@example.com

# رابط الموقع العام (لـ Sitemap و OpenGraph)
NEXT_PUBLIC_SITE_URL=https://your-domain.vercel.app

# Google Drive (موصى باستخدام OAuth 2.0 مع حساب Google شخصي)
GOOGLE_DRIVE_FOLDER_ID=1AbCDEfGhIjKlMnOpQrStUvWxYz
GOOGLE_OAUTH_CLIENT_ID=...
GOOGLE_OAUTH_CLIENT_SECRET=...
GOOGLE_OAUTH_REFRESH_TOKEN=...
```

> **ملاحظة مهمة حول Google Drive:**
> حسابات الخدمة (`Service Account`) لا تملك مساحة تخزين خاصة ولا تعمل إلا مع **Shared Drives** المدفوعة في Google Workspace. لذلك إذا كنت تستخدم حساب Google Drive شخصيًا عاديًا (15 جيجابايت)، استخدم متغيرات `GOOGLE_OAUTH_*` الثلاثة كما هو مشروح في `.env.example`.

## أبرز ميزات الأمان وجودة المحتوى

- **التحقق الصارم من الروابط (`validateLink`)**: قبول روابط `https://` الموثوقة فقط ومنع `javascript:` و`data:` والروابط المحلية في كل مسارات الإدخال والعرض.
- **حماية رفع الملفات**: قائمة سماح للامتدادات والـ MIME Types الأكاديمية (PDF، Office، الصور، والملفات المضغوطة) مع فحص نوع الملف الفعلي من Google Drive عند الإنهاء وحذف أي ملف مخالف أو مرفوض تلقائيًا.
- **استئناف الرفع التلقائي**: حفظ جلسة الرفع في `localStorage` لاستئناف رفع الملفات الكبيرة من نفس النقطة حتى بعد إغلاق الصفحة.
- **مراجعة غنية وذرّية (Atomic Review)**: معاينة مدمجة للملف والفيديو في لوحة الإدارة، كشف تلقائي لتكرار العناوين، إمكانية تعديل البيانات قبل القبول، قبول جماعي، وأسباب رفض جاهزة مع إرسال إشعارات فورية للمساهم.
- **حماية ما بعد القبول**: يستطيع صاحب المادة خلال 6 ساعات تعديل العنوان والوصف مباشرة، بينما يتحول أي تغيير في رابط الملف إلى «تعديل معلّق» يمر بمراجعة الإدارة.

## تشغيل المشروع والاختبارات

```bash
npm install
npm run dev
```

لتشغيل اختبارات الوحدات (Unit Tests):

```bash
npm test
```

## النشر على Vercel

عند نشر المشروع على Vercel، أضف **جميع** متغيرات البيئة التالية في إعدادات المشروع (Environment Variables):
1. متغيرات Supabase الثلاثة (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`).
2. متغير بريد المالك (`OWNER_EMAIL`) ورابط الموقع (`NEXT_PUBLIC_SITE_URL`).
3. متغيرات Google Drive (`GOOGLE_DRIVE_FOLDER_ID` مع ثلاثي `GOOGLE_OAUTH_CLIENT_ID` و`GOOGLE_OAUTH_CLIENT_SECRET` و`GOOGLE_OAUTH_REFRESH_TOKEN`).
4. تأكد من إضافة رابط `https://YOUR-VERCEL-DOMAIN.vercel.app/auth/callback` في إعدادات Supabase Redirect URLs.
