import type { Metadata } from "next";
import CanonicalLinkPatch from "./canonical-link-patch";
import Release02PublicMode from "./release-02-public-mode";
import "./globals.css";
import "./admin.css";
import "./directory.css";
import "./client-simple.css";
import "./enhancements.css";
import "./security.css";
import "./privacy-fixes.css";
import "./release-02.css";
import "./planos.css";

export const metadata: Metadata = {
  title: "Fila Fácil 0.2",
  description: "App para organizar filas de barbearias verificadas, com cliente, serviços, GPS, fila e painel do proprietário.",
  applicationName: "Fila Fácil",
  manifest: "/manifest.webmanifest",
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
        <meta name="mobile-web-app-capable" content="yes"/>
      </head>
      <body className="antialiased">
        <CanonicalLinkPatch />
        <Release02PublicMode />
        {children}
      </body>
    </html>
  );
}
