-- ════════════════════════════════════════════════════════════════════
--  Hygiène Aqua2Lacs — structure de la base de données (Supabase)
--
--  À coller une seule fois dans Supabase : SQL Editor → New query → Run.
--  Le script peut être relancé sans danger (il ne supprime aucune donnée).
--
--  Principes de sécurité :
--   • Personne n'accède aux tables sans être identifié.
--   • Les agents passent uniquement par des fonctions qui vérifient leur code PIN.
--   • Le responsable se connecte avec e-mail + mot de passe et a tous les droits.
--   • Une fiche envoyée ne peut plus être modifiée ni supprimée, par personne.
-- ════════════════════════════════════════════════════════════════════

create extension if not exists pgcrypto with schema extensions;

-- ───────── Tables ─────────

create table if not exists public.zones (
  id   text primary key,
  name text not null,
  sort integer not null default 0
);

create table if not exists public.moments (
  id         text primary key,
  name       text not null,
  start_time text not null default '00:00',
  sort       integer not null default 0,
  bonus      boolean not null default false
);

create table if not exists public.tasks (
  id             text primary key,
  name           text not null,
  zone_id        text not null,
  moment_id      text not null,
  description    text not null default '',
  material       text not null default '',
  product        text not null default '',
  duration_min   integer not null default 0,
  photo_required boolean not null default false,
  passes         integer not null default 1,
  recurrence     jsonb not null default '{"type":"daily"}',
  period         text not null default 'all',
  active         boolean not null default true,
  sort           integer not null default 0,
  created_on     date not null default current_date
);

create table if not exists public.agents (
  id              text primary key,
  first_name      text not null,
  last_name       text not null default '',
  pin_hash        text not null default '',
  active          boolean not null default true,
  failed_attempts integer not null default 0,
  locked_until    timestamptz
);

create table if not exists public.settings (
  id                 integer primary key default 1 check (id = 1),
  product_by_weekday jsonb not null default '[]',
  closed_days        jsonb not null default '[]',
  active_period      text not null default 'scolaire',
  notify_email       text not null default ''
);
insert into public.settings (id) values (1) on conflict do nothing;

create table if not exists public.sheets (
  id          text primary key,
  agent_id    text not null,
  agent_name  text not null,
  day         date not null,
  started_at  timestamptz not null,
  sent_at     timestamptz,
  signature   text not null default '',
  initials    text not null default '',
  comment     text not null default '',
  anomaly     boolean not null default false,
  remaining   jsonb not null default '[]',
  -- Heure du serveur à la réception : ne dépend pas de l'horloge du téléphone.
  received_at timestamptz not null default now()
);
create index if not exists sheets_day_idx on public.sheets (day);

create table if not exists public.completions (
  id          text primary key,
  task_id     text not null,
  due_date    date not null,
  done_date   date not null,
  pass_index  integer not null default 0,
  status      text not null check (status in ('done', 'not_done', 'cancelled')),
  agent_id    text,
  at          timestamptz not null,
  reason      text not null default '',
  comment     text not null default '',
  anomaly     boolean not null default false,
  photos      jsonb not null default '[]',
  sheet_id    text,
  snapshot    jsonb not null default '{}',
  received_at timestamptz not null default now()
);
create index if not exists completions_done_idx on public.completions (done_date);
create index if not exists completions_due_idx on public.completions (due_date);
create index if not exists completions_sheet_idx on public.completions (sheet_id);

create table if not exists public.admins (
  user_id uuid primary key
);

-- ───────── Évolutions (version 2) ─────────
-- Tâches essentielles et brouillons, postes par zone, profils de test, mode seul / à deux.

alter table public.zones       add column if not exists post      integer not null default 0;
alter table public.tasks       add column if not exists essential boolean not null default false;
alter table public.tasks       add column if not exists draft     boolean not null default false;
alter table public.agents      add column if not exists is_test   boolean not null default false;
alter table public.sheets      add column if not exists mode      text;
alter table public.sheets      add column if not exists post      integer not null default 0;
alter table public.sheets      add column if not exists test      boolean not null default false;
alter table public.completions add column if not exists test      boolean not null default false;

