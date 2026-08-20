"use client";

import Image from "next/image";
import { FormEvent, useCallback, useEffect, useState } from "react";

type Account = {
  id: string;
  username: string;
  displayName: string;
  role: "owner";
};

type Shop = {
  id: string;
  name: string;
  slug: string;
  address: string;
  whatsapp: string;
  logo_url: string | null;
  is_open: boolean;
  verification_status: "pending" | "approved" | "rejected";
  verification_notes?: string | null;
};

type Barber = { id: string; name: string; is_active: boolean };
type Service = { id: string; name: string; price: number; duration_minutes: number; is_active: boolean };
type QueueItem = {
  id: string;
  customer_name: string;
  status: "waiting" | "called" | "in_service";
  joined_at: string;
  service_id: string;
};
type Dashboard = {
  ok: boolean;
  error?: string;
  shop: Shop | null;
  barbers?: Barber[];
  services?: Service[];
  queue?: QueueItem[];
};

async function jsonRequest<T>(url: string, options?: RequestInit) {
  const response = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options?.headers },
  });
  const data = (await response.json()) as T & { error?: string };
  if (!response.ok) throw new Error(data.error || "Não foi possível concluir a operação.");
  return data;
}

async function prepareShopPhoto(file: File) {
  const allowedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  if (!allowedTypes.has(file.type)) throw new Error("Use uma foto JPG, PNG ou WebP.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A foto deve ter no máximo 5 MB.");

  const source = URL.createObjectURL(file);
  try {
    const photo = new window.Image();
    await new Promise<void>((resolve, reject) => {
      photo.onload = () => resolve();
      photo.onerror = () => reject(new Error("Não foi possível ler a foto."));
      photo.src = source;
    });
    const scale = Math.min(1, 1000 / photo.naturalWidth, 700 / photo.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Não foi possível preparar a foto.");
    context.drawImage(photo, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/webp", 0.76);
    if (result.length > 400_000) throw new Error("Escolha uma foto com menos detalhes ou menor resolução.");
    return result;
  } finally {
    URL.revokeObjectURL(source);
  }
}

export default function AdminPage() {
  const [account, setAccount] = useState<Account | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const data = await jsonRequest<Dashboard>("/api/owner");
      setDashboard(data);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível carregar o painel.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetch("/api/session", { cache: "no-store" })
      .then(async (response) => response.ok ? (await response.json()) as { account: Account } : null)
      .then((result) => {
        if (result?.account?.role === "owner") {
          setAccount(result.account);
          void loadDashboard();
        } else {
          setLoading(false);
        }
      });
  }, [loadDashboard]);

  async function logout() {
    await fetch("/api/session", { method: "DELETE" });
    setAccount(null);
    setDashboard(null);
    setMenuOpen(false);
  }

  async function ownerAction(action: string, payload: Record<string, unknown> = {}) {
    setMessage("");
    try {
      await jsonRequest<{ ok: boolean }>("/api/owner", {
        method: "POST",
        body: JSON.stringify({ action, payload }),
      });
      setMessage("Alteração salva com segurança.");
      await loadDashboard();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Operação recusada.");
    }
  }

  if (loading) {
    return <main className="adminCenter"><div className="loader"/><p>Carregando acesso seguro…</p></main>;
  }

  if (!account) {
    return <OwnerAuth onAuthenticated={(authenticated) => {
      setAccount(authenticated);
      void loadDashboard();
    }}/>;
  }

  if (!dashboard?.shop) {
    return <VerificationOnboarding account={account} onCreated={() => void loadDashboard()} onLogout={() => void logout()}/>;
  }

  if (dashboard.shop.verification_status !== "approved") {
    return <ReviewStatus shop={dashboard.shop} onLogout={() => void logout()}/>;
  }

  const shop = dashboard.shop;
  const queue = dashboard.queue || [];
  const services = dashboard.services || [];
  const barbers = dashboard.barbers || [];
  const estimatedWait = queue.reduce((total, item) => total + (services.find((service) => service.id === item.service_id)?.duration_minutes || 30), 0);
  const shareUrl = typeof location === "undefined" ? "" : location.origin + "/?shop=" + encodeURIComponent(shop.slug);

  return (
    <main className="adminApp">
      <header className="adminHeader">
        <span className="brand">Fila Fácil • proprietário verificado</span>
        <h1>{shop.name}</h1>
        <p>{shop.address}</p>
        <button className="dots" onClick={() => setMenuOpen(!menuOpen)} aria-label="Abrir menu">•••</button>
        {menuOpen && <div className="menu">
          <button onClick={() => document.getElementById("settings")?.scrollIntoView({ behavior: "smooth" })}>Editar barbearia</button>
          <button onClick={() => void logout()}>Sair da conta</button>
        </div>}
      </header>

      <section className="adminStats">
        <article><span>Pessoas na fila</span><strong>{queue.length}</strong></article>
        <article><span>Espera estimada</span><strong>{estimatedWait} min</strong></article>
      </section>

      {message && <div className="adminNotice notice">{message}</div>}

      <section className="controlBar">
        <div><span>Estado da fila</span><strong>{shop.is_open ? "Aberta para clientes" : "Fechada"}</strong></div>
        <button className={shop.is_open ? "danger" : "success"} onClick={() => void ownerAction("toggle_shop")}>
          {shop.is_open ? "Fechar fila" : "Abrir fila"}
        </button>
      </section>

      <section className="adminQueue">
        <div className="adminTitle"><div><span>Atualização segura</span><h2>Fila agora</h2></div><i/></div>
        {queue.length === 0 ? <div className="empty">Nenhum cliente aguardando.</div> : queue.map((item, index) => (
          <article className="adminRow" key={item.id}>
            <b>{index + 1}</b>
            <div className="client">
              <strong>{item.customer_name}</strong>
              <span>{services.find((service) => service.id === item.service_id)?.name || "Serviço"}</span>
            </div>
            <div className="rowActions">
              {item.status === "waiting" && <button onClick={() => void ownerAction("queue_status", { id: item.id, status: "called" })}>Chamar</button>}
              {item.status !== "in_service" && <button onClick={() => void ownerAction("queue_status", { id: item.id, status: "in_service" })}>Atender</button>}
              <button className="finish" onClick={() => void ownerAction("queue_status", { id: item.id, status: "finished" })}>Concluir</button>
            </div>
          </article>
        ))}
      </section>

      <section className="settingsPanel" id="settings">
        <span className="brand">Personalização</span>
        <h2>Editar barbearia</h2>
        <p>Adicione foto, serviços e barbeiros para deixar o perfil completo.</p>
        <ProfileForm shop={shop} onSave={(payload) => void ownerAction("update_profile", payload)}/>
        <div className="settingGrid">
          <CreateItem
            title="✂ Adicionar barbeiro"
            placeholder="Nome verdadeiro"
            button="Adicionar barbeiro"
            onCreate={(name) => void ownerAction("add_barber", { name })}
            items={barbers.map((barber) => ({ id: barber.id, label: barber.name, active: barber.is_active }))}
            onToggle={(id) => void ownerAction("toggle_barber", { id })}
          />
          <ServiceForm
            services={services}
            onCreate={(payload) => void ownerAction("add_service", payload)}
            onToggle={(id) => void ownerAction("toggle_service", { id })}
          />
        </div>
      </section>

      <section className="shareCard">
        <span className="brand">Link do aplicativo</span>
        <h2>Convide seus clientes</h2>
        <p>O link abre o Fila Fácil diretamente no perfil da sua barbearia.</p>
        <div className="linkBox">{shareUrl}</div>
        <button onClick={() => void navigator.clipboard.writeText(shareUrl).then(() => setMessage("Link copiado."))}>Copiar link</button>
      </section>
    </main>
  );
}

