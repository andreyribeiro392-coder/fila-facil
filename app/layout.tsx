import type { Metadata } from "next";
import CanonicalLinkPatch from "./canonical-link-patch";
import "./globals.css";
import "./admin.css";
import "./directory.css";
import "./client-simple.css";
import "./enhancements.css";
import "./security.css";
import "./privacy-fixes.css";

export const metadata: Metadata = {
  title: "Fila Fácil",
  description: "Filas seguras para barbearias verificadas.",
  applicationName: "Fila Fácil",
  appleWebApp: {
    capable: true,
    title: "Fila Fácil",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <head>
        <meta name="theme-color" content="#153b2a"/>
      </head>
      <body className="antialiased">
        <CanonicalLinkPatch />
        {children}
      </body>
    </html>
  );
}
