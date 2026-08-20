/* eslint-disable @next/next/no-img-element */
"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Account = { id: string; username: string; displayName: string; role: "client" | "owner" };
type Shop = {
  id: string;
  name: string;
  slug: string;
  address: string | null;
  logo_url: string | null;
  is_open: boolean;
  latitude?: number | null;
  longitude?: number | null;
  whatsapp?: string | null;
};
type Service = { id: string; name: string; price: number; duration_minutes: number };
type Barber = { id: string; name: string };
type QueueItem = { id: string; customer_name: string; status: string; joined_at: string; service_id: string; barber_id: string | null };
type ShopPayload = { ok: boolean; error?: string; shop: Shop; services: Service[]; barbers: Barber[]; queue: QueueItem[] };
type Position = { lat: number; lng: number };
type Mode = "choose" | "auth" | "directory" | "shop" | "profile";
type Filter = "all" | "open" | "near" | "favorites" | "history";
type ThemeMode = "dark" | "light" | "auto";

const features = [
  "Fila ao vivo", "GPS próximo", "Favoritos", "Histórico", "Modo claro/escuro", "Compartilhar barbearia",
  "Tempo estimado", "Posição do cliente", "Serviços com preço", "Barbeiro preferido", "Status aberto/fechado", "Perfil verificado",
];

const storage = {
  get(key: string) {
    if (typeof window === "undefined") return "";
    return window.localStorage.getItem(key) || "";
  },
  set(key: string, value: string) {
    if (typeof window !== "undefined") window.localStorage.setItem(key, value);
  },
};

const money = (value: number) => `R$ ${Number(value).toFixed(2).replace(".", ",")}`;

const minutesLabel = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
};

const statusLabel = (status: string) => {
  if (status === "in_service") return "Atendendo";
  if (status === "called") return "Chamado";
  if (status === "finished") return "Finalizado";
  if (status === "cancelled") return "Cancelado";
  return "Aguardando";
};

const distance = (a: Position, b: Position) => {
  const radius = 6371;
  const toRadians = Math.PI / 180;
  const latitude = (b.lat - a.lat) * toRadians;
  const longitude = (b.lng - a.lng) * toRadians;
  const value = Math.sin(latitude / 2) ** 2 + Math.cos(a.lat * toRadians) * Math.cos(b.lat * toRadians) * Math.sin(longitude / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(value));
};

async function jsonRequest<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, { ...options, headers: { "Content-Type": "application/json", ...options?.headers }, cache: "no-store" });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

function readList(key: string) {
  try {
    return JSON.parse(storage.get(key) || "[]") as string[];
  } catch {
    return [];
  }
}

function saveUnique(key: string, value: string, limit = 12) {
  const next = [value, ...readList(key).filter((item) => item !== value)].slice(0, limit);
  storage.set(key, JSON.stringify(next));
  return next;
}

