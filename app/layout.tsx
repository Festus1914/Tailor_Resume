import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Resume Tailor — AI-Powered Resume Matching",
  description:
    "Paste your resume and a job description to get an instantly tailored, ATS-optimized resume and cover letter.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="font-sans antialiased text-ink">{children}</body>
    </html>
  );
}
