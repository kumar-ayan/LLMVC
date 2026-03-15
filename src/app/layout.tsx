import type { Metadata } from "next";
import "./globals.css";
import Link from "next/link";

export const metadata: Metadata = {
  title: "PromptVC — Version Control for LLM Prompts",
  description:
    "Save, version, diff, evaluate, and rollback your LLM prompts with LLM-as-judge scoring.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <div className="app-layout">
          <header className="app-header">
            <Link href="/" className="app-logo">
              <div className="app-logo-icon">P</div>
              <div className="app-logo-text">
                Prompt<span>VC</span>
              </div>
            </Link>
            <nav className="app-nav">
              <Link href="/">Prompts</Link>
              <Link href="/settings">Settings</Link>
            </nav>
          </header>
          <main className="app-main">{children}</main>
        </div>
      </body>
    </html>
  );
}
