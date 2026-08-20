"use client";

import { useEffect, useState } from "react";

type Notice = { id: string; text: string; time: string };

function nowLabel() {
  return new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function sendBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, icon: "/favicon.svg", badge: "/favicon.svg" });
  } catch {
    return;
  }
}

export default function AppNotifications() {
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("unsupported");
  const [notices, setNotices] = useState<Notice[]>([]);

  useEffect(() => {
    if ("Notification" in window) setPermission(Notification.permission);
    const addNotice = (text: string, browser = false) => {
      const notice = { id: `${Date.now()}-${Math.random()}`, text, time: nowLabel() };
      setNotices((items) => [notice, ...items].slice(0, 8));
      if (browser) sendBrowserNotification("Fila Fácil", text);
    };

    const onOnline = () => addNotice("Conexão restaurada.");
    const onOffline = () => addNotice("Você está sem internet. Algumas ações podem falhar.", true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    let lastText = "";
    const scan = () => {
      const text = (document.body.textContent || "").toLowerCase();
      if (text === lastText) return;
      lastText = text;
      if (text.includes("você entrou na fila") || text.includes("entrou na fila")) addNotice("Entrada na fila confirmada.", true);
      if (text.includes("chamado") && text.includes("atendendo")) addNotice("A fila foi atualizada.", true);
      if (text.includes("pedido enviado") && text.includes("pendente")) addNotice("Pedido de pagamento enviado para liberação.");
      if (text.includes("acesso autorizado")) addNotice("Acesso autorizado com sucesso.", true);
    };

    scan();
    const timer = window.setInterval(scan, 2500);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      window.clearInterval(timer);
    };
  }, []);

  async function enableNotifications() {
    if (!("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    const next = await Notification.requestPermission();
    setPermission(next);
    if (next === "granted") {
      const notice = { id: `${Date.now()}`, text: "Notificações ativadas neste aparelho.", time: nowLabel() };
      setNotices((items) => [notice, ...items].slice(0, 8));
      sendBrowserNotification("Fila Fácil", "Notificações ativadas.");
    }
  }

  return (
    <div className="ffNotify" aria-live="polite">
      <button className="ffNotifyButton" type="button" onClick={() => setOpen((value) => !value)} aria-label="Abrir notificações">
        <span>🔔</span>
        {notices.length > 0 && <b>{notices.length}</b>}
      </button>
      {open && (
        <section className="ffNotifyPanel">
          <header>
            <strong>Notificações</strong>
            <button type="button" onClick={() => setOpen(false)}>×</button>
          </header>
          {permission !== "granted" && permission !== "unsupported" && (
            <button className="ffNotifyEnable" type="button" onClick={enableNotifications}>Ativar notificações neste celular</button>
          )}
          {permission === "unsupported" && <p>Seu navegador/app pode limitar notificações externas. As notificações internas continuam funcionando.</p>}
          {notices.length === 0 && <p>Nenhuma novidade ainda.</p>}
          {notices.map((notice) => (
            <article key={notice.id}>
              <span>{notice.time}</span>
              <p>{notice.text}</p>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
