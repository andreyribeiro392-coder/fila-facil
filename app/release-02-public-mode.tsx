"use client";

import { useEffect, useState } from "react";

const OFFICIAL_ORIGIN = "https://fila-facil-app-v5.vercel.app";

function normalizeUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.hostname.includes("fila-facil-app-v5") && url.hostname.endsWith(".vercel.app")) {
      return `${OFFICIAL_ORIGIN}${url.pathname}${url.search}${url.hash}`;
    }
  } catch {
    return value;
  }
  return value;
}

function publicToast(message: string, type: "ok" | "warn" = "ok") {
  const existing = document.querySelector(".ff02-toast");
  existing?.remove();
  const toast = document.createElement("div");
  toast.className = `ff02-toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  window.setTimeout(() => toast.remove(), 3600);
}

function patchPublicLinks() {
  document.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    link.href = normalizeUrl(link.href);
  });
}

function patchShareButtons() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const label = (button.textContent || "").toLowerCase();
    if (!label.includes("copiar") && !label.includes("compartilhar")) return;
    if (button.dataset.ff02Patched === "true") return;
    button.dataset.ff02Patched = "true";
    button.addEventListener("click", () => {
      window.setTimeout(() => publicToast("Link preparado no domínio oficial do Fila Fácil."), 200);
    });
  });
}

function patchServiceState() {
  document.querySelectorAll<HTMLSelectElement>("select").forEach((select) => {
    if (!(select.textContent || "").includes("Escolha o serviço")) return;
    const form = select.closest("form");
    if (!form) return;
    const hasService = select.querySelectorAll("option").length > 1;
    form.classList.toggle("ff02-no-service", !hasService);
  });
}

function addHelpfulLinks() {
  if (document.querySelector(".ff02-public-actions")) return;
  if (location.pathname.startsWith("/admin")) return;
  const box = document.createElement("nav");
  box.className = "ff02-public-actions";
  box.setAttribute("aria-label", "Links úteis do Fila Fácil");
  box.innerHTML = `
    <a href="/como-funciona">Como funciona</a>
    <a href="/suporte">Suporte</a>
    <a href="/privacidade">Privacidade</a>
  `;
  document.body.appendChild(box);
}

export default function Release02PublicMode() {
  const [online, setOnline] = useState(true);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); publicToast("Conexão restaurada."); };
    const onOffline = () => { setOnline(false); publicToast("Sem internet. Algumas ações podem falhar.", "warn"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (originalWriteText) {
      navigator.clipboard.writeText = (text: string) => originalWriteText(normalizeUrl(text));
    }

    const originalShare = navigator.share?.bind(navigator);
    if (originalShare) {
      navigator.share = (data?: ShareData) => originalShare(data?.url ? { ...data, url: normalizeUrl(data.url) } : data);
    }

    const run = () => {
      patchPublicLinks();
      patchShareButtons();
      patchServiceState();
      addHelpfulLinks();
    };
    run();
    const interval = window.setInterval(run, 1500);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
      if (originalWriteText && navigator.clipboard) navigator.clipboard.writeText = originalWriteText;
      if (originalShare) navigator.share = originalShare;
    };
  }, []);

  if (online) return null;
  return <div className="ff02-offline">Sem internet. Confira sua conexão antes de entrar ou atualizar a fila.</div>;
}
