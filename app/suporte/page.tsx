export default function SuportePage() {
  return (
    <main className="ffv6 legalPage">
      <section className="panelHero compact">
        <span className="eyebrow">Suporte</span>
        <h1>Central de ajuda</h1>
        <p>Use esta página para orientar clientes e barbearias durante a fase beta.</p>
      </section>
      <section className="settingsV6">
        <h2>Cliente não consegue entrar na fila</h2>
        <p>Confira se a barbearia está aberta, se há serviço cadastrado e se você já não está na fila.</p>
        <h2>Serviço não aparece</h2>
        <p>O dono precisa adicionar serviços no painel da barbearia ou rodar o SQL de serviços padrão no Supabase.</p>
        <h2>GPS não funciona</h2>
        <p>Ative a permissão de localização no navegador ou no Android. O app também permite pesquisar por nome ou endereço.</p>
        <h2>Barbearia não aparece</h2>
        <p>Ela precisa estar aprovada e aberta para aparecer com destaque aos clientes.</p>
        <h2>Link estranho da Vercel</h2>
        <p>O app corrige automaticamente para o domínio oficial: https://fila-facil-app-v5.vercel.app.</p>
        <a className="secondary" href="/">Voltar ao início</a>
      </section>
    </main>
  );
}
