"use client";

import { useEffect, useMemo, useState } from "react";

const PIX_KEY = "f75fdf5a-d915-4f37-8f30-2a85e705a46b";

const plans = {
  cliente: {
    title: "Acesso Cliente",
    price: "R$ 1,00",
    subtitle: "Acesso vitalício: paga uma vez e usa para sempre.",
    note: "Use este Pix de R$ 1,00 para liberar seu acesso de cliente no Fila Fácil.",
    pixCopy: "00020101021126580014br.gov.bcb.pix0136f75fdf5a-d915-4f37-8f30-2a85e705a46b52040000530398654041.005802BR5915ANDREI R ARAUJO6013VARGEM GRANDE62070503***63042336",
  },
  barbearia: {
    title: "Plano Barbearia",
    price: "R$ 6,99",
    subtitle: "Primeiro mês promocional. Depois R$ 19,99/mês.",
    note: "Use este Pix de R$ 6,99 para ativar sua barbearia no primeiro mês.",
    pixCopy: "00020101021126580014br.gov.bcb.pix0136f75fdf5a-d915-4f37-8f30-2a85e705a46b52040000530398654046.995802BR5915ANDREI R ARAUJO6013VARGEM GRANDE62070503***63040D6E",
  },
};

export default function PagamentoPage() {
  const [type, setType] = useState<"cliente" | "barbearia">("barbearia");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tipo");
    if (param === "cliente" || param === "barbearia") setType(param);
  }, []);

  const plan = plans[type];
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(plan.pixCopy)}`, [plan.pixCopy]);

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 2500);
  }

  return (
    <main className="ffv6 directoryV6 pixPage">
      <section className="panelHero compact">
        <span className="eyebrow">Pagamento Pix</span>
        <h1>{plan.title}</h1>
        <p>{plan.subtitle}</p>
        <div className="heroActions">
          <button className={type === "cliente" ? "primary" : "secondary"} onClick={() => setType("cliente")}>Cliente R$ 1,00</button>
          <button className={type === "barbearia" ? "primary" : "secondary"} onClick={() => setType("barbearia")}>Barbearia R$ 6,99</button>
        </div>
      </section>

      <section className="pixCard">
        <span className="eyebrow">Valor</span>
        <strong className="pixPrice">{plan.price}</strong>
        <p>{plan.note}</p>
        <div className="pixQrBox">
          <img src={qrUrl} alt={`QR Code Pix ${plan.price}`} />
        </div>
        <div className="pixInfo">
          <span>Chave Aleatória</span>
          <code>{PIX_KEY}</code>
        </div>
        <div className="pixButtons">
          <button className="primary" onClick={() => copy(plan.pixCopy, "Pix copia e cola copiado")}>Copiar Pix copia e cola</button>
          <button className="secondary" onClick={() => copy(PIX_KEY, "Chave Pix copiada")}>Copiar chave Pix</button>
          <a className="secondary" href="/suporte" style={{ textDecoration: "none" }}>Enviar comprovante</a>
        </div>
        {copied && <div className="pixCopied">{copied}</div>}
      </section>

      <section className="shopCardV6 planNotice">
        <strong>Importante</strong>
        <p>No app do banco pode aparecer o nome cadastrado da conta Pix por segurança do próprio banco. No Fila Fácil, fica visível apenas a Chave Aleatória.</p>
        <p>Depois do pagamento, envie o comprovante pelo suporte para ativação/liberação manual enquanto a cobrança automática ainda não está integrada.</p>
      </section>
    </main>
  );
}
