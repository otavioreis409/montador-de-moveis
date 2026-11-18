# Contexto do projeto para o Codex

Leia este arquivo antes de alterar o site. Ele resume o projeto, o conteúdo recebido no ZIP original e as decisões já tomadas para que novas páginas e mudanças possam ser feitas sem recomeçar o levantamento.

## Projeto atual

- Negócio: Reis Montador, montagem de móveis novos em Amparo (SP) e região.
- Repositório GitHub: `https://github.com/otavioreis409/montador-de-moveis`.
- Site publicado: `https://reis-montador.vercel.app/`.
- Painel do montador: `https://reis-montador.vercel.app/painel.html`.
- Hospedagem: Vercel, site estático conectado ao branch `main`; commits enviados ao GitHub acionam deploy automático.
- Banco e autenticação: Supabase. A configuração pública do projeto está em `js/config.js`; nunca adicionar uma chave `secret` ou `service_role` ao site.
- Idioma e público: português brasileiro, clientes locais e uso prioritário em celular.

## Arquivo original recebido

O primeiro arquivo enviado foi `C:\Users\otavi\Downloads\reis-montador_1.zip`. Ele continha a pasta `reis-montador` com:

- `index.html`: página pública original de apresentação e agendamento.
- `painel.html`: login e painel do montador.
- `css/estilo.css` e `css/tema-anuncio.css`: estilos principais e tema visual alternativo.
- `js/config.js`: URL do Supabase, chave publishable e WhatsApp comercial.
- `js/horarios.js`: cálculo dos horários disponíveis.
- `js/publico.js`: formulário e fluxo de agendamento.
- `js/painel.js`: login, pedidos e bloqueios da agenda.
- `supabase/schema.sql`: tabelas, políticas, validações, agenda e bucket privado de fotos.
- `test/horarios.test.js`: testes da lógica de horários.
- `img/foto-reis.jpg`: foto do montador incluída no ZIP original.

A foto do montador foi retirada da apresentação publicada a pedido do usuário. Não a reintroduza em páginas, prévias ou materiais novos sem solicitação explícita.

## O que já foi feito

- Site público responsivo com apresentação, tipos de móveis, duração estimada, dúvidas e formulário para solicitar montagem.
- Formulário conectado à agenda do Supabase; exibe horários disponíveis e coleta nome, WhatsApp, endereço, modelo/marca e foto opcional.
- Painel autenticado para consultar pedidos, atualizar status/valor e bloquear horários.
- Ações para aceitar montagem (status `confirmado`) ou recusar (status `recusado`, libera o horário).
- Botão de WhatsApp em cada pedido do painel. Abre a conversa com o número do cliente e prepara texto com serviço, tamanho, horário, endereço e valor quando informado. Não envia a mensagem automaticamente.
- Validação dos horários no banco, incluindo conflitos, expediente e pedidos simultâneos; arquivos de foto são privados e limitados.
- Textos revisados em português; o título da seção de móveis é **“O que montamos”**.
- Código e banco vivem neste repositório; `LEIA-ME.md` contém o guia de configuração/publicação.

Commits relevantes recentes:

- `caadd8e` — validações e atualização da agenda.
- `676e1b1` — ações de aceitar/recusar montagens.
- `e1f7f85` — atalho de WhatsApp nos pedidos.
- `95a69d2` — revisão dos textos em português.

## Criar uma nova página

1. Confira primeiro se a solicitação é para uma página pública, uma tela do painel ou uma página independente. Não copie dados privados de clientes para exemplos ou demonstrações.
2. Para uma nova página estática pública, crie um HTML na raiz do repositório, por exemplo `sobre.html`, com `lang="pt-BR"`, metadados próprios e `<link rel="stylesheet" href="css/estilo.css">`.
3. Reaproveite os componentes e classes de `index.html` quando fizer sentido: `.topo`, `.marca`, `.secao`, `.botao`, `.rodape` e a escala de cores definida em `css/estilo.css`.
4. Preserve a experiência mobile e os links de navegação. Evite duplicar estilos gerais; coloque regras realmente específicas em um arquivo CSS separado.
5. Não carregue `js/publico.js` ou `js/painel.js` numa página que não tenha os elementos HTML que esses scripts esperam. Inclua apenas os scripts necessários.
6. Páginas privadas ou internas devem receber `noindex` e manter a autenticação/autorização apropriada; `noindex` sozinho não protege conteúdo.
7. Revise a redação em português brasileiro e mantenha consistentes os termos “tamanho do móvel”, “horário disponível”, “montagem” e “montador”.
8. Antes de publicar, confira o diff e a sintaxe dos JavaScript alterados. Se a mudança afetar agenda, banco ou fluxo de pedidos, revise também `supabase/schema.sql` e os testes pertinentes.
9. A Vercel publica arquivos estáticos da raiz sem comando de build. Após enviar o commit a `main`, confira se o deploy ficou pronto antes de afirmar que a mudança está no ar.

## Banco de dados e deploy

- Mudanças no esquema do banco estão em `supabase/schema.sql`. Aplicá-las pelo SQL Editor do Supabase é uma etapa distinta do deploy do site.
- O schema atual permite os status `novo`, `orcado`, `confirmado`, `concluido`, `cancelado` e `recusado`.
- O schema foi projetado para poder ser executado novamente e atualizar regras sem apagar pedidos/bloqueios. Ainda assim, leia o script e informe ao usuário quando uma alteração exigir nova execução no Supabase.
- Para publicar código: commit e push para `main`; o projeto Vercel conectado faz deploy automático.
- Teste da lógica de horários: `node --test test/horarios.test.js`.

## Cuidados ao editar

- Não apagar ou substituir registros de pedidos, bloqueios, usuários ou fotos.
- Não expor dados pessoais de clientes em páginas públicas, logs, exemplos, screenshots ou mensagens de demonstração.
- O botão de WhatsApp inicia uma conversa com texto preenchido; o montador decide se envia.
- A chave `publishable` no `js/config.js` é própria para uso público com políticas de segurança corretas. Nunca inserir chaves secretas ou credenciais de login em arquivos versionados.
- Manter a foto original fora do site conforme a preferência já registrada.
- Responder ao usuário em português.
