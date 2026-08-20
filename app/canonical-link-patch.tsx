"use client";

import { useEffect } from "react";

const CANONICAL_ORIGIN = "https://fila-facil-app-v5.vercel.app";

function normalizeFilaFacilUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("fila-facil-app-v5") && url.hostname.endsWith(".vercel.app")) {
      return `${CANONICAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return value;
  }
  return value;
}

export default function CanonicalLinkPatch() {
  useEffect(() => {
    if (typeof navigator === "undefined") return;

    const clipboard = navigator.clipboard;
    const originalWriteText = clipboard?.writeText?.bind(clipboard);
    if (originalWriteText) {
      clipboard.writeText = (text: string) => originalWriteText(normalizeFilaFacilUrl(text));
    }

    const originalShare = navigator.share?.bind(navigator);
    if (originalShare) {
      navigator.share = (data?: ShareData) => {
        const next = data?.url ? { ...data, url: normalizeFilaFacilUrl(data.url) } : data;
        return originalShare(next);
      };
    }

    return () => {
      if (originalWriteText && clipboard) clipboard.writeText = originalWriteText;
      if (originalShare) navigator.share = originalShare;
    };
  }, []);

  return null;
}
