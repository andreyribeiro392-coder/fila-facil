"use client";

import { useEffect, useMemo, useState } from "react";

type Check = { name: string; status: "waiting" | "ok" | "warn" | "error"; detail: string };
type Shop = { id: string; name: string; slug: string; is_open?: boolean };
type DirectoryShop = Shop & { address?: string | null };
type ShopPayload = { ok?: boolean; error?: string; shop?: Shop; services?: Array<{ id: string; name: string; price: number; duration_minutes: number }>; barbers?: unknown[]; queue?: unknown[] };

const canonical = "https://fila-facil-app-v5.vercel.app";

async function safeJson<T>(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  const text = await response.text();
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { response, data: data as T };
}

export default function TestesPage() {
  const [checks, setChecks] = useState<Check[]>([{ name: "Iniciando diagnóstico", status: "waiting", detail: "Aguarde…" }]);
  const [running, setRunning] = useState(false);

  const okCount = useMemo(() => checks.filter((item) => item.status === "ok").length, [checks]);
  const warnCount = useMemo(() => checks.filter((item) => item.status === "warn").length, [checks]);
  const errorCount = useMemo(() => checks.filter((item) => item.status === "error").length, [checks]);

  async function runTests() {
    setRunning(true);
    const next: Check[] = [];
    const push = (check: Check) => { next.push(check); setChecks([...next]); };

    try {
      push({ name: "Domínio oficial", status: location.origin === canonical ? "ok" : "warn", detail: location.origin === canonical ? "Você está no domínio limpo oficial." : `Você está em ${location.origin}. Compartilhamento deve corrigir para ${canonical}.` });

      const legalPages = ["/privacidade", "/termos", "/suporte", "/como-funciona"];
      for (const page of legalPages) {
        try {
          const result = await fetch(page, { cache: "no-store" });
          push({ name: `Página ${page}`, status: result.ok ? "ok" : "error", detail: result.ok ? "Página carregou." : `Retornou HTTP ${result.status}.` });
        } catch (error) {
          push({ name: `Página ${page}`, status: "error", detail: error instanceof Error ? error.message : "Falhou ao carregar." });
        }
      }

      let shops: DirectoryShop[] = [];
      try {
        const result = await safeJson<DirectoryShop[] | { ok?: boolean; error?: string }>("/api/directory");
        if (!result.response.ok) {
          push({ name: "API de barbearias", status: "error", detail: `HTTP ${result.response.status}. ${(result.data as { error?: string })?.error || "Sem detalhe."}` });
        } else if (Array.isArray(result.data)) {
          shops = result.data;
          push({ name: "API de barbearias", status: "ok", detail: `${shops.length} barbearia(s) aprovada(s) retornada(s).` });
        } else {
          push({ name: "API de barbearias", status: "warn", detail: "A API respondeu, mas não retornou lista. Confira o Supabase." });
        }
      } catch (error) {
        push({ name: "API de barbearias", status: "error", detail: error instanceof Error ? error.message : "Erro desconhecido." });
      }

      if (shops.length > 0) {
        const first = shops[0];
        try {
          const result = await safeJson<ShopPayload>(`/api/directory?slug=${encodeURIComponent(first.slug)}`);
          const payload = result.data;
          push({ name: "Perfil público da barbearia", status: result.response.ok && payload.ok !== false ? "ok" : "error", detail: payload.error || `Perfil testado: ${first.name}.` });
          const services = payload.services || [];
          push({ name: "Serviços / tipo de corte", status: services.length > 0 ? "ok" : "error", detail: services.length > 0 ? `${services.length} serviço(s): ${services.map((item) => item.name).join(", ")}.` : "Nenhum serviço retornou. Rode ou revise o SQL de serviços padrão." });
          push({ name: "Estado da fila", status: payload.shop?.is_open ? "ok" : "warn", detail: payload.shop?.is_open ? "Barbearia aberta para teste de entrada na fila." : "Barbearia fechada. O cliente não consegue entrar na fila enquanto estiver fechada." });
          push({ name: "Fila pública", status: Array.isArray(payload.queue) ? "ok" : "warn", detail: Array.isArray(payload.queue) ? `${payload.queue.length} item(ns) na fila pública.` : "Fila não retornou lista." });
        } catch (error) {
          push({ name: "Perfil público da barbearia", status: "error", detail: error instanceof Error ? error.message : "Erro desconhecido." });
        }
      } else {
        push({ name: "Teste de serviços", status: "warn", detail: "Não há barbearia aprovada na API. Aprove/cadastre uma barbearia para testar o fluxo completo." });
      }

      try {
        const session = await safeJson<{ ok?: boolean; account?: { displayName?: string; role?: string } }>("/api/session");
        push({ name: "Sessão atual", status: session.response.ok ? "ok" : "warn", detail: session.response.ok ? `Logado como ${session.data.account?.displayName || "usuário"} (${session.data.account?.role || "sem perfil"}).` : "Sem login nesta aba. Para testar entrar na fila, faça login como cliente." });
      } catch {
        push({ name: "Sessão atual", status: "warn", detail: "Não foi possível verificar sessão, mas isso pode ser normal sem login." });
      }

      push({ name: "Resumo", status: errorCount === 0 ? "ok" : "warn", detail: "Diagnóstico finalizado. Itens amarelos dependem de login, barbearia aberta ou dados reais." });
    } finally {
      setRunning(false);
    }
  }

  useEffect(() => { void runTests(); }, []);

  return (
    <main className="ffv6 directoryV6">
      <header className="panelHero compact">
        <button className="back" onClick={() => { location.href = "/"; }}>←</button>
        <span className="eyebrow">Diagnóstico</span>
        <h1>Teste do Fila Fácil</h1>
        <p>Esta tela testa o site, APIs, serviços e páginas principais sem criar contas falsas no Supabase.</p>
      </header>
      <section className="overviewGrid">
        <article><b>{okCount}</b><span>ok</span></article>
        <article><b>{warnCount}</b><span>atenção</span></article>
        <article><b>{errorCount}</b><span>erro</span></article>
      </section>
      <section className="settingsV6">
        <button onClick={() => void runTests()} disabled={running}>{running ? "Testando…" : "Rodar teste de novo"}</button>
        <button onClick={() => { location.href = "/"; }}>Voltar ao app</button>
      </section>
      <section className="shopListV6">
        {checks.map((check) => (
          <article className="shopCardV6" key={`${check.name}-${check.detail}`}>
            <div className="shopMain" style={{ pointerEvents: "none" }}>
              <div className="shopAvatarV6">{check.status === "ok" ? "✓" : check.status === "error" ? "!" : check.status === "warn" ? "?" : "…"}</div>
              <div>
                <strong>{check.name}</strong>
                <span>{check.detail}</span>
              </div>
              <i className={check.status === "ok" ? "open" : check.status === "error" ? "closed" : ""}>{check.status}</i>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
