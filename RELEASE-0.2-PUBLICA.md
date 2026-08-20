# Fila Fácil 0.2 — versão pública

Esta é a versão preparada para lançamento público controlado.

## URL oficial

https://fila-facil-app-v5.vercel.app

## O que foi fechado nesta versão

- Interface pública com identidade Fila Fácil 0.2.
- Correção automática de links de preview da Vercel para o domínio oficial.
- Páginas públicas: suporte, privacidade, termos, como funciona, lançamento e testes.
- Healthcheck público em `/api/health`.
- Manifesto PWA para instalação como app web.
- Aviso de internet offline.
- Aviso quando uma barbearia não tem serviços cadastrados.
- Diagnóstico seguro em `/testes`.
- APIs preparadas para avaliação e denúncia após SQL.
- SQL v6 Etapa 1 completa já incluído no repositório.

## Checklist antes de divulgar

1. Esperar a Vercel ficar Ready.
2. Abrir `/testes` e conferir se não há erro vermelho.
3. Testar com uma barbearia aprovada.
4. Testar cliente escolhendo serviço e entrando na fila.
5. Testar dono chamando, atendendo e concluindo.
6. Testar link copiado.
7. Gerar APK/AAB Android com o ZIP final.

## Observação

O app Android é WebView. Melhorias no site aparecem no app sem precisar atualizar APK, desde que o app esteja apontando para a URL oficial.