-- Journal des suppressions de fiches par le responsable.
create table if not exists public.deletions (
  id               uuid primary key default gen_random_uuid(),
  deleted_at       timestamptz not null default now(),
  scope            text not null,
  agent_name       text not null default '',
  day              date,
  reason           text not null default '',
  sheet_count      integer not null default 0,
  completion_count integer not null default 0,
  test             boolean not null default false
);

-- Présélection de départ, appliquée une seule fois (tant que rien n'a été réglé à la main).
do $$
begin
  if exists (select 1 from public.tasks)
     and not exists (select 1 from public.tasks where essential)
     and not exists (select 1 from public.zones where post <> 0) then
    update public.tasks set essential = true where name in (
      'Accueil : changer tous les sacs poubelles', 'Autolaveuse entrée, sanitaire et déchaussage',
      'Sanitaire accueil', 'Vestiaires fitness', 'Vestiaires généraux', 'Vestiaires scolaires + couloir',
      'Sanitaires H/F/BB', 'Douches : sols, colonnes, murs', 'Robot du bassin', 'Tour des plages et poubelles',
      'Mise en service du robot wellness', 'Accueil : passage de propreté', 'Sanitaire accueil : contrôle',
      'Vestiaires : passage de propreté', 'Sanitaires H/F/BB : passage de propreté', 'Douches : passage de propreté',
      'Plage wellness', 'Hammam', 'Sauna', 'Machine rincée et rechargée',
      'Vidange et nettoyage de la pataugeoire', 'Vidange et désinfection du jacuzzi');
    update public.zones set post = 1 where id in ('acc','sanacc','dech','vest','cas','san','dou','scol','perso','fit');
    update public.zones set post = 2 where id in ('bas','tob','well','ham','ann','ext');
  end if;
end $$;

-- ───────── Fiches envoyées : verrouillage ─────────

create or replace function public.a2l_lock_sheet() returns trigger
language plpgsql as $$
begin
  if old.sent_at is not null and coalesce(current_setting('a2l.purge', true), '') <> 'on' then
    raise exception 'Fiche envoyée : elle ne peut plus être modifiée.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists a2l_lock_sheet on public.sheets;
create trigger a2l_lock_sheet before update or delete on public.sheets
  for each row execute function public.a2l_lock_sheet();

create or replace function public.a2l_lock_completion() returns trigger
language plpgsql as $$
begin
  if old.sheet_id is not null
     and coalesce(current_setting('a2l.purge', true), '') <> 'on'
     and exists (select 1 from public.sheets s where s.id = old.sheet_id and s.sent_at is not null) then
    raise exception 'Fiche envoyée : cette validation ne peut plus être modifiée.' using errcode = 'P0001';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists a2l_lock_completion on public.completions;
create trigger a2l_lock_completion before update or delete on public.completions
  for each row execute function public.a2l_lock_completion();

-- ───────── Droits du responsable ─────────

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- Le tout premier compte qui se connecte devient responsable. Ensuite, plus personne ne peut le devenir ainsi.
create or replace function public.claim_admin() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not exists (select 1 from public.admins) then
    insert into public.admins (user_id) values (auth.uid());
  end if;
  return public.is_admin();
end $$;

alter table public.zones       enable row level security;
alter table public.moments     enable row level security;
alter table public.tasks       enable row level security;
alter table public.agents      enable row level security;
alter table public.settings    enable row level security;
alter table public.sheets      enable row level security;
alter table public.completions enable row level security;
alter table public.admins      enable row level security;
alter table public.deletions   enable row level security;

drop policy if exists a2l_admin_read on public.deletions;
create policy a2l_admin_read on public.deletions for select to authenticated using (public.is_admin());

do $$
declare t text;
begin
  foreach t in array array['zones','moments','tasks','agents','settings','sheets','completions'] loop
    execute format('drop policy if exists a2l_admin_all on public.%I', t);
    execute format(
      'create policy a2l_admin_all on public.%I for all to authenticated using (public.is_admin()) with check (public.is_admin())', t);
  end loop;
end $$;

-- ───────── Agents : code PIN ─────────

create or replace function public.a2l_label(p_first text, p_last text) returns text
language sql immutable as $$
  select trim(p_first) || case when trim(p_last) <> '' then ' ' || upper(left(trim(p_last), 1)) || '.' else '' end;
$$;

-- Renvoie 'ok', 'bad_pin' ou 'locked'. Après 5 erreurs, le profil est bloqué 5 minutes.
create or replace function public.a2l_check_pin(p_agent text, p_pin text) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a public.agents;
begin
  select * into a from public.agents where id = p_agent and active for update;
  if not found then return 'bad_pin'; end if;
  if a.locked_until is not null and a.locked_until > now() then return 'locked'; end if;
  if a.pin_hash <> '' and a.pin_hash = crypt(p_pin, a.pin_hash) then
    if a.failed_attempts > 0 or a.locked_until is not null then
      update public.agents set failed_attempts = 0, locked_until = null where id = p_agent;
    end if;
    return 'ok';
  end if;
  update public.agents
     set failed_attempts = case when a.failed_attempts + 1 >= 5 then 0 else a.failed_attempts + 1 end,
         locked_until    = case when a.failed_attempts + 1 >= 5 then now() + interval '5 minutes' else null end
   where id = p_agent;
  return 'bad_pin';
end $$;

-- Écran d'accueil : la liste des profils (prénom + initiale seulement).
create or replace function public.list_agents() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', id, 'first_name', first_name, 'last_name', left(trim(last_name), 1), 'active', active,
           'is_test', is_test)
           order by first_name), '[]'::jsonb)
    from public.agents where active;