function OwnerAuth({ onAuthenticated }: { onAuthenticated: (account: Account) => void }) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [displayName, setDisplayName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (tab === "register" && password !== confirmPassword) {
      setMessage("As senhas não são iguais.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const result = await jsonRequest<{ ok: boolean; account: Account }>("/api/session", {
        method: "POST",
        body: JSON.stringify({ action: tab, username, password, displayName, role: "owner" }),
      });
      onAuthenticated(result.account);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Acesso recusado.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="authPage">
      <div className="authShade"/>
      <form className="authCard" onSubmit={submit}>
        <button type="button" className="authBack" onClick={() => { location.href = "/"; }}>← Início</button>
        <span className="brand">Cadastrar barbearia</span>
        <h1>{tab === "login" ? "Entrar" : "Criar conta"}</h1>
        <p>{tab === "login" ? "Acesso exclusivo do proprietário." : "Depois da conta, enviaremos a barbearia para análise."}</p>
        <div className="authTabs">
          <button type="button" className={tab === "login" ? "active" : ""} onClick={() => setTab("login")}>Já tenho conta</button>
          <button type="button" className={tab === "register" ? "active" : ""} onClick={() => setTab("register")}>Nova conta</button>
        </div>
        {tab === "register" && <label>Nome do proprietário<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={3} maxLength={50} autoComplete="name" required placeholder="Seu nome verdadeiro"/></label>}
        <label>Nome de acesso<input value={username} onChange={(event) => setUsername(event.target.value)} minLength={4} maxLength={24} autoCapitalize="none" autoComplete="username" required placeholder="Ex.: joao.barbearia"/></label>
        <label>Senha<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={10} maxLength={72} autoComplete={tab === "login" ? "current-password" : "new-password"} required/></label>
        {tab === "register" && <>
          <label>Confirmar senha<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={10} maxLength={72} autoComplete="new-password" required/></label>
          <div className="passwordRules">Use pelo menos 10 caracteres, maiúscula, minúscula, número e símbolo.</div>
        </>}
        <button disabled={busy}>{busy ? "Verificando…" : tab === "login" ? "Entrar com segurança" : "Continuar cadastro"}</button>
        {message && <div className="notice error">{message}</div>}
        <button type="button" className="textButton" onClick={() => setMessage("A senha do proprietário só pode ser recuperada pelo suporte, após verificação de identidade e propriedade.")}>Esqueci minha senha</button>
        <div className="securitySeal">🛡 Cinco tentativas erradas bloqueiam o acesso por 30 minutos</div>
      </form>
    </main>
  );
}

