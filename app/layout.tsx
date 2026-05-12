import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Condexia — Mi condominio",
  description: "Portal de residentes Condexia",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Condexia",
  },
};

export const viewport: Viewport = {
  themeColor: "#1B2E3C",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" className="h-full">
      <body className={`${inter.className} h-full bg-[#F8FAFC] antialiased`}>
        {children}
      </body>
    </html>
  );
}
