import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "BLUEMAP",
  description: "블루맵 나라장터 공고 큐레이션"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body>
        <main className="shell">
          <header className="topbar">
            <a className="brand" href="/" aria-label="BLUEMAP 홈">
              <h1>BLUEMAP 되나</h1>
            </a>
          </header>
          {children}
        </main>
      </body>
    </html>
  );
}
