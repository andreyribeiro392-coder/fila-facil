"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Account = { id: string; username: string; displayName: string; role: "client" | "owner" };
type Shop = { id: string; name: string; slug: string; address: string | null; logo_url: string | null; is_open: boolean; latitude?: number | null; longitude?: number | null };
type Service = { id: string; name: string; price: number; duration_minutes: number };
type Barber = { id: string; name: string };
type QueueItem = { id: string; customer_name: string; status: string; joined_at: string; service_id: string; barber_id: string | null };
type ShopPayload = { ok: boolean; error?: string; shop: Shop; services: Service[]; barbers: Barber[]; queue: QueueItem[] };
type Position = { lat: number; lng: number };
type Mode = "choose" | "auth" | "directory" | "shop";

const distance = (a: Position, b: Position) => {
  const radius = 6371;
  const toRadians = Math.PI / 180;
  const latitude = (b.lat - a.lat) * toRadians;
  const longitude = (b.lng - a.lng) * toRadians;
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
};

async function jsonRequest<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers } });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("choose");
  const [account, setAccount] = useState<Account | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState<Position | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [shopData, setShopData] = useState<ShopPayload | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [requestedSlug] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("shop");
  });

  const loadDirectory = useCallback(async () => {
    setLoading(true);
    try {
      setShops(await jsonRequest<Shop[]>("/api/directory"));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar as barbearias.");
    } finally {
      setLoading(false);
    }
  }, []);

  const openShop = useCallback(async (slug: string) => {
    setLoading(true);
    setMessage("");
    try {
      const data = await jsonRequest<ShopPayload>(`/api/directory?slug=${encodeURIComponent(slug)}`);
      setShopData(data);
      setServiceId(data.services[0]?.id || "");
      setMode("shop");
      history.replaceState({}, "", `?shop=${encodeURIComponent(slug)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Barbearia não encontrada.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const slug = requestedSlug;
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json()) as { account: Account } : null)
      .then((result) => {
        if (!result?.account || result.account.role !== "client") {
          if (slug) setMode("auth");
          return;
        }
        setAccount(result.account);
        if (slug) void openShop(slug);
      });
  }, [openShop, requestedSlug]);

  useEffect(() => {
    if (mode !== "shop" || !shopData?.shop.slug) return;
    const interval = window.setInterval(() => void openShop(shopData.shop.slug), 8000);
    return () => window.clearInterval(interval);
  }, [mode, openShop, shopData?.shop.slug]);

  const wait = useMemo(() => (shopData?.queue || []).reduce((minutes, item) => minutes + (shopData?.services.find((service) => service.id === item.service_id)?.duration_minutes || 30), 0), [shopData]);
  const visibleShops = useMemo(() => shops
    .filter((shop) => `${shop.name} ${shop.address || ""}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
      if (position && a.latitude && a.longitude && b.latitude && b.longitude) {
        return distance(position, { lat: a.latitude, lng: a.longitude }) - distance(position, { lat: b.latitude, lng: b.longitude });
      }
      return a.name.localeCompare(b.name);
    }), [position, search, shops]);

  function enterClientMode() {
    if (account?.role === "client") {
      setMode("directory");
      void loadDirectory();
    } else {
      setMode("auth");
    }
  }

  function locate() {
    setGeoMessage("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setGeoMessage("Barbearias ordenadas pela proximidade.");
      },
      () => setGeoMessage("Não foi possível acessar o GPS. Pesquise pelo nome ou endereço."),
      { enableHighAccuracy: true, timeout: 12000 },
    );
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAccount(null);
    setShopData(null);
    setMode("choose");
    history.replaceState({}, "", "/");
  }

  async function joinQueue(event: FormEvent) {
    event.preventDefault();
    if (!shopData || !serviceId) return;
    setLoading(true);
    setMessage("");
    try {
      await jsonRequest<{ ok: boolean }>("/api/queue", {
        method: "POST",
        body: JSON.stringify({ slug: shopData.shop.slug, serviceId, barberId: barberId || null }),
      });
      setMessage("Você entrou na fila com sua conta verificada.");
      await openShop(shopData.shop.slug);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível entrar na fila.");
    } finally {
      setLoading(false);
    }
  }

  if (mode === "choose") {
    return <main className="landing"><div className="landingShade"/><section className="entryCard roleCard"><span className="brand">Fila Fácil</span><h1>Bem-vindo</h1><p>Fila protegida para barbearias verificadas e clientes identificados.</p><div className="roleGrid"><button onClick={() => { location.href = "/admin"; }}><b>✂ Cadastrar barbearia</b><span>Com endereço, GPS e comprovação</span></button><button onClick={enterClientMode}><b>✦ Sou cliente</b><span>Entre com nome e senha</span></button></div><div className="securitySeal">🛡 Cadastros analisados antes de aparecerem no aplicativo</div></section></main>;
  }

  if (mode === "auth") {
    return <ClientAuth onBack={() => setMode("choose")} onAuthenticated={(authenticated) => {
      setAccount(authenticated);
      if (requestedSlug) void openShop(requestedSlug);
      else { setMode("directory"); void loadDirectory(); }
    }}/>;
  }

  if (mode === "directory") {
    return <main className="directory"><header className="directoryHero"><button className="back" onClick={() => setMode("choose")} aria-label="Voltar">←</button><button className="logoutPill" onClick={() => void logout()}>Sair</button><span className="brand">Cliente verificado</span><h1>Olá, {account?.displayName}</h1><p>Somente barbearias aprovadas aparecem nesta lista.</p></header><section className="directoryTools"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou endereço" aria-label="Buscar barbearia"/><button onClick={locate}>📍 Usar localização</button>{geoMessage && <small>{geoMessage}</small>}</section><section className="shopList"><div className="directoryTitle"><div><span>Verificadas</span><h2>Barbearias</h2></div><b>{visibleShops.length}</b></div>{message && <div className="notice error">{message}</div>}{loading ? <div className="empty">Carregando…</div> : visibleShops.length === 0 ? <div className="empty">Nenhuma barbearia aprovada ainda.</div> : visibleShops.map((shop) => {
      const kilometers = position && shop.latitude && shop.longitude ? distance(position, { lat: shop.latitude, lng: shop.longitude }) : null;
      return <button className="shopCard" key={shop.id} onClick={() => void openShop(shop.slug)}>{shop.logo_url ? <Image className="shopAvatar photo" src={shop.logo_url} alt={`Foto da ${shop.name}`} width={52} height={52} unoptimized/> : <div className="shopAvatar">✂</div>}<div><strong>{shop.name} <span className="verifiedMark" title="Barbearia verificada">✓</span></strong><span>📍 {shop.address}</span>{kilometers !== null && <em>{kilometers < 1 ? `${Math.round(kilometers * 1000)} m` : `${kilometers.toFixed(1)} km`} de você</em>}</div><i className={shop.is_open ? "open" : "closed"}>{shop.is_open ? "Aberta" : "Fechada"}</i></button>;
    })}</section></main>;
  }

  if (!shopData) return <main className="adminCenter"><div className="loader"/><p>Carregando barbearia…</p></main>;
  const { shop, services, barbers, queue } = shopData;
  return <main className="appShell"><header className="shopHeader"><button className="back" onClick={() => { setMode("directory"); setShopData(null); history.replaceState({}, "", "/"); void loadDirectory(); }} aria-label="Voltar">←</button><div><span className="brand">Fila Fácil • verificada</span><h1>{shop.name}</h1><p>{shop.address}</p></div><span className={shop.is_open ? "status open" : "status closed"}>{shop.is_open ? "Aberta" : "Fechada"}</span></header><section className="stats"><article><strong>{queue.length}</strong><span>na fila</span></article><article><strong>{wait} min</strong><span>espera estimada</span></article></section><section className="queuePanel"><div className="sectionTitle"><div><span>Atualização automática</span><h2>Fila agora</h2></div><i/></div>{queue.length === 0 ? <div className="empty">A cadeira está livre ✨</div> : queue.map((item, index) => <article className="queueRow" key={item.id}><b>{index + 1}</b><div><strong>{item.customer_name}</strong><span>{services.find((service) => service.id === item.service_id)?.name || "Serviço"}</span></div><em>{item.status === "in_service" ? "Atendendo" : item.status === "called" ? "Chamado" : "Aguardando"}</em></article>)}</section><form className="joinCard" onSubmit={joinQueue}><span>Conta: {account?.displayName}</span><h2>Entrar na fila</h2>{!shop.is_open && <div className="notice error">A barbearia está fechada.</div>}<label>Serviço<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">Escolha o serviço</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} • R$ {Number(service.price).toFixed(2).replace(".", ",")} • {service.duration_minutes} min</option>)}</select></label>{barbers.length > 0 && <label>Preferência de barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">Primeiro disponível</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>}<button disabled={loading || !shop.is_open || !serviceId}>{loading ? "Confirmando…" : "Entrar na fila"}</button>{message && <div className="notice">{message}</div>}<small>Seu nome vem da conta e não pode ser alterado na fila.</small></form></main>;
}

