"use client";

import { useEffect, useMemo, useState } from "react";

type Payment = {
  id: string;
  payer_name: string;
  plan_type: "cliente" | "barbearia";
  amount: number;
  status: "pending" | "approved" | "denied";
  created_at: string;
  reviewed_at?: string | null;
  account?: { username: string; display_name: string; role: string; payment_status?: string; paid_until?: string | null; lifetime_access?: boolean } | null;
};

type ListResponse = { ok?: boolean; error?: string; setup?: boolean; payments?: Payment[] };

export default function LiberarPage() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "denied" | "all">("pending");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("ff_admin_pin") || "";
    if (saved) {
      setPin(saved);
      void load(saved);
    }
  }, []);

  const visible = useMemo(() => payments.filter((item) => status === "all" || item.status === status), [payments, status]);
  const counts = useMemo(() => ({
    pending: payments.filter((item) => item.status === "pending").length,
    approved: payments.filter((item) => item.status === "approved").length,
    denied: payments.filter((item) => item.status === "denied").length,
  }), [payments]);

  async function load(currentPin = pin) {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/admin", { headers: { "x-admin-pin": currentPin }, cache: "no-store" });
      const data = (await response.json()) as ListResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível carregar.");
      setPayments(data.payments || []);
      localStorage.setItem("ff_admin_pin", currentPin);
      setMessage("Pedidos carregados.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao carregar pedidos.");
    } finally {
      setLoading(false);
    }
  }

  async function review(requestId: string, action: "approved" | "denied") {
    setLoading(true);
    setMessage("");
    try {
      const response = await fetch("/api/payments/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin, requestId, action }),
      });
      const data = (await response.json()) as ListResponse;
      if (!response.ok || !data.ok) throw new Error(data.error || "Não foi possível revisar.");
      setMessage(action === "approved" ? "Acesso autorizado." : "Pedido negado.");
      await load(pin);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Erro ao revisar pedido.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="ffv6 directoryV6 liberarPage">
      <section className="panelHero compact">
        <span className="eyebrow">Painel simples</span>
        <h1>Liberar pagamentos</h1>
        <p>Use pelo celular para conferir Pix no banco e autorizar cliente ou barbearia.</p>
      </section>

      <section className="pixCard">
        <label className="payLabel">
          PIN administrativo
          <input value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Digite seu PIN" type="password" />
        </label>
        <div className="pixButtons">
          <button className="primary" disabled={loading || pin.length < 6} onClick={() => void load(pin)}>{loading ? "Carregando…" : "Entrar / atualizar"}</button>
          <button className="secondary" onClick={() => { localStorage.removeItem("ff_admin_pin"); setPin(""); }}>Limpar PIN</button>
        </div>
        {message && <div className="pixCopied">{message}</div>}
      </section>

      <section className="overviewGrid">
        <article onClick={() => setStatus("pending")}><b>{counts.pending}</b><span>Pendentes</span></article>
        <article onClick={() => setStatus("approved")}><b>{counts.approved}</b><span>Autorizados</span></article>
        <article onClick={() => setStatus("denied")}><b>{counts.denied}</b><span>Negados</span></article>
      </section>

      <section className="settingsV6">
        <button onClick={() => setStatus("pending")}>Pendentes</button>
        <button onClick={() => setStatus("approved")}>Autorizados</button>
        <button onClick={() => setStatus("denied")}>Negados</button>
        <button onClick={() => setStatus("all")}>Todos</button>
      </section>

      <section className="shopListV6">
        {visible.length === 0 && <article className="shopCardV6"><strong>Nenhum pedido nesta lista.</strong><span>Quando alguém avisar o pagamento, aparece aqui.</span></article>}
        {visible.map((payment) => (
          <article className="shopCardV6 paymentAdminCard" key={payment.id}>
            <div className="shopMain" style={{ pointerEvents: "none" }}>
              <div className="shopAvatarV6">{payment.plan_type === "cliente" ? "C" : "B"}</div>
              <div>
                <strong>{payment.payer_name}</strong>
                <span>{payment.plan_type === "cliente" ? "Cliente vitalício" : "Barbearia primeiro mês"} • R$ {Number(payment.amount).toFixed(2).replace(".", ",")}</span>
                <span>Conta: {payment.account?.display_name || "sem nome"} • @{payment.account?.username || "sem usuário"}</span>
                <span>{new Date(payment.created_at).toLocaleString("pt-BR")}</span>
              </div>
              <i className={payment.status === "approved" ? "open" : payment.status === "denied" ? "closed" : ""}>{payment.status === "pending" ? "pendente" : payment.status === "approved" ? "autorizado" : "negado"}</i>
            </div>
            {payment.status === "pending" && (
              <div className="pixButtons adminButtons">
                <button className="primary" disabled={loading} onClick={() => void review(payment.id, "approved")}>Autorizar</button>
                <button className="secondary danger" disabled={loading} onClick={() => void review(payment.id, "denied")}>Negar</button>
              </div>
            )}
          </article>
        ))}
      </section>
    </main>
  );
}
