import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SAFEPATH — Inclusive Disaster Evacuation Router",
  description:
    "Deterministic life-safety evacuation routing engine paired with a constrained Gemini explanation layer.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full">
      <body className="h-full bg-[#0a0d12] text-slate-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