function VerificationOnboarding({ account, onCreated, onLogout }: { account: Account; onCreated: () => void; onLogout: () => void }) {
  const [name, setName] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [verificationMethod, setVerificationMethod] = useState("cnpj");
  const [verificationReference, setVerificationReference] = useState("");
  const [ownershipConfirmed, setOwnershipConfirmed] = useState(false);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function locate() {
    setMessage("Buscando o GPS do estabelecimento…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setMessage("Localização confirmada. Continue o cadastro.");
      },
      () => setMessage("Não foi possível confirmar o GPS. Permita a localização e tente no endereço da barbearia."),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (latitude === null || longitude === null) {
      setMessage("Confirme o GPS estando no local da barbearia.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      await jsonRequest<{ ok: boolean }>("/api/owner", {
        method: "POST",
        body: JSON.stringify({
          action: "create_shop",
          name,
          whatsapp,
          address,
          latitude,
          longitude,
          verificationMethod,
          verificationReference,
          ownershipConfirmed,
        }),
      });
      onCreated();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cadastro recusado.");
    } finally {
      setBusy(false);
    }
  }

  const referenceLabel = verificationMethod === "cnpj" ? "CNPJ" : "Link público da comprovação";
  const referencePlaceholder = verificationMethod === "cnpj" ? "00.000.000/0000-00" : "https://...";

  return (
    <main className="verificationPage">
      <form className="verificationCard" onSubmit={submit}>
        <div className="verificationTop"><div><span className="brand">Etapa de segurança</span><h1>Comprove sua barbearia</h1></div><button type="button" className="textButton" onClick={onLogout}>Sair</button></div>
        <p>Olá, {account.displayName}. A barbearia só aparecerá para clientes depois da análise.</p>
        <div className="verificationSteps"><b>1</b><span>Conta criada</span><b>2</b><span>Local e propriedade</span><b>3</b><span>Análise</span></div>
        <label>Nome real da barbearia<input value={name} onChange={(event) => setName(event.target.value)} minLength={4} maxLength={60} required placeholder="Ex.: Barbearia do Centro"/></label>
        <label>WhatsApp com DDD<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} inputMode="tel" minLength={10} maxLength={18} required placeholder="(11) 99999-9999"/></label>
        <label>Endereço completo<input value={address} onChange={(event) => setAddress(event.target.value)} minLength={12} maxLength={180} required placeholder="Rua, número, bairro, cidade e estado"/></label>
        <button type="button" className={"locationButton " + (latitude !== null ? "confirmed" : "")} onClick={locate}>
          {latitude !== null ? "✓ GPS do local confirmado" : "📍 Confirmar GPS no estabelecimento"}
        </button>
        <label>Forma de comprovação<select value={verificationMethod} onChange={(event) => setVerificationMethod(event.target.value)}>
          <option value="cnpj">CNPJ da barbearia</option>
          <option value="google_business">Perfil no Google Meu Negócio</option>
          <option value="social_profile">Perfil comercial em rede social</option>
          <option value="storefront_photo">Link de foto da fachada</option>
        </select></label>
        <label>{referenceLabel}<input value={verificationReference} onChange={(event) => setVerificationReference(event.target.value)} required placeholder={referencePlaceholder}/></label>
        <label className="ownershipCheck"><input type="checkbox" checked={ownershipConfirmed} onChange={(event) => setOwnershipConfirmed(event.target.checked)} required/><span>Declaro que sou proprietário ou representante autorizado e que os dados são verdadeiros.</span></label>
        <div className="securitySeal">🛡 Nome, endereço, GPS e prova serão conferidos antes da publicação.</div>
        <button disabled={busy}>{busy ? "Enviando para análise…" : "Enviar barbearia para análise"}</button>
        {message && <div className="notice">{message}</div>}
      </form>
    </main>
  );
}