$$;

create or replace function public.agent_login(p_agent text, p_pin text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st text := public.a2l_check_pin(p_agent, p_pin);
begin
  if st <> 'ok' then return jsonb_build_object('error', st); end if;
  return jsonb_build_object('ok', true);
end $$;

-- Tout ce dont un agent a besoin pour sa journée.
create or replace function public.agent_pull(p_agent text, p_pin text, p_today date) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st text := public.a2l_check_pin(p_agent, p_pin);
  v_test boolean;
begin
  if st <> 'ok' then return jsonb_build_object('error', st); end if;
  select is_test into v_test from public.agents where id = p_agent;
  return jsonb_build_object(
    'zones',    (select coalesce(jsonb_agg(to_jsonb(z)), '[]'::jsonb) from public.zones z),
    'moments',  (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from public.moments m),
    'tasks',    (select coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.tasks t),
    'agents',   (select coalesce(jsonb_agg(jsonb_build_object(
                   'id', id, 'first_name', first_name, 'last_name', left(trim(last_name), 1), 'active', active,
                   'is_test', is_test)), '[]'::jsonb)
                   from public.agents),
    'settings', (select jsonb_build_object(
                   'product_by_weekday', product_by_weekday, 'closed_days', closed_days, 'active_period', active_period)
                   from public.settings where id = 1),
    -- Les validations du jour, plus celles des tâches périodiques récentes (pour calculer les retards).
    'completions', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb)
                      from public.completions c
                     -- Un profil de test ne voit que les validations de test, et inversement.
                     where c.test = v_test
                       and (c.done_date = p_today
                        or c.due_date = p_today
                        or (c.due_date >= p_today - 62
                            and c.status in ('done', 'cancelled')
                            and exists (select 1 from public.tasks t
                                         where t.id = c.task_id and t.recurrence->>'type' <> 'daily')))),
    -- Les collègues en service aujourd'hui (fiche non envoyée).
    'team',     (select coalesce(jsonb_agg(jsonb_build_object(
                   'agent_id', s.agent_id, 'agent_name', s.agent_name, 'mode', s.mode, 'post', s.post)), '[]'::jsonb)
                   from public.sheets s
                  where s.day = p_today and s.sent_at is null and s.agent_id <> p_agent and s.test = v_test),
    'sheets',   (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb)
                   from public.sheets s
                  where s.agent_id = p_agent and (s.sent_at is null or s.day = p_today))
  );
