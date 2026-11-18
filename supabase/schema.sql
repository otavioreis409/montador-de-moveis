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
  constraint pedidos_porte_duracao_check check (
    (porte = 'pequeno' and duracao_horas = 1) or
    (porte = 'medio' and duracao_horas = 2) or
    (porte = 'grande' and duracao_horas = 4)
  ),
  status text not null default 'novo'
    check (status in ('novo', 'orcado', 'confirmado', 'concluido', 'cancelado')),
  valor numeric(10, 2),
  cobranca_cancelamento boolean not null default false
);

-- Applies the porte/duration rule to databases created with an older schema.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pedidos_porte_duracao_check'
      and conrelid = 'public.pedidos'::regclass
  ) then
    alter table public.pedidos
      add constraint pedidos_porte_duracao_check check (
        (porte = 'pequeno' and duracao_horas = 1) or
        (porte = 'medio' and duracao_horas = 2) or
        (porte = 'grande' and duracao_horas = 4)
      ) not valid;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'pedidos_campos_obrigatorios_check'
      and conrelid = 'public.pedidos'::regclass
  ) then
    alter table public.pedidos
      add constraint pedidos_campos_obrigatorios_check check (
        length(btrim(nome)) > 0
        and length(btrim(whatsapp)) > 0
        and length(btrim(endereco)) > 0
        and length(btrim(modelo)) > 0
        and length(regexp_replace(whatsapp, '[^0-9]', '', 'g')) in (10, 11)
      ) not valid;
  end if;
end;
$$;

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
drop policy if exists "publico cria pedido novo" on pedidos;
create policy "publico cria pedido novo"
  on pedidos for insert to anon
  with check (
    status = 'novo'
    and valor is null
    and cobranca_cancelamento = false
    and (
      foto_path is null or
      foto_path ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|heic|heif|avif)$'
    )
  );

-- Montador logado vê e altera tudo
drop policy if exists "montador gerencia pedidos" on pedidos;
create policy "montador gerencia pedidos"
  on pedidos for all to authenticated
  using (true) with check (true);

drop policy if exists "montador gerencia bloqueios" on bloqueios;
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
    and p.data_hora + make_interval(hours => p.duracao_horas) > now()
  union all
  select b.inicio, b.fim
  from bloqueios b
  where b.fim > now();
$$;

grant execute on function horarios_ocupados() to anon, authenticated;

-- Validate appointments on the server and serialize schedule writes so
-- simultaneous requests cannot claim the same time slot.
create or replace function impede_conflito()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  inicio_local timestamp;
  fim_local timestamp;
  fim_expediente time;
begin
  if new.status not in ('novo', 'orcado', 'confirmado') then
    return new;
  end if;

  new.duracao_horas := case new.porte
    when 'pequeno' then 1
    when 'medio' then 2
    when 'grande' then 4
    else null
  end;
  if new.duracao_horas is null then
    raise exception 'porte_invalido';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('reis-montador-agenda', 0));

  if new.data_hora <= now() then
    raise exception 'horario_passado';
  end if;

  inicio_local := new.data_hora at time zone 'America/Sao_Paulo';
  if extract(minute from inicio_local) <> 0
    or extract(second from inicio_local) <> 0 then
    raise exception 'horario_invalido';
  end if;

  if extract(dow from inicio_local) = 0 then
    raise exception 'dia_fechado';
  end if;

  fim_expediente := case when extract(dow from inicio_local) = 6
    then time '12:00'
    else time '18:00'
  end;
  fim_local := inicio_local + make_interval(hours => new.duracao_horas);
  if inicio_local::time < time '08:00'
    or fim_local::date <> inicio_local::date
    or fim_local::time > fim_expediente then
    raise exception 'fora_expediente';
  end if;

  if exists (
    select 1 from pedidos p
    where p.id <> new.id
      and p.status in ('novo', 'orcado', 'confirmado')
      and tstzrange(p.data_hora, p.data_hora + make_interval(hours => p.duracao_horas), '[)')
          && tstzrange(new.data_hora, new.data_hora + make_interval(hours => new.duracao_horas), '[)')
  ) or exists (
    select 1 from bloqueios b
    where tstzrange(b.inicio, b.fim, '[)')
          && tstzrange(new.data_hora, new.data_hora + make_interval(hours => new.duracao_horas), '[)')
  ) then
    raise exception 'horario_indisponivel';
  end if;

  return new;
end;
$$;

-- Prevent overlapping appointments from being blocked as personal time and
-- serialize block changes with appointment submissions.
create or replace function valida_bloqueio_agenda()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('reis-montador-agenda', 0));

  if tg_op = 'DELETE' then
    return old;
  end if;

  if new.inicio <= now() then
    raise exception 'bloqueio_passado';
  end if;

  if exists (
    select 1 from pedidos p
    where p.status in ('novo', 'orcado', 'confirmado')
      and tstzrange(p.data_hora, p.data_hora + make_interval(hours => p.duracao_horas), '[)')
          && tstzrange(new.inicio, new.fim, '[)')
  ) then
    raise exception 'bloqueio_conflita_pedido';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_impede_conflito on pedidos;
create trigger trg_impede_conflito
  before insert or update of data_hora, duracao_horas, status on pedidos
  for each row execute function impede_conflito();

drop trigger if exists trg_valida_bloqueio_agenda on bloqueios;
create trigger trg_valida_bloqueio_agenda
  before insert or update or delete on bloqueios
  for each row execute function valida_bloqueio_agenda();

-- =====================================================
-- Fotos dos móveis
-- Keep client uploads private and capped at the same 8 MB limit as the form.
-- =====================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'fotos', 'fotos', false, 8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'image/avif']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "visitante envia foto" on storage.objects;
create policy "visitante envia foto"
  on storage.objects for insert to anon
  with check (
    bucket_id = 'fotos'
    and name ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp|gif|heic|heif|avif)$'
  );

drop policy if exists "montador ve fotos" on storage.objects;
create policy "montador ve fotos"
  on storage.objects for select to authenticated
  using (bucket_id = 'fotos');
