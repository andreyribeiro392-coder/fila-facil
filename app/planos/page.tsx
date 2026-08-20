const barberFeatures = [
  "Primeiro mês promocional por R$ 6,99",
  "Depois R$ 19,99 por mês para manter a barbearia ativa",
  "Painel para abrir, fechar e acompanhar a fila",
  "Serviços com preço, duração e escolha do cliente",
  "Link próprio da barbearia para enviar no WhatsApp",
  "Avaliações, denúncias e suporte em evolução",
];

const clientFeatures = [
  "Acesso vitalício por R$ 1,00",
  "Entrar na fila pelo celular",
  "Escolher o tipo de serviço/corte",
  "Acompanhar posição e tempo estimado",
  "Favoritar barbearias e usar histórico",
  "Usar o app web ou APK oficial do Fila Fácil",
];

export default function PlanosPage() {
  return (
    <main className="ffv6 directoryV6">
      <section className="panelHero compact">
        <span className="eyebrow">Planos de lançamento</span>
        <h1>Fila Fácil com preço de começo</h1>
        <p>Valores promocionais para colocar barbearias e clientes usando o sistema desde a versão pública 0.2.</p>
        <div className="heroActions">
          <a className="primary" href="/" style={{ textDecoration: "none" }}>Abrir app</a>
          <a className="secondary" href="/suporte" style={{ textDecoration: "none" }}>Falar com suporte</a>
        </div>
      </section>

      <section className="plansGrid">
        <article className="planCard featured">
          <span className="eyebrow">Para barbearias</span>
          <h2>Plano Barbearia</h2>
          <strong className="priceBig">R$ 6,99</strong>
          <p className="muted">no primeiro mês</p>
          <strong className="priceSmall">Depois R$ 19,99/mês</strong>
          <ul>
            {barberFeatures.map((feature) => <li key={feature}>✓ {feature}</li>)}
          </ul>
          <a href="/" className="primary full" style={{ textDecoration: "none" }}>Cadastrar barbearia</a>
        </article>

        <article className="planCard">
          <span className="eyebrow">Para clientes</span>
          <h2>Acesso Cliente</h2>
          <strong className="priceBig">R$ 1,00</strong>
          <p className="muted">acesso vitalício</p>
          <strong className="priceSmall">Paga uma vez e usa para sempre</strong>
          <ul>
            {clientFeatures.map((feature) => <li key={feature}>✓ {feature}</li>)}
          </ul>
          <a href="/" className="secondary full" style={{ textDecoration: "none" }}>Entrar como cliente</a>
        </article>
      </section>

      <section className="shopCardV6 planNotice">
        <strong>Pagamento inicial</strong>
        <p>Por enquanto, o pagamento pode ser combinado pelo suporte/Pix manual. A liberação automática por cartão, Pix ou assinatura entra em uma integração futura.</p>
        <p>Barbearias que não mantiverem o plano ativo podem ser pausadas ou removidas do diretório público.</p>
      </section>
    </main>
  );
}
