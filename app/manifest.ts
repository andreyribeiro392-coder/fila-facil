import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Fila Fácil",
    short_name: "Fila Fácil",
    description: "Organize filas de barbearias com serviços, GPS, cliente e painel do proprietário.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#07130e",
    theme_color: "#153b2a",
    orientation: "portrait",
    icons: [
      { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
    ],
    categories: ["business", "productivity", "utilities"],
    lang: "pt-BR",
  };
}
