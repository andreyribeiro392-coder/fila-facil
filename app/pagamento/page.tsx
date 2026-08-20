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

type Account = { id: string; username: string; displayName: string; role: "client" | "owner" | "support" };
type SessionResponse = { ok?: boolean; account?: Account };
type RequestResponse = { ok?: boolean; error?: string; request?: { status?: string; id?: string } };

export default function PagamentoPage() {
  const [type, setType] = useState<"cliente" | "barbearia">("barbearia");
  const [account, setAccount] = useState<Account | null>(null);
  const [checkingAccount, setCheckingAccount] = useState(true);
  const [payerName, setPayerName] = useState("");
  const [copied, setCopied] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get("tipo");
    if (param === "cliente" || param === "barbearia") setType(param);

    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json()) as SessionResponse : null)
      .then((result) => {
        if (result?.account) {
          setAccount(result.account);
          setPayerName(result.account.displayName || "");
          setType(result.account.role === "owner" ? "barbearia" : "cliente");
        }
      })
      .catch(() => undefined)
      .finally(() => setCheckingAccount(false));
  }, []);

  const plan = plans[type];
  const qrUrl = useMemo(() => `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(plan.pixCopy)}`, [plan.pixCopy]);
  const roleMatchesPlan = account ? (type === "cliente" ? account.role === "client" : account.role === "owner") : false;

  async function copy(value: string, label: string) {
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(""), 2500);
  }

  async function sendPaymentNotice() {
    if (!account) {
      setMessage("Entre na sua conta do Fila Fácil antes de avisar o pagamento. É essa conta que será liberada.");
      return;
    }
    if (!roleMatchesPlan) {
      setMessage("O plano não combina com sua conta. Conta de cliente libera cliente; conta de proprietário libera barbearia.");
      return;
    }
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planType: type, payerName }),
      });
      const data = (await response.json()) as RequestResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível enviar o pedido.");
      setMessage("Pedido enviado. Agora ele aparecerá no painel de liberação como pendente.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao enviar o pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="ffv6 directoryV6 pixPage">
      <section className="panelHero compact">
        <span className="eyebrow">Pagamento Pix</span>
        <h1>{plan.title}</h1>
        <p>{plan.subtitle}</p>
        <div className="heroActions">
          <button className={type === "cliente" ? "primary" : "secondary"} disabled={account?.role === "owner"} onClick={() => setType("cliente")}>Cliente R$ 1,00</button>
          <button className={type === "barbearia" ? "primary" : "secondary"} disabled={account?.role === "client"} onClick={() => setType("barbearia")}>Barbearia R$ 6,99</button>
        </div>
      </section>

      <section className="pixCard accountLinkCard">
        <span className="eyebrow">Conta que será liberada</span>
        {checkingAccount && <p>Verificando login…</p>}
        {!checkingAccount && !account && (
          <>
            <strong>Você ainda não entrou na conta</strong>
            <p>Entre ou crie sua conta primeiro. Depois volte nesta tela e clique em “Já paguei”. Sem login, o painel não sabe qual conta liberar.</p>
            <a className="primary full" href="/" style={{ textDecoration: "none" }}>Entrar no Fila Fácil</a>
          </>
        )}
        {account && (
          <>
            <strong>{account.displayName}</strong>
            <p>@{account.username} • {account.role === "owner" ? "proprietário/barbearia" : "cliente"}</p>
          </>
        )}
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
        </div>
        {copied && <div className="pixCopied">{copied}</div>}
      </section>

      <section className="pixCard">
        <span className="eyebrow">Depois de pagar</span>
        <strong>Avise o pagamento</strong>
        <p>Digite o nome que aparece no banco/comprovante. O pedido vai cair no painel de liberação.</p>
        <label className="payLabel">
          Nome de quem pagou
          <input value={payerName} onChange={(event) => setPayerName(event.target.value)} placeholder="Ex: João Silva" maxLength={80} />
        </label>
        <button className="primary full" disabled={loading || checkingAccount || !account || !roleMatchesPlan || payerName.trim().length < 3} onClick={sendPaymentNotice}>
          {loading ? "Enviando…" : "Já paguei, enviar para liberação"}
        </button>
        {message && <div className="pixCopied">{message}</div>}
      </section>

      <section className="shopCardV6 planNotice">
        <strong>Importante</strong>
        <p>No app do banco pode aparecer o nome cadastrado da conta Pix por segurança do próprio banco. No Fila Fácil, fica visível apenas a Chave Aleatória.</p>
        <p>O acesso é liberado depois que o pagamento for conferido no painel administrativo.</p>
      </section>
    </main>
  );
}
