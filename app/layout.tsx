import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import localFont from "next/font/local";
import "./globals.css";

export const metadata: Metadata = {
  title: "Vanishoot | Vanitas Arcade",
  description: "Vanitas Arcade의 첫 번째 미니게임, Vanishoot.",
};

const clerkKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
const galmuri = localFont({
  src: [
    { path: "../fonts/Galmuri11.woff2", weight: "400" },
    { path: "../fonts/Galmuri11-Bold.woff2", weight: "700" },
  ],
  variable: "--font-galmuri",
  display: "swap",
});

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const shell = (
    <html lang="ko" className={galmuri.variable}>
      <body>{children}</body>
    </html>
  );

  if (!clerkKey) {
    return shell;
  }

  return (
    <ClerkProvider publishableKey={clerkKey}>
      <html lang="ko" className={galmuri.variable}>
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