function ClientAuth({ onBack, onAuthenticated }: { onBack: () => void; onAuthenticated: (account: Account) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tab === "register" && password !== confirmPassword) { setMessage("As senhas não são iguais."); return; }
    setBusy(true);
    setMessage("");
    try {
      const result = await jsonRequest<{ ok: boolean; account: Account }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ action: tab, username, password, displayName, role: "client" }),
      });
      onAuthenticated(result.account);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acesso recusado.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="authPage"><div className="authShade"/><form className="authCard" onSubmit={submit}><button type="button" className="authBack" onClick={onBack}>← Voltar</button><span className="brand">Sou cliente</span><h1>{tab === "login" ? "Entrar" : "Criar conta"}</h1><p>{tab === "login" ? "Use seu nome de acesso e sua senha." : "Seu nome será validado antes de entrar nas filas."}</p><div className="authTabs"><button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Já tenho conta</button><button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Nova conta</button></div>{tab === "register" && <label>Seu nome verdadeiro<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={3} maxLength={50} autoComplete="name" required placeholder="Ex.: João Silva"/></label>}<label>Nome de acesso<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={4} maxLength={24} autoCapitalize="none" autoComplete="username" required placeholder="Ex.: joao.silva"/></label><label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={72} autoComplete={tab === "login" ? "current-password" : "new-password"} required placeholder="Sua senha"/></label>{tab === "register" && <><label>Confirmar senha<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} autoComplete="new-password" required/></label><div className="passwordRules">Mínimo de 10 caracteres, com maiúscula, minúscula, número e símbolo.</div></>}<button disabled={busy}>{busy ? "Verificando…" : tab === "login" ? "Entrar com segurança" : "Criar conta"}</button>{message && <div className="notice error">{message}</div>}<button type="button" className="textButton" onClick={() => { setTab("register"); setMessage("Cliente sem senha deve criar uma nova conta com outro nome de acesso."); }}>Esqueci minha senha</button><div className="securitySeal">🛡 Cinco tentativas erradas bloqueiam o acesso por 30 minutos</div></form></main>;
}
