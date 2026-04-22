import type { Metadata } from "next";
import { Manrope, Noto_Serif } from "next/font/google";

import "./globals.css";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-sans"
});

const notoSerif = Noto_Serif({
  subsets: ["latin"],
  variable: "--font-serif"
});

export const metadata: Metadata = {
  title: "Otto Web",
  description: "The Digital Talisman control center for Otto robot"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
      </head>
      <body className={`${manrope.variable} ${notoSerif.variable} bg-surface text-on-surface antialiased`}>
        {children}
      </body>
    </html>
  );
}