export default function Home() {
  const [mode, setMode] = useState<Mode>("choose");
  const [account, setAccount] = useState<Account | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [position, setPosition] = useState<Position | null>(null);
  const [geoMessage, setGeoMessage] = useState("");
  const [shopData, setShopData] = useState<ShopPayload | null>(null);
  const [serviceId, setServiceId] = useState("");
  const [barberId, setBarberId] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [requestedSlug] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("shop");
  });

  useEffect(() => {
    setFavorites(readList("ff_favorites"));
    setHistory(readList("ff_history"));
    const savedTheme = storage.get("ff_theme") as ThemeMode;
    setTheme(["light", "dark", "auto"].includes(savedTheme) ? savedTheme : "dark");
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = theme;
    storage.set("ff_theme", theme);
  }, [theme]);

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
      setHistory(saveUnique("ff_history", slug));
      window.history.replaceState({}, "", `?shop=${encodeURIComponent(slug)}`);
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
        if (result?.account) setAccount(result.account);
        if (!result?.account || result.account.role !== "client") {
          if (slug) setMode("auth");
          return;
        }
        if (slug) void openShop(slug);
      })
      .catch(() => undefined);
  }, [openShop, requestedSlug]);

  useEffect(() => {
    if (mode !== "shop" || !shopData?.shop.slug) return;
    const interval = window.setInterval(() => void openShop(shopData.shop.slug), 8000);
    return () => window.clearInterval(interval);
  }, [mode, openShop, shopData?.shop.slug]);

  const visibleShops = useMemo(() => shops
    .filter((shop) => `${shop.name} ${shop.address || ""}`.toLowerCase().includes(search.toLowerCase()))
    .filter((shop) => {
      if (filter === "open") return shop.is_open;
      if (filter === "favorites") return favorites.includes(shop.slug);
      if (filter === "history") return history.includes(shop.slug);
      return true;
    })
    .sort((a, b) => {
      if (filter === "history") return history.indexOf(a.slug) - history.indexOf(b.slug);
      if (filter === "favorites") return favorites.indexOf(a.slug) - favorites.indexOf(b.slug);
      if (a.is_open !== b.is_open) return a.is_open ? -1 : 1;
      if ((filter === "near" || position) && position && a.latitude && a.longitude && b.latitude && b.longitude) {
        return distance(position, { lat: a.latitude, lng: a.longitude }) - distance(position, { lat: b.latitude, lng: b.longitude });
      }
      return a.name.localeCompare(b.name);
    }), [favorites, filter, history, position, search, shops]);

  const openCount = shops.filter((shop) => shop.is_open).length;
  const favoriteCount = shops.filter((shop) => favorites.includes(shop.slug)).length;

  function enterClientMode() {
    if (account?.role === "client") {
      setMode("directory");
      void loadDirectory();
    } else {
      setMode("auth");
    }
  }

  function locate() {
    if (!navigator.geolocation) {
      setGeoMessage("GPS indisponível neste aparelho.");
      return;
    }
    setGeoMessage("Buscando sua localização…");
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({ lat: result.coords.latitude, lng: result.coords.longitude });
        setFilter("near");
        setGeoMessage("Barbearias ordenadas pela proximidade.");
      },
      () => setGeoMessage("Não foi possível acessar o GPS. Ative a permissão e tente novamente."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAccount(null);
    setShopData(null);
    setMode("choose");
    window.history.replaceState({}, "", "/");
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

  async function leaveQueue() {
    if (!shopData) return;
    setLoading(true);
    setMessage("");
    try {
      await jsonRequest<{ ok: boolean }>("/api/queue", {
        method: "DELETE",
        body: JSON.stringify({ slug: shopData.shop.slug }),
      });
      setMessage("Você saiu da fila.");
      await openShop(shopData.shop.slug);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível sair da fila.");
    } finally {
      setLoading(false);
    }
  }

  function toggleFavorite(slug: string) {
    const next = favorites.includes(slug) ? favorites.filter((item) => item !== slug) : [slug, ...favorites];
    setFavorites(next);
    storage.set("ff_favorites", JSON.stringify(next));
  }

  function shopDistance(shop: Shop) {
    if (!position || !shop.latitude || !shop.longitude) return null;
    const kilometers = distance(position, { lat: shop.latitude, lng: shop.longitude });
    return kilometers < 1 ? `${Math.round(kilometers * 1000)} m` : `${kilometers.toFixed(1)} km`;
  }

  if (mode === "choose") {
    return (
      <main className="ffv6 landingV6">
        <header className="topGlass">
          <strong>Fila Fácil</strong>
          <button onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? "☀️" : "🌙"}</button>
        </header>
        <section className="heroV6">
          <div className="heroCopy">
            <span className="eyebrow">Versão completa v6</span>
            <h1>Fila de barbearia organizada no celular.</h1>
            <p>Cliente entra na fila, acompanha posição, encontra barbearias próximas e o proprietário controla atendimento em tempo real.</p>
            <div className="heroActions">
              <button className="primary" onClick={enterClientMode}>Sou cliente</button>
              <button className="secondary" onClick={() => { window.location.href = "/admin"; }}>Cadastrar barbearia</button>
            </div>
          </div>
          <div className="phonePreview" aria-hidden="true">
            <div className="phoneTop"><i/> <span>Fila ao vivo</span></div>
            <div className="miniStat"><b>{openCount}</b><span>abertas agora</span></div>
            <div className="miniQueue"><b>1</b><div><strong>Drei</strong><span>Próximo cliente</span></div><em>Chamado</em></div>
            <div className="miniQueue"><b>2</b><div><strong>Cliente</strong><span>Corte + barba</span></div><em>Aguardando</em></div>
          </div>
        </section>
        <section className="featureStrip">{features.map((item) => <span key={item}>{item}</span>)}</section>
        <section className="launchGrid">
          <article><b>01</b><h2>Cliente</h2><p>Busca barbearia, usa GPS, favorita, entra na fila e vê a posição.</p></article>
          <article><b>02</b><h2>Barbearia</h2><p>Abre/fecha fila, chama cliente, adiciona barbeiros e serviços.</p></article>
          <article><b>03</b><h2>Controle</h2><p>Cadastros verificados, histórico local, segurança e sessão protegida.</p></article>
        </section>
      </main>
    );
  }

  if (mode === "auth") {
    return <ClientAuth onBack={() => setMode("choose")} onAuthenticated={(authenticated) => {
      setAccount(authenticated);
      if (requestedSlug) void openShop(requestedSlug);
      else { setMode("directory"); void loadDirectory(); }
    }}/>;
  }

  if (mode === "profile") {
    return (
      <main className="ffv6 profileV6">
        <header className="panelHero compact"><button className="back" onClick={() => setMode("directory")}>←</button><span className="eyebrow">Perfil</span><h1>{account?.displayName || "Cliente"}</h1><p>Conta protegida, favoritos e histórico ficam salvos neste aparelho.</p></header>
        <section className="profileCards">
          <article><b>{favorites.length}</b><span>favoritos</span></article>
          <article><b>{history.length}</b><span>visitadas</span></article>
          <article><b>{theme}</b><span>tema</span></article>
        </section>
        <section className="settingsV6">
          <h2>Configurações</h2>
          <button onClick={() => setTheme("dark")}>Modo escuro</button>
          <button onClick={() => setTheme("light")}>Modo claro</button>
          <button onClick={() => setTheme("auto")}>Automático</button>
          <button onClick={() => { storage.set("ff_favorites", "[]"); storage.set("ff_history", "[]"); setFavorites([]); setHistory([]); }}>Limpar favoritos e histórico</button>
          <button className="dangerText" onClick={() => void logout()}>Sair da conta</button>
        </section>
        <BottomNav mode={mode} onHome={() => { setMode("directory"); void loadDirectory(); }} onProfile={() => setMode("profile")}/>
      </main>
    );
  }

  if (mode === "directory") {
    return (
      <main className="ffv6 directoryV6">
        <header className="panelHero">
          <button className="back" onClick={() => setMode("choose")} aria-label="Voltar">←</button>
          <button className="pillButton" onClick={() => setMode("profile")}>Perfil</button>
          <span className="eyebrow">Cliente verificado</span>
          <h1>Olá, {account?.displayName}</h1>
          <p>Encontre barbearias aprovadas, próximas, abertas agora e salve suas favoritas.</p>
        </header>

        <section className="overviewGrid">
          <article><b>{shops.length}</b><span>barbearias</span></article>
          <article><b>{openCount}</b><span>abertas</span></article>
          <article><b>{favoriteCount}</b><span>favoritas</span></article>
        </section>

        <section className="directoryToolsV6">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome ou endereço" aria-label="Buscar barbearia"/>
          <button onClick={locate}>📍 Usar GPS</button>
          {geoMessage && <small>{geoMessage}</small>}
        </section>

        <section className="chips">
          {(["all", "open", "near", "favorites", "history"] as Filter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item === "all" ? "Todas" : item === "open" ? "Abertas" : item === "near" ? "Próximas" : item === "favorites" ? "Favoritas" : "Histórico"}</button>)}
        </section>

        {message && <div className="notice error">{message}</div>}
        <section className="shopListV6">
          {loading ? <div className="emptyV6">Carregando barbearias…</div> : visibleShops.length === 0 ? <div className="emptyV6">Nenhuma barbearia encontrada neste filtro.</div> : visibleShops.map((shop) => (
            <article className="shopCardV6" key={shop.id}>
              <button className="shopMain" onClick={() => void openShop(shop.slug)}>
                {shop.logo_url ? <img className="shopAvatarV6" src={shop.logo_url} alt={`Foto da ${shop.name}`}/> : <div className="shopAvatarV6">✂</div>}
                <div>
                  <strong>{shop.name} <span className="verifiedMark">✓</span></strong>
                  <span>📍 {shop.address || "Endereço não informado"}</span>
                  <small>{shopDistance(shop) ? `${shopDistance(shop)} de você` : "Toque para ver fila, serviços e detalhes"}</small>
                </div>
                <i className={shop.is_open ? "open" : "closed"}>{shop.is_open ? "Aberta" : "Fechada"}</i>
              </button>
              <div className="cardActions">
                <button onClick={() => toggleFavorite(shop.slug)}>{favorites.includes(shop.slug) ? "★ Favorita" : "☆ Favoritar"}</button>
                <button onClick={() => navigator.share?.({ title: shop.name, url: `${window.location.origin}/?shop=${shop.slug}` }).catch(() => undefined)}>Compartilhar</button>
              </div>
            </article>
          ))}
        </section>
        <BottomNav mode={mode} onHome={() => { setMode("directory"); void loadDirectory(); }} onProfile={() => setMode("profile")}/>
      </main>
    );
  }

  if (!shopData) return <main className="adminCenter"><div className="loader"/><p>Carregando barbearia…</p></main>;

  const { shop, services, barbers, queue } = shopData;
  const wait = queue.reduce((minutes, item) => minutes + (services.find((service) => service.id === item.service_id)?.duration_minutes || 30), 0);
  const clientIndex = account ? queue.findIndex((item) => item.customer_name.toLowerCase() === account.displayName.toLowerCase()) : -1;
  const clientEntry = clientIndex >= 0 ? queue[clientIndex] : null;
  const waitBeforeClient = clientIndex > 0 ? queue.slice(0, clientIndex).reduce((minutes, item) => minutes + (services.find((service) => service.id === item.service_id)?.duration_minutes || 30), 0) : 0;
  const shareUrl = `${typeof window === "undefined" ? "" : window.location.origin}/?shop=${encodeURIComponent(shop.slug)}`;

  return (
    <main className="ffv6 shopPageV6">
      <header className="shopHeroV6">
        <button className="back" onClick={() => { setMode("directory"); setShopData(null); window.history.replaceState({}, "", "/"); void loadDirectory(); }} aria-label="Voltar">←</button>
        <button className="heart" onClick={() => toggleFavorite(shop.slug)}>{favorites.includes(shop.slug) ? "★" : "☆"}</button>
        <span className="eyebrow">Barbearia verificada</span>
        <h1>{shop.name}</h1>
        <p>{shop.address}</p>
        <div className="heroBadges"><span className={shop.is_open ? "open" : "closed"}>{shop.is_open ? "Aberta agora" : "Fechada"}</span><span>{queue.length} na fila</span><span>{minutesLabel(wait)} de espera</span></div>
      </header>

      {clientEntry && <section className="myQueueCard">
        <span>Minha vez</span>
        <h2>Você está em {clientIndex + 1}º lugar</h2>
        <p>Status: <b>{statusLabel(clientEntry.status)}</b> • previsão: <b>{minutesLabel(waitBeforeClient)}</b></p>
        <button className="secondary" onClick={() => void leaveQueue()}>Sair da fila</button>
      </section>}

      <section className="quickActionsV6">
        <button onClick={() => navigator.clipboard.writeText(shareUrl).then(() => setMessage("Link copiado."))}>Copiar link</button>
        <button onClick={() => navigator.share?.({ title: shop.name, url: shareUrl }).catch(() => undefined)}>Compartilhar</button>
        <button onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(shop.address || shop.name)}`, "_blank")}>Rota</button>
      </section>

      <section className="statsV6">
        <article><strong>{queue.length}</strong><span>na fila</span></article>
        <article><strong>{minutesLabel(wait)}</strong><span>espera estimada</span></article>
        <article><strong>{services.length}</strong><span>serviços</span></article>
      </section>

      <section className="queuePanelV6">
        <div className="sectionTitleV6"><div><span>Atualização automática</span><h2>Fila agora</h2></div><i/></div>
        {queue.length === 0 ? <div className="emptyV6">A cadeira está livre ✨</div> : queue.map((item, index) => <article className="queueRowV6" key={item.id}>
          <b>{index + 1}</b><div><strong>{item.customer_name}</strong><span>{services.find((service) => service.id === item.service_id)?.name || "Serviço"}</span></div><em>{statusLabel(item.status)}</em>
        </article>)}
      </section>

      <section className="serviceGridV6">
        <h2>Serviços</h2>
        {services.map((service) => <article key={service.id}><strong>{service.name}</strong><span>{money(service.price)}</span><small>{service.duration_minutes} min</small></article>)}
      </section>

      <form className="joinCardV6" onSubmit={joinQueue}>
        <span>Conta: {account?.displayName}</span>
        <h2>Entrar na fila</h2>
        {!shop.is_open && <div className="notice error">A barbearia está fechada.</div>}
        {clientEntry && <div className="notice">Você já está nesta fila.</div>}
        <label>Serviço<select value={serviceId} onChange={(event) => setServiceId(event.target.value)} required><option value="">Escolha o serviço</option>{services.map((service) => <option value={service.id} key={service.id}>{service.name} • {money(service.price)} • {service.duration_minutes} min</option>)}</select></label>
        {barbers.length > 0 && <label>Preferência de barbeiro<select value={barberId} onChange={(event) => setBarberId(event.target.value)}><option value="">Primeiro disponível</option>{barbers.map((barber) => <option value={barber.id} key={barber.id}>{barber.name}</option>)}</select></label>}
        <button disabled={loading || !shop.is_open || !serviceId || Boolean(clientEntry)}>{loading ? "Confirmando…" : clientEntry ? "Você já está na fila" : "Entrar na fila"}</button>
        {message && <div className="notice">{message}</div>}
        <small>Seu nome vem da conta e não pode ser alterado na fila.</small>
      </form>
      <BottomNav mode={mode} onHome={() => { setMode("directory"); setShopData(null); void loadDirectory(); }} onProfile={() => setMode("profile")}/>
    </main>
  );
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

  return <main className="ffv6 authV6"><form className="authCardV6" onSubmit={submit}>
    <button type="button" className="authBack" onClick={onBack}>← Voltar</button>
    <span className="eyebrow">Sou cliente</span>
    <h1>{tab === "login" ? "Entrar" : "Criar conta"}</h1>
    <p>{tab === "login" ? "Use seu nome de acesso e sua senha." : "Seu nome será usado nas filas verificadas."}</p>
    <div className="authTabsV6"><button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Já tenho conta</button><button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Nova conta</button></div>
    {tab === "register" && <label>Seu nome verdadeiro<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={3} maxLength={50} autoComplete="name" required placeholder="Ex.: João Silva"/></label>}
    <label>Nome de acesso<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={4} maxLength={24} autoCapitalize="none" autoComplete="username" required placeholder="Ex.: joao.silva"/></label>
    <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={72} autoComplete={tab === "login" ? "current-password" : "new-password"} required/></label>
    {tab === "register" && <label>Confirmar senha<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} autoComplete="new-password" required/></label>}
    <button className="primary" disabled={busy}>{busy ? "Verificando…" : tab === "login" ? "Entrar" : "Criar conta"}</button>
    {message && <div className="notice error">{message}</div>}
    <div className="securitySeal">🛡 Sessão segura, fila única por cliente e barbearias verificadas</div>
  </form></main>;
}

function BottomNav({ mode, onHome, onProfile }: { mode: Mode; onHome: () => void; onProfile: () => void }) {
  return <nav className="bottomNavV6">
    <button className={mode === "directory" ? "active" : ""} onClick={onHome}>⌂<span>Início</span></button>
    <button onClick={() => window.location.href = "/admin"}>✂<span>Barbearia</span></button>
    <button className={mode === "profile" ? "active" : ""} onClick={onProfile}>☻<span>Perfil</span></button>
  </nav>;
}
