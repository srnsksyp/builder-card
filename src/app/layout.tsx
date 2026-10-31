import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Builder Card",
  description: "Turn any GitHub username into a one-page developer profile.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
