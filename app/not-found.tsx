import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-5 py-24 text-center">
      <p className="font-display text-6xl text-olive/30">٤٠٤</p>
      <h1 className="mt-4 font-display text-2xl text-olive-dark">لم يتم العثور على هذه الصفحة</h1>
      <p className="mt-2 text-ink/60">ربما تم حذف المادة أو أن الرابط غير صحيح.</p>
      <Link
        href="/browse"
        className="mt-6 inline-flex rounded-full bg-olive px-5 py-2.5 text-sm text-parchment hover:bg-olive-dark"
      >
        العودة إلى المكتبة
      </Link>
    </div>
  );
}
