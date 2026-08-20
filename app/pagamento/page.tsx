"use client";

import { useEffect, useMemo, useState } from "react";

const PIX_KEY = "f75fdf5a-d915-4f37-8f30-2a85e705a46b";
const PIX_COPY = "00020101021126580014br.gov.bcb.pix0136f75fdf5a-d915-4f37-8f30-2a85e705a46b5204000053039865802BR5921ANDREI RIBEIRO ARAUJO6013VARGEM GRANDE62070503***6304B031";

const plans = {
  cliente: {
    title: "Acesso Cliente",
    price: "R$ 1,00",
    subtitle: "Acesso vitalício: paga uma vez e usa para sempre.",
    note: "Use este valor para liberar seu acesso de cliente no Fila Fácil.",
  },
  barbearia: {
    title: "Plano Barbearia",
    price: "R$ 6,99",
    subtitle: "Primeiro mês promocional. Depois R$ 19,99/mês.",
    note: "Use este valor para ativar sua barbearia no primeiro mês.",
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
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(PIX_COPY)}`, []);

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
          <img src={qrUrl} alt="QR Code Pix do Fila Fácil" />
        </div>
        <div className="pixInfo">
          <span>Recebedor</span>
          <strong>ANDREI RIBEIRO ARAUJO</strong>
          <span>Chave Pix</span>
          <code>{PIX_KEY}</code>
        </div>
        <div className="pixButtons">
          <button className="primary" onClick={() => copy(PIX_COPY, "Pix copia e cola copiado")}>Copiar Pix copia e cola</button>
          <button className="secondary" onClick={() => copy(PIX_KEY, "Chave Pix copiada")}>Copiar chave Pix</button>
          <a className="secondary" href="/suporte" style={{ textDecoration: "none" }}>Enviar comprovante</a>
        </div>
        {copied && <div className="pixCopied">{copied}</div>}
      </section>

      <section className="shopCardV6 planNotice">
        <strong>Importante</strong>
        <p>O QR Code Pix não trava o valor automaticamente. Na hora de pagar, confira o valor correto: cliente R$ 1,00; barbearia R$ 6,99 no primeiro mês.</p>
        <p>Depois do pagamento, envie o comprovante pelo suporte para ativação/liberação manual enquanto a cobrança automática ainda não está integrada.</p>
      </section>
    </main>
  );
}
