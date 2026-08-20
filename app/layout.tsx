import type { Metadata } from "next";
import "./globals.css";
import "./admin.css";
import "./directory.css";
import "./client-simple.css";
import "./enhancements.css";

export const metadata: Metadata = {
  title: "Fila Fácil",
  description: "Acompanhe a fila da sua barbearia ao vivo e entre sem complicação.",
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
      <body className="antialiased">{children}</body>
    </html>
  );
}
