export default function LancamentoPage() {
  const items = [
    "Cliente cria conta e entra com sessão protegida",
    "Barbearia verificada aparece no diretório",
    "Serviços padrão aparecem para escolher o tipo de corte",
    "Cliente acompanha posição e tempo estimado",
    "Dono abre, fecha, chama, atende e conclui a fila",
    "Links copiados usam o domínio oficial",
    "Suporte, termos e privacidade estão publicados",
    "Diagnóstico disponível em /testes",
  ];

  return (
    <main className="ffv6 directoryV6">
      <section className="panelHero compact">
        <span className="eyebrow">Versão pública 0.2</span>
        <h1>Fila Fácil pronto para lançamento controlado</h1>
        <p>Esta é a página de conferência final antes de distribuir o APK para o público.</p>
        <div className="heroActions">
          <a className="primary" href="/testes" style={{ textDecoration: "none" }}>Rodar diagnóstico</a>
          <a className="secondary" href="/" style={{ textDecoration: "none" }}>Abrir app</a>
        </div>
      </section>
      <section className="shopListV6">
        {items.map((item, index) => (
          <article className="shopCardV6" key={item}>
            <div className="shopMain" style={{ pointerEvents: "none" }}>
              <div className="shopAvatarV6">✓</div>
              <div><strong>{String(index + 1).padStart(2, "0")}</strong><span>{item}</span></div>
              <i className="open">ok</i>
            </div>
          </article>
        ))}
      </section>
    </main>
  );
}
