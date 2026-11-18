# Reis montador: como colocar no ar

## 1. Banco de dados (Supabase)
1. Crie um projeto no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**. O script cria e configura o bucket privado `fotos`.
3. Em **Authentication > Users**, crie ou convide o usuário do montador.
4. Em **Settings > API Keys**, confira a **Project URL** e a chave **publishable**.

## 2. Configuração do site
O arquivo `js/config.js` já está configurado para este projeto Supabase. Use apenas a chave **publishable** no site.

Nunca coloque uma chave **secret/service_role** nesse arquivo.

Para atualizar um banco já criado, o `schema.sql` pode ser executado novamente: ele recria as políticas e gatilhos com as validações atuais, sem apagar pedidos ou bloqueios.

## 3. Publicar (Vercel)
1. Envie a pasta `reis-montador` para um repositório no GitHub, ou arraste a pasta na Vercel.
2. Importe o projeto como site estático, sem comando de build.
3. Acesse a URL gerada. A página pública é `index.html`. O painel é `painel.html`.

## 4. Testar
- Na página pública, escolha um dia de semana, porte pequeno, e envie um pedido de teste.
- No painel, entre com o usuário criado no passo 1 e confira o pedido.
- Para testar a lógica de horários: `node --test test/horarios.test.js`

## Dicas
- O painel não aparece no Google: a página tem `noindex`.
- Para um domínio próprio, como reismontador.com.br, configure em **Domains** na Vercel.
