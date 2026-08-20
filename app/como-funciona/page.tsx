export default function ComoFuncionaPage() {
  return (
    <main className="ffv6 legalPage">
      <section className="panelHero compact">
        <span className="eyebrow">Como funciona</span>
        <h1>Fila Fácil em 3 passos</h1>
        <p>Explicação rápida para clientes e barbearias entenderem o aplicativo.</p>
      </section>
      <section className="launchGrid">
        <article><b>01</b><h2>Barbearia cadastra</h2><p>O dono cria conta, informa endereço, GPS, WhatsApp, serviços e abre a fila.</p></article>
        <article><b>02</b><h2>Cliente entra</h2><p>O cliente cria conta, escolhe serviço e entra na fila da barbearia.</p></article>
        <article><b>03</b><h2>Dono atende</h2><p>A barbearia chama, atende e finaliza cada cliente em ordem.</p></article>
      </section>
      <section className="settingsV6">
        <h2>O que melhora?</h2>
        <p>Menos bagunça na recepção, mais previsibilidade para o cliente e controle melhor para a barbearia.</p>
        <a className="secondary" href="/">Voltar ao início</a>
      </section>
    </main>
  );
}
