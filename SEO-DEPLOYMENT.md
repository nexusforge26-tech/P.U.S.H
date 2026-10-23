# إعدادات الفهرسة لمنصة PUSH

يتضمن هذا الإصدار بيانات وصفية عربية، روابط canonical صحيحة، شعار المشاركة، ملف robots.txt، وخريطة موقع تشمل المواد المنشورة على دفعات، مع منع فهرسة صفحات الحساب والإدارة وتسجيل الدخول والإرسال.

## النشر

في مشروع Vercel المرتبط، تم ضبط `NEXT_PUBLIC_SITE_URL` على `https://p-u-s-h-liard.vercel.app` لبيئة Production. بعد نشر هذا المصدر تحقق من:

- `https://p-u-s-h-liard.vercel.app/robots.txt`
- `https://p-u-s-h-liard.vercel.app/sitemap.xml`

يجب أن تستخدم كل روابط الخريطة النطاق `p-u-s-h-liard.vercel.app`.

## Google Search Console

بعد أن يصبح التحديث متاحًا، أضف خاصية URL prefix التالية إلى Search Console وأكمل إثبات الملكية:

`https://p-u-s-h-liard.vercel.app/`

ثم أرسل خريطة الموقع:

`https://p-u-s-h-liard.vercel.app/sitemap.xml`

يمكن استخدام فحص URL لطلب إعادة الزحف للصفحة الرئيسية والصفحات العامة الأساسية. الفهرسة والترتيب يخضعان لقرار Google ولا يمكن ضمانهما أو تحديد موعدهما.
