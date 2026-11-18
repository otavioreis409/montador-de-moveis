# Reis montador: como colocar no ar

## 1. Banco de dados (Supabase)
1. Crie um projeto novo no Supabase.
2. Abra **SQL Editor**, cole o conteúdo de `supabase/schema.sql` e clique em **Run**.
3. Em **Storage**, crie um bucket chamado `fotos` e deixe **privado**.
4. Em **Authentication > Users**, crie o usuário do seu pai (e-mail e senha).
5. Em **Settings > API**, copie a **Project URL** e a chave **anon public**.

## 2. Configuração do site
Abra `js/config.js` e troque:
- `COLE_AQUI_A_PROJECT_URL` pela Project URL
- `COLE_AQUI_A_ANON_KEY` pela chave anon public

Nunca coloque a chave `service_role` nesse arquivo.

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
