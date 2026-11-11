import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lightline",
  description: "Every caller answered, every lead kept.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f7f9" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e11" },
  ],
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // The console's light/dark switch (app/_components/client.tsx) remembers its choice in this cookie;
  // without one the page follows the device.
  const theme = (await cookies()).get("ll-theme")?.value;
  return (
    <html lang="en" data-theme={theme === "light" || theme === "dark" ? theme : undefined}>
      <body>{children}</body>
    </html>
  );
}