function ReviewStatus({ shop, onLogout }: { shop: Shop; onLogout: () => void }) {
  const rejected = shop.verification_status === "rejected";
  return (
    <main className="verificationPage">
      <section className="reviewCard">
        <div className={"reviewIcon " + (rejected ? "rejected" : "")}>{rejected ? "!" : "⌛"}</div>
        <span className="brand">{rejected ? "Correção necessária" : "Em análise"}</span>
        <h1>{shop.name}</h1>
        <p>{rejected ? "A comprovação não foi aprovada. Fale com o suporte para corrigir os dados." : "Recebemos o endereço, o GPS e a comprovação. A barbearia ainda não aparece para clientes."}</p>
        {shop.verification_notes && <div className="notice error">{shop.verification_notes}</div>}
        <div className="reviewInfo"><span>Status</span><strong>{rejected ? "Recusada" : "Aguardando verificação manual"}</strong></div>
        <button onClick={onLogout}>Sair da conta</button>
      </section>
    </main>
  );
}

function ProfileForm({ shop, onSave }: { shop: Shop; onSave: (payload: Record<string, unknown>) => void }) {
  const [name, setName] = useState(shop.name);
  const [address, setAddress] = useState(shop.address);
  const [whatsapp, setWhatsapp] = useState(shop.whatsapp);
  const [logoUrl, setLogoUrl] = useState(shop.logo_url || "");
  const [photoMessage, setPhotoMessage] = useState("");
  return (
    <form className="profileForm" onSubmit={(event) => {
      event.preventDefault();
      onSave({ name, address, whatsapp, logo_url: logoUrl });
    }}>
      {logoUrl && <Image className="logoPreview" src={logoUrl} alt={"Foto da " + shop.name} width={900} height={500} unoptimized/>}
      <label className="filePicker">📷 Escolher foto da barbearia
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          setPhotoMessage("Preparando foto…");
          void prepareShopPhoto(file)
            .then((result) => {
              setLogoUrl(result);
              setPhotoMessage("Foto pronta. Toque em salvar alterações.");
            })
            .catch((error: unknown) => setPhotoMessage(error instanceof Error ? error.message : "Foto inválida."));
        }}/>
      </label>
      {photoMessage && <div className="notice">{photoMessage}</div>}
      <label>Ou use um link HTTPS<input type="url" value={logoUrl.startsWith("data:") ? "" : logoUrl} onChange={(event) => setLogoUrl(event.target.value)} placeholder="https://..."/></label>
      <label>Nome<input value={name} onChange={(event) => setName(event.target.value)} minLength={4} maxLength={60} required/></label>
      <label>Endereço<input value={address} onChange={(event) => setAddress(event.target.value)} minLength={12} maxLength={180} required/></label>
      <label>WhatsApp<input value={whatsapp} onChange={(event) => setWhatsapp(event.target.value)} minLength={10} maxLength={18} required/></label>
      <button>Salvar alterações</button>
    </form>
  );
}

function CreateItem({ title, placeholder, button, onCreate, items, onToggle }: {
  title: string;
  placeholder: string;
  button: string;
  onCreate: (name: string) => void;
  items: { id: string; label: string; active: boolean }[];
  onToggle: (id: string) => void;
}) {
  const [name, setName] = useState("");
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onCreate(name);
      setName("");
    }}>
      <h3>{title}</h3>
      <input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={50} required placeholder={placeholder}/>
      <button>{button}</button>
      <ul>{items.map((item) => <li key={item.id}><span>{item.label} {!item.active && "• inativo"}</span><button type="button" onClick={() => onToggle(item.id)}>{item.active ? "Desativar" : "Ativar"}</button></li>)}</ul>
    </form>
  );
}

function ServiceForm({ services, onCreate, onToggle }: {
  services: Service[];
  onCreate: (payload: Record<string, unknown>) => void;
  onToggle: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [duration, setDuration] = useState("30");
  return (
    <form onSubmit={(event) => {
      event.preventDefault();
      onCreate({ name, price: Number(price), duration: Number(duration) });
      setName("");
      setPrice("");
    }}>
      <h3>💈 Adicionar serviço</h3>
      <input value={name} onChange={(event) => setName(event.target.value)} minLength={3} maxLength={70} required placeholder="Ex.: Corte masculino"/>
      <input value={price} onChange={(event) => setPrice(event.target.value)} type="number" min="0" max="10000" step="0.01" required placeholder="Preço"/>
      <input value={duration} onChange={(event) => setDuration(event.target.value)} type="number" min="5" max="480" required placeholder="Duração em minutos"/>
      <button>Adicionar serviço</button>
      <ul>{services.map((service) => <li key={service.id}><span>{service.name} • R$ {Number(service.price).toFixed(2).replace(".", ",")} {!service.is_active && "• inativo"}</span><button type="button" onClick={() => onToggle(service.id)}>{service.is_active ? "Desativar" : "Ativar"}</button></li>)}</ul>
    </form>
  );
}
