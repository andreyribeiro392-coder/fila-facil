export default function NotFound() {
  return (
    <main className="ffv6 directoryV6">
      <section className="panelHero compact">
        <span className="eyebrow">Fila Fácil</span>
        <h1>Página não encontrada</h1>
        <p>Esse link não existe ou foi movido. Volte para o início e procure sua barbearia novamente.</p>
        <div className="heroActions">
          <a className="primary" href="/" style={{ textDecoration: "none" }}>Voltar ao início</a>
          <a className="secondary" href="/suporte" style={{ textDecoration: "none" }}>Suporte</a>
        </div>
      </section>
    </main>
  );
}
