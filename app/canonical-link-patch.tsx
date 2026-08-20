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

function patchPrivateWording() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const replacements: Array<[RegExp, string]> = [
    [/Fila ao vivo/g, "Fila da barbearia"],
    [/clientes online/gi, "clientes na fila"],
    [/do mundo todo/gi, "da barbearia"],
    [/online ao vivo/gi, "na fila"],
  ];
  let node = walker.nextNode();
  while (node) {
    let text = node.textContent || "";
    for (const [from, to] of replacements) text = text.replace(from, to);
    if (node.textContent !== text) node.textContent = text;
    node = walker.nextNode();
  }
}

function patchServiceSelect() {
  const selects = Array.from(document.querySelectorAll("select"));
  for (const select of selects) {
    const text = select.textContent || "";
    if (!text.includes("Escolha o serviço")) continue;
    const form = select.closest("form") || select.parentElement;
    if (!form) continue;
    const hasRealService = select.querySelectorAll("option").length > 1;
    let alert = form.querySelector<HTMLDivElement>(".service-missing-alert");
    if (hasRealService) {
      alert?.remove();
      continue;
    }
    if (!alert) {
      alert = document.createElement("div");
      alert.className = "notice service-missing-alert";
      alert.textContent = "Esta barbearia ainda não tem serviços cadastrados. Entre no painel da barbearia e adicione Corte, Barba ou Corte + barba, ou rode o SQL de serviços padrão.";
      const label = select.closest("label");
      label?.after(alert);
    }
    const submit = form.querySelector<HTMLButtonElement>("button[type='submit'], button:not([type])");
    if (submit && submit.textContent?.includes("Entrar")) {
      submit.disabled = true;
      submit.title = "Cadastre pelo menos um serviço antes de liberar a fila.";
    }
  }
}

function patchCanonicalLinks() {
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    anchor.href = normalizeFilaFacilUrl(anchor.href);
  });
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

    const apply = () => {
      patchPrivateWording();
      patchServiceSelect();
      patchCanonicalLinks();
    };
    apply();
    const interval = window.setInterval(apply, 1200);

    return () => {
      window.clearInterval(interval);
      if (originalWriteText && clipboard) clipboard.writeText = originalWriteText;
      if (originalShare) navigator.share = originalShare;
    };
  }, []);

  return null;
}
