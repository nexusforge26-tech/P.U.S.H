import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "شروط الاستخدام والخصوصية وحقوق النشر",
  description:
    "اقرأ شروط استخدام منصة PUSH الطلابية وسياسة الخصوصية وحقوق الملكية الفكرية وآلية الإبلاغ عن المحتوى.",
  alternates: { canonical: "/terms" },
};

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-[#f7f5ef] px-5 py-12 sm:px-8">
      <div className="mx-auto max-w-4xl rounded-[32px] border border-olive/10 bg-white p-7 shadow-soft sm:p-12">
        <span className="text-xs font-black tracking-widest text-clay">PUSH · LEGAL</span>
        <h1 className="mt-2 font-display text-3xl font-bold text-olive-dark sm:text-4xl">
          شروط الاستخدام والخصوصية وسياسة إزالة المحتوى
        </h1>
        <p className="mt-3 text-sm leading-7 text-ink/60">
          منصة PUSH (Palestine University Students Hub) هي مبادرة طلابية تطوعية غير ربحية تهدف إلى
          تسهيل وصول طلبة الجامعات الفلسطينية إلى الملخصات والامتحانات السابقة والمراجع التعليمية.
        </p>

        <div className="mt-8 space-y-8 text-sm leading-8 text-ink/80">
          <section>
            <h2 className="font-display text-2xl font-bold text-olive-dark">
              1. شروط المساهمة ورفع المواد
            </h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                يتعهّد المساهم بأن الملفات أو الروابط التي يرسلها هي لأغراض تعليمية وأكاديمية بحتة،
                وخالية من أي برمجيات ضارة أو محتوى مسيء.
              </li>
              <li>
                تخضع كافة المساهمات (المواد، اقتراحات المساقات، ومعلومات الدكاترة) لمراجعة الإدارة
                قبل نشرها للعامة، وللإدارة الحق في تعديل العنوان أو رفض المساهمة.
              </li>
              <li>
                يُمنع رفع امتحانات حالية سرية أو مواد يُحظر نشرها صراحةً من قِبل الجهة الأكاديمية أو
                صاحب الحقوق.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-olive-dark">2. سياسة الخصوصية</h2>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                تصفح المكتبة وتنزيل المواد متاح لجميع الزوار دون الحاجة لإنشاء حساب أو تسجيل دخول.
              </li>
              <li>
                عند تسجيل الدخول عبر Google للمساهمة بالمحتوى، نحفظ فقط الاسم وعنوان البريد
                الإلكتروني وصورة الملف الشخصي لربط المساهمات بصاحبها وإشعاره بحالة المراجعة.
              </li>
              <li>
                لا نشارك بيانات المستخدمين مع أي طرف ثالث لأغراض تجارية أو إعلانية.
              </li>
              <li>
                معلومات أعضاء الهيئة التدريسية في قسم «الدكاترة» تقتصر على وسائل التواصل الأكاديمية
                الرسمية (البريد الجامعي، المكتب، والمساقات).
              </li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-2xl font-bold text-olive-dark">
              3. حقوق الملكية الفكرية وسياسة إزالة المحتوى (Takedown Policy)
            </h2>
            <p className="mt-3">
              تحترم منصة PUSH حقوق الملكية الفكرية للمؤلفين وأعضاء الهيئة التدريسية والجامعات. إذا
              كنت صاحب حق (أو مخولًا بتمثيله) وترى أن مادة منشورة على المنصة تنتهك حقوق النشر أو تم
              نشرها دون إذن:
            </p>
            <ul className="mt-3 list-inside list-disc space-y-2">
              <li>
                يمكنك الضغط مباشرة على زر <strong>«أبلغ عن مشكلة ⚑»</strong> الموجود داخل صفحة المادة
                واختيار «انتهاك حقوق نشر أو ملكية فكرية» مع توضيح صفتك.
              </li>
              <li>
                تلتزم إدارة المنصة بمراجعة البلاغات القانونية والأكاديمية وإزالة الملف من المكتبة
                ومن تخزين Google Drive خلال 24–48 ساعة من التحقق من البلاغ.
              </li>
            </ul>
          </section>
        </div>

        <div className="mt-10 border-t border-olive/10 pt-6">
          <Link
            href="/"
            className="inline-flex rounded-full bg-olive px-6 py-3 text-xs font-bold text-parchment hover:bg-olive-dark"
          >
            ← العودة إلى الصفحة الرئيسية
          </Link>
        </div>
      </div>
    </main>
  );
}
