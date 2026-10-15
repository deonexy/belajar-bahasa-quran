import type { Metadata, Viewport } from "next";
import "./globals.css";
import RegisterSW from "@/components/register-sw";

export const metadata: Metadata = {
  title: "Belajar Bahasa Al-Qur'an",
  description: "Belajar memahami bahasa Al-Qur'an sedikit demi sedikit, dengan pengulangan terjadwal.",
  appleWebApp: { capable: true, title: "Bahasa Qur'an", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#047857",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id">
      <body className="min-h-screen antialiased">
        {children}
        <RegisterSW />
      </body>
    </html>
  );
}
