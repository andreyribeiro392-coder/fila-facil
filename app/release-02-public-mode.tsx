"use client";

import { useEffect, useState } from "react";

const OFFICIAL_ORIGIN = "https://fila-facil-app-v5.vercel.app";

type BillingStatus = {
  ok?: boolean;
  loggedIn?: boolean;
  paid?: boolean;
  pending?: boolean;
  planType?: "cliente" | "barbearia";
  displayName?: string;
};

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

function patchPaymentTriggers() {
  document.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
    const label = (button.textContent || "").toLowerCase();
    const isCreate = label.includes("criar") || label.includes("cadastrar barbearia") || label.includes("finalizar cadastro");
    if (!isCreate || button.dataset.ff02PaymentPatched === "true") return;
    button.dataset.ff02PaymentPatched = "true";
    button.addEventListener("click", () => {
      const pageText = document.body.textContent?.toLowerCase() || "";
      const kind = label.includes("barbearia") || pageText.includes("proprietário") || pageText.includes("barbearia") ? "barbearia" : "cliente";
      window.setTimeout(() => { location.href = `/pagamento?tipo=${kind}`; }, 900);
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
  if (location.pathname.startsWith("/admin") || location.pathname.startsWith("/liberar")) return;
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

function freePath() {
  return ["/pagamento", "/liberar", "/suporte", "/privacidade", "/termos", "/como-funciona", "/planos", "/testes", "/lancamento"].some((path) => location.pathname.startsWith(path));
}

export default function Release02PublicMode() {
  const [online, setOnline] = useState(true);
  const [billing, setBilling] = useState<BillingStatus | null>(null);

  useEffect(() => {
    setOnline(navigator.onLine);
    const onOnline = () => { setOnline(true); publicToast("Conexão restaurada."); };
    const onOffline = () => { setOnline(false); publicToast("Sem internet. Algumas ações podem falhar.", "warn"); };
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    const originalWriteText = navigator.clipboard?.writeText?.bind(navigator.clipboard);
    if (originalWriteText) navigator.clipboard.writeText = (text: string) => originalWriteText(normalizeUrl(text));

    const originalShare = navigator.share?.bind(navigator);
    if (originalShare) navigator.share = (data?: ShareData) => originalShare(data?.url ? { ...data, url: normalizeUrl(data.url) } : data);

    const run = () => {
      patchPublicLinks();
      patchShareButtons();
      patchPaymentTriggers();
      patchServiceState();
      addHelpfulLinks();
    };

    const checkBilling = async () => {
      if (freePath()) return setBilling(null);
      try {
        const response = await fetch("/api/billing/status", { cache: "no-store" });
        const data = (await response.json()) as BillingStatus;
        setBilling(data);
      } catch {
        setBilling(null);
      }
    };

    run();
    void checkBilling();
    const interval = window.setInterval(() => { run(); void checkBilling(); }, 5000);

    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(interval);
      if (originalWriteText && navigator.clipboard) navigator.clipboard.writeText = originalWriteText;
      if (originalShare) navigator.share = originalShare;
    };
  }, []);

  if (!online) return <div className="ff02-offline">Sem internet. Confira sua conexão antes de entrar ou atualizar a fila.</div>;

  const shouldBlock = billing?.loggedIn && billing.paid === false;
  if (!shouldBlock) return null;

  const plan = billing.planType || "cliente";
  return (
    <div className="ff02-paywall">
      <div className="ff02-paywall-card">
        <span>Liberação pendente</span>
        <h2>{billing.pending ? "Pagamento aguardando autorização" : "Finalize o Pix para liberar"}</h2>
        <p>{billing.pending ? "Seu pedido já apareceu no painel. Aguarde a confirmação após conferência no banco." : "Para usar o Fila Fácil, faça o Pix e envie seu nome na tela de pagamento."}</p>
        <a className="primary" href={`/pagamento?tipo=${plan}`}>Abrir pagamento</a>
        <a className="secondary" href="/suporte">Suporte</a>
      </div>
    </div>
  );
}
