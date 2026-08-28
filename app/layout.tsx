import type { Metadata } from 'next';
import { Oswald, Inter, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const oswald = Oswald({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['500', '600', '700'],
});

const inter = Inter({
  variable: '--font-body',
  subsets: ['latin'],
});

const mono = JetBrains_Mono({
  variable: '--font-mono-club',
  subsets: ['latin'],
  weight: ['500', '700'],
});

export const metadata: Metadata = {
  title: '레슨 시간표',
  description: '동호회 레슨 시간표',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body
        className={`${oswald.variable} ${inter.variable} ${mono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
