import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/auth-context";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "IMS - Inventory Management System",
  description: "IMS Inventory and Party Ledger Management System",
  applicationName: "IMS",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "IMS" },
  icons: {
    icon: [
      { url: "/icon/16%20ims%20logo.png", sizes: "16x16", type: "image/png" },
      { url: "/icon/32%20ims%20logo.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/icon/180%20ims%20logo.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#044d73",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
         <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}