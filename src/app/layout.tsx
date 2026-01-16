import type { Metadata } from "next";
import { Fraunces, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Providers from "./providers";

const fontSans = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-sans"
});

const fontDisplay = Fraunces({
  subsets: ["latin"],
  variable: "--font-display"
});

export const metadata: Metadata = {
  title: "SSDF Assessment",
  description: "Avaliacoes NIST SSDF 800-218 para empresas"
};

export default function RootLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR">
      <body className={`${fontSans.variable} ${fontDisplay.variable} font-sans`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
