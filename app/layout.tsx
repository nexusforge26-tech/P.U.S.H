import type { Metadata } from "next";
import { Amiri, Tajawal } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import ProfileGate from "@/components/ProfileGate";

const amiri = Amiri({
  subsets: ["arabic"],
  weight: ["400", "700"],
  variable: "--font-amiri",
  display: "swap",
});

const tajawal = Tajawal({
  subsets: ["arabic"],
  weight: ["300", "400", "500", "700", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://p-u-s-h-liard.vercel.app"),
  title: { default: "PUSH | مكتبة طلاب الجامعات الفلسطينية", template: "%s | PUSH" },
  description:
    "مكتبة طلابية فلسطينية مجانية للملخصات والامتحانات السابقة والمواد التعليمية، مرتبة حسب الجامعة والمساق لتسهيل الدراسة والوصول إلى المعرفة.",
  keywords: [
    "طلاب الجامعات الفلسطينية",
    "ملخصات جامعية",
    "امتحانات سابقة",
    "مواد تعليمية",
    "مساقات جامعية",
    "مكتبة طلابية",
  ],
  openGraph: {
    title: "PUSH | مكتبة طلاب الجامعات الفلسطينية",
    description: "ملخصات جامعية وامتحانات سابقة ومواد تعليمية مجانية، مرتبة حسب الجامعة والمساق.",
    type: "website",
    locale: "ar_PS",
    siteName: "PUSH",
    images: [{ url: "/push-logo.jpg", width: 2048, height: 2048, alt: "شعار منصة PUSH" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "PUSH | مكتبة طلاب الجامعات الفلسطينية",
    description: "ملخصات جامعية وامتحانات سابقة ومواد تعليمية مجانية لطلاب الجامعات الفلسطينية.",
    images: ["/push-logo.jpg"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" className={`${amiri.variable} ${tajawal.variable}`}>
      <body className="font-body">
        <AuthProvider>
          <div id="app-shell">
            <Header />
            <main className="min-h-[70vh]">{children}</main>
            <Footer />
          </div>
          <ProfileGate />
        </AuthProvider>
      </body>
    </html>
  );
}