end $$;

-- Envoi des actions de l'agent (validations, fiche). Chaque action est acceptée ou refusée séparément.
create or replace function public.agent_sync(p_agent text, p_pin text, p_ops jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st text := public.a2l_check_pin(p_agent, p_pin);
  op jsonb;
  kind text;
  results jsonb := '[]'::jsonb;
  outcome text;
  s public.sheets;
  c public.completions;
  existing public.sheets;
  label text;
  v_test boolean;
begin
  if st <> 'ok' then return jsonb_build_object('error', st); end if;
  select public.a2l_label(first_name, last_name), is_test into label, v_test from public.agents where id = p_agent;

  for op in select * from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    kind := op->>'kind';
    outcome := 'ok';
    begin
      if kind = 'sheet' then
        s := jsonb_populate_record(null::public.sheets, op->'row');
        select * into existing from public.sheets where id = s.id;
        if s.agent_id is distinct from p_agent or (found and existing.agent_id <> p_agent) then
          outcome := 'forbidden';
        elsif found and existing.sent_at is not null then
          outcome := 'locked';
        elsif found then
          update public.sheets
             set sent_at = s.sent_at, signature = coalesce(s.signature, ''), initials = coalesce(s.initials, ''),
                 comment = coalesce(s.comment, ''), anomaly = coalesce(s.anomaly, false),
                 remaining = coalesce(s.remaining, '[]'::jsonb), received_at = now(),
                 mode = s.mode, post = coalesce(s.post, 0)
           where id = s.id;
        else
          insert into public.sheets (id, agent_id, agent_name, day, started_at, sent_at, signature, initials, comment, anomaly,
                                     remaining, mode, post, test)
          values (s.id, p_agent, label, s.day, s.started_at, s.sent_at, coalesce(s.signature, ''), coalesce(s.initials, ''),
                  coalesce(s.comment, ''), coalesce(s.anomaly, false), coalesce(s.remaining, '[]'::jsonb),
                  s.mode, coalesce(s.post, 0), v_test);
        end if;

      elsif kind = 'completion' then
        c := jsonb_populate_record(null::public.completions, op->'row');
        select * into existing from public.sheets where id = c.sheet_id;
        if c.agent_id is distinct from p_agent or c.status not in ('done', 'not_done')
           or not found or existing.agent_id <> p_agent then
          outcome := 'forbidden';
        elsif existing.sent_at is not null then
          outcome := 'locked';
        else
          insert into public.completions (id, task_id, due_date, done_date, pass_index, status, agent_id, at,
                                          reason, comment, anomaly, photos, sheet_id, snapshot, test)
          values (c.id, c.task_id, c.due_date, c.done_date, coalesce(c.pass_index, 0), c.status, p_agent, c.at,
                  coalesce(c.reason, ''), coalesce(c.comment, ''), coalesce(c.anomaly, false),
                  coalesce(c.photos, '[]'::jsonb), c.sheet_id, coalesce(c.snapshot, '{}'::jsonb), v_test)
          on conflict (id) do update
             set reason = excluded.reason, comment = excluded.comment, anomaly = excluded.anomaly, photos = excluded.photos
           where public.completions.agent_id = p_agent;
        end if;

      elsif kind = 'delete_completion' then
        delete from public.completions where id = op->>'id' and agent_id = p_agent;

      elsif kind = 'delete_sheet' then
        delete from public.sheets
         where id = op->>'id' and agent_id = p_agent and sent_at is null
           and not exists (select 1 from public.completions where sheet_id = op->>'id');

      else
        outcome := 'unknown';
      end if;
    exception when others then
      outcome := 'error: ' || sqlerrm;
    end;
    results := results || jsonb_build_object('outcome', outcome);
  end loop;
  return jsonb_build_object('results', results);
end $$;

-- Responsable : créer ou modifier un profil (le code PIN n'est jamais stocké en clair).
drop function if exists public.admin_save_agent(text, text, text, boolean, text);
create or replace function public.admin_save_agent(
  p_id text, p_first text, p_last text, p_active boolean, p_pin text default null, p_test boolean default false
) returns void
language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_admin() then raise exception 'Accès réservé au responsable.'; end if;
  insert into public.agents (id, first_name, last_name, active, is_test, pin_hash)
  values (p_id, p_first, p_last, p_active, coalesce(p_test, false),
          case when p_pin is null then '' else crypt(p_pin, gen_salt('bf', 8)) end)
  on conflict (id) do update
     set first_name = excluded.first_name, last_name = excluded.last_name, active = excluded.active,
         is_test = excluded.is_test,
         pin_hash = case when p_pin is null then public.agents.pin_hash else excluded.pin_hash end,
         failed_attempts = case when p_pin is null then public.agents.failed_attempts else 0 end,
         locked_until = case when p_pin is null then public.agents.locked_until else null end;
end $$;

-- Responsable : supprimer une fiche (même envoyée) avec ses validations. Une trace est conservée.
create or replace function public.admin_delete_sheet(p_id text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  s public.sheets;
  n integer;
begin
  if not public.is_admin() then raise exception 'Accès réservé au responsable.'; end if;
  select * into s from public.sheets where id = p_id;
  if not found then return; end if;
  perform set_config('a2l.purge', 'on', true);
  delete from public.completions where sheet_id = p_id;
  get diagnostics n = row_count;
  delete from public.sheets where id = p_id;
  perform set_config('a2l.purge', '', true);
  insert into public.deletions (scope, agent_name, day, reason, sheet_count, completion_count, test)
  values ('sheet', s.agent_name, s.day, coalesce(p_reason, ''), 1, n, s.test);
end $$;

-- Responsable : vider toutes les fiches de test ('tests') ou absolument toutes les fiches ('all').
create or replace function public.admin_wipe(p_scope text, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare
  n_sheets integer;
  n_comps integer;
begin
  if not public.is_admin() then raise exception 'Accès réservé au responsable.'; end if;
  if p_scope not in ('tests', 'all') then raise exception 'Portée inconnue.'; end if;
  perform set_config('a2l.purge', 'on', true);
  delete from public.completions where p_scope = 'all' or test;
  get diagnostics n_comps = row_count;
  delete from public.sheets where p_scope = 'all' or test;
  get diagnostics n_sheets = row_count;
  perform set_config('a2l.purge', '', true);
  insert into public.deletions (scope, reason, sheet_count, completion_count, test)
  values (p_scope, coalesce(p_reason, ''), n_sheets, n_comps, p_scope = 'tests');
end $$;

-- ───────── Qui a le droit d'appeler quoi ─────────

revoke all on all tables in schema public from anon;
grant select, insert, update, delete on all tables in schema public to authenticated;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.list_agents()                         to anon, authenticated;
grant execute on function public.agent_login(text, text)               to anon, authenticated;
grant execute on function public.agent_pull(text, text, date)          to anon, authenticated;
grant execute on function public.agent_sync(text, text, jsonb)         to anon, authenticated;
grant execute on function public.is_admin()                            to authenticated;
grant execute on function public.claim_admin()                         to authenticated;
grant execute on function public.admin_save_agent(text, text, text, boolean, text, boolean) to authenticated;
grant execute on function public.admin_delete_sheet(text, text)       to authenticated;
grant execute on function public.admin_wipe(text, text)               to authenticated;
