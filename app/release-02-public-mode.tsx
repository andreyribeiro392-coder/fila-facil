"use client";

import { useEffect, useState } from "react";

const OFFICIAL_ORIGIN = "https://fila-facil-app-v5.vercel.app";
const PIX_KEY = "f75fdf5a-d915-4f37-8f30-2a85e705a46b";
const PIX_COPY = "00020101021126580014br.gov.bcb.pix0136f75fdf5a-d915-4f37-8f30-2a85e705a46b5204000053039865802BR5921ANDREI RIBEIRO ARAUJO6013VARGEM GRANDE62070503***6304B031";
const PIX_QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(PIX_COPY)}`;

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

function openPixWindow(kind: "cliente" | "barbearia" | "geral" = "geral") {
  document.querySelector(".ff02-pix-overlay")?.remove();
  const isClient = kind === "cliente";
  const title = isClient ? "Acesso cliente" : "Ativar barbearia";
  const price = isClient ? "R$ 1,00" : "R$ 6,99";
  const detail = isClient ? "Acesso vitalício: paga uma vez e usa para sempre." : "Primeiro mês. Depois R$ 19,99 por mês para manter a barbearia ativa.";
  const overlay = document.createElement("div");
  overlay.className = "ff02-pix-overlay";
  overlay.innerHTML = `
    <div class="ff02-pix-modal" role="dialog" aria-modal="true" aria-label="Pagamento Pix">
      <button class="ff02-pix-close" type="button" aria-label="Fechar">×</button>
      <span>Pagamento Pix</span>
      <h2>${title}</h2>
      <strong>${price}</strong>
      <p>${detail}</p>
      <img src="${PIX_QR_URL}" alt="QR Code Pix Fila Fácil" />
      <small>Recebedor: ANDREI RIBEIRO ARAUJO</small>
      <code>${PIX_KEY}</code>
      <div class="ff02-pix-actions">
        <button class="primary" data-copy="pix">Copiar Pix copia e cola</button>
        <button class="secondary" data-copy="key">Copiar chave Pix</button>
        <a class="secondary" href="/suporte">Enviar comprovante</a>
      </div>
      <em>O QR Code não trava o valor. Confira o valor antes de pagar.</em>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.querySelector(".ff02-pix-close")?.addEventListener("click", () => overlay.remove());
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) overlay.remove();
  });
  overlay.querySelectorAll<HTMLButtonElement>("[data-copy]").forEach((button) => {
    button.addEventListener("click", async () => {
      const value = button.dataset.copy === "key" ? PIX_KEY : PIX_COPY;
      await navigator.clipboard.writeText(value);
      publicToast(button.dataset.copy === "key" ? "Chave Pix copiada." : "Pix copia e cola copiado.");
    });
  });
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

function patchPaymentTriggers() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const label = (button.textContent || "").toLowerCase();
    const isCreate = label.includes("criar") || label.includes("cadastrar barbearia") || label.includes("finalizar cadastro");
    if (!isCreate || button.dataset.ff02PaymentPatched === "true") return;
    button.dataset.ff02PaymentPatched = "true";
    button.addEventListener("click", () => {
      const pageText = document.body.textContent?.toLowerCase() || "";
      const kind = label.includes("barbearia") || pageText.includes("proprietário") || pageText.includes("barbearia") ? "barbearia" : "cliente";
      window.setTimeout(() => openPixWindow(kind), 900);
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
    <a href="/planos">Planos</a>
    <a href="/pagamento?tipo=barbearia">Pix</a>
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
      patchPaymentTriggers();
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
