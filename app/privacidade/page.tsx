export default function PrivacidadePage() {
  return (
    <main className="ffv6 legalPage">
      <section className="panelHero compact">
        <span className="eyebrow">Privacidade</span>
        <h1>Política de Privacidade</h1>
        <p>O Fila Fácil usa apenas os dados necessários para organizar filas de barbearias.</p>
      </section>
      <section className="settingsV6">
        <h2>Dados usados</h2>
        <p>Podemos usar nome de conta, nome de acesso, senha protegida, localização aproximada quando autorizada, histórico local do aparelho e dados da barbearia cadastrada.</p>
        <h2>Localização</h2>
        <p>A localização serve para ordenar barbearias próximas e confirmar o cadastro do estabelecimento. O app continua funcionando sem GPS, mas alguns recursos ficam limitados.</p>
        <h2>Fila</h2>
        <p>Quando o cliente entra na fila, a barbearia visualiza o nome informado na conta, serviço escolhido, posição e status do atendimento.</p>
        <h2>Segurança</h2>
        <p>As ações importantes passam pelo servidor e pelo Supabase. O aplicativo Android não guarda senhas secretas do banco.</p>
        <h2>Contato</h2>
        <p>Use a tela de suporte do aplicativo para pedir remoção, correção ou revisão de dados.</p>
        <a className="secondary" href="/">Voltar ao início</a>
      </section>
    </main>
  );
}
