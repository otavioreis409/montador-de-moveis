-- =====================================================
-- Reis montador: esquema do banco (rode no SQL Editor do Supabase)
-- =====================================================

-- Pedidos de montagem
create table if not exists pedidos (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  nome text not null,
  whatsapp text not null,
  endereco text not null,
  porte text not null check (porte in ('pequeno', 'medio', 'grande')),
  modelo text not null,
  foto_path text,
  data_hora timestamptz not null,
  duracao_horas int not null check (duracao_horas in (1, 2, 4)),
  status text not null default 'novo'
    check (status in ('novo', 'orcado', 'confirmado', 'concluido', 'cancelado')),
  valor numeric(10, 2),
  cobranca_cancelamento boolean not null default false
);

-- Bloqueios feitos pelo montador (folga, compromisso)
create table if not exists bloqueios (
  id uuid primary key default gen_random_uuid(),
  inicio timestamptz not null,
  fim timestamptz not null,
  motivo text,
  check (fim > inicio)
);

-- Segurança por linha: o público não lê dados pessoais
alter table pedidos enable row level security;
alter table bloqueios enable row level security;

-- Visitante (anon) pode só criar pedido novo
create policy "publico cria pedido novo"
  on pedidos for insert to anon
  with check (status = 'novo');

-- Montador logado vê e altera tudo
create policy "montador gerencia pedidos"
  on pedidos for all to authenticated
  using (true) with check (true);

create policy "montador gerencia bloqueios"
  on bloqueios for all to authenticated
  using (true) with check (true);

-- Horários ocupados, sem nenhum dado pessoal
create or replace function horarios_ocupados()
returns table (inicio timestamptz, fim timestamptz)
language sql
security definer
set search_path = public
as $$
  select p.data_hora,
         p.data_hora + make_interval(hours => p.duracao_horas)
  from pedidos p
  where p.status in ('novo', 'orcado', 'confirmado')
  union all
  select b.inicio, b.fim
  from bloqueios b;
$$;

grant execute on function horarios_ocupados() to anon, authenticated;

-- Impede dois pedidos no mesmo horário, mesmo com cliques simultâneos
create or replace function impede_conflito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status not in ('novo', 'orcado', 'confirmado') then
    return new;
  end if;

  if exists (
    select 1 from pedidos p
    where p.id <> new.id
      and p.status in ('novo', 'orcado', 'confirmado')
      and tstzrange(p.data_hora, p.data_hora + make_interval(hours => p.duracao_horas))
          && tstzrange(new.data_hora, new.data_hora + make_interval(hours => new.duracao_horas))
  ) or exists (
    select 1 from bloqueios b
    where tstzrange(b.inicio, b.fim)
          && tstzrange(new.data_hora, new.data_hora + make_interval(hours => new.duracao_horas))
  ) then
    raise exception 'horario_indisponivel';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_impede_conflito on pedidos;
create trigger trg_impede_conflito
  before insert or update of data_hora, duracao_horas, status on pedidos
  for each row execute function impede_conflito();

-- =====================================================
-- Fotos dos móveis
-- Crie no painel do Supabase: Storage > New bucket
--   Nome: fotos    Public: desligado (privado)
-- Depois rode as políticas abaixo:
-- =====================================================
insert into storage.buckets (id, name, public)
values ('fotos', 'fotos', false)
on conflict (id) do nothing;

create policy "visitante envia foto"
  on storage.objects for insert to anon
  with check (bucket_id = 'fotos');

create policy "montador ve fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
