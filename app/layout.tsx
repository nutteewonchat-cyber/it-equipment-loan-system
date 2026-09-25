import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "IT Borrow | ระบบยืม-คืนอุปกรณ์ไอที",
  description: "จัดการคำขอยืม อนุมัติ คืน และติดตามอุปกรณ์ไอทีในที่เดียว",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="th"><body>{children}</body></html>;
}
