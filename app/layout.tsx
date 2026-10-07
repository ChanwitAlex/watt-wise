import type { Metadata } from "next";
import { DisclaimerBar } from "@/components/ui/DisclaimerBar";
import { SITE_NAME } from "@/lib/config/site";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: SITE_NAME, template: `%s · ${SITE_NAME}` },
  description: "ต้นแบบเพื่อการเรียนรู้: วิเคราะห์ความเสี่ยงไฟดับและการใช้ไฟฟ้าจากข้อมูลตัวอย่าง",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font -- โหลดฟอนต์ทั้งเว็บจาก root layout */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Mali:wght@500;600;700&family=Noto+Sans+Thai+Looped:wght@400;500;600&display=swap"
        />
      </head>
      <body>
        <DisclaimerBar />
        {children}
      </body>
    </html>
  );
}
