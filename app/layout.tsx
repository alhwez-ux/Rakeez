import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import Script from "next/script";
import AppearanceBoot from "@/components/AppearanceBoot";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ركيز | تسجيل الدخول",
  description: "المنظومة التنظيمية والتشغيلية للمدارس",
  icons: { icon: "/rakeez-logo.png" },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cairo.variable}>
      <body className="font-sans antialiased">
        <Script id="rakeez-appearance" strategy="beforeInteractive">
          {`(function(){try{var raw=localStorage.getItem("rakeez-appearance");if(!raw)return;var p=JSON.parse(raw);var themes={blue:1,emerald:1,indigo:1,tiffany:1,cumin:1,pink:1};var bgs={light:1,modern:1};if(themes[p.themeColor])document.documentElement.dataset.theme=p.themeColor;if(bgs[p.bgStyle])document.documentElement.dataset.bg=p.bgStyle;}catch(e){}})();`}
        </Script>
        <AppearanceBoot />
        {children}
      </body>
    </html>
  );
}
