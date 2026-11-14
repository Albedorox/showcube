-- Admin-Konten (ShowCube-Team): sehen und verwalten alle Betriebe, Bildschirme und Inhalte.
-- Ein Konto wird Admin nur per SQL im Supabase-Dashboard (SQL Editor), nie über die Website:
--   insert into public.admins (user_id) select id from auth.users where email = 'du@beispiel.de';
-- Kein Secret Key im Browser nötig: die Zugriffsregeln lassen Admins einfach überall durch.

create table public.admins (
  user_id uuid primary key references auth.users on delete cascade,
  erstellt timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.ist_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Alle Zugriffsregeln laufen über ist_mitglied(). Admins zählen dort als Mitglied jedes Betriebs.
create or replace function public.ist_mitglied(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mitglieder where betrieb_id = b and user_id = (select auth.uid()))
      or exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;

-- Übersicht für Admins: alle Betriebe mit Inhaber-E-Mail und Zahl der Bildschirme.
create function public.admin_betriebe() returns table (id uuid, name text, email text, bildschirme bigint, online bigint, erstellt timestamptz)
language sql stable security definer set search_path = '' as $$
  select b.id, b.name,
    (select u.email::text from public.mitglieder m join auth.users u on u.id = m.user_id where m.betrieb_id = b.id order by m.erstellt limit 1),
    (select count(*) from public.bildschirme s where s.betrieb_id = b.id),
    (select count(*) from public.bildschirme s where s.betrieb_id = b.id and s.zuletzt > now() - interval '35 seconds'),
    b.erstellt
  from public.betriebe b
  where public.ist_admin()
  order by b.erstellt;
$$;

-- Koppeln für einen bestimmten Betrieb (Admin richtet eine Box beim Kunden ein).
-- Ohne p_betrieb wie bisher der eigene Betrieb.
create or replace function public.bildschirm_koppeln(p_code text, p_name text, p_standort text, p_ausrichtung text, p_show_id text, p_betrieb uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b uuid := coalesce(p_betrieb, public.mein_betrieb());
  r public.bildschirme;
begin
  if b is null or not public.ist_mitglied(b) then raise exception 'Kein Betrieb zu diesem Konto' using errcode = '42501'; end if;
  if (select count(*) from public.koppel_versuche where user_id = me and zeit > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele falsche Codes. Bitte in einer Stunde nochmal versuchen.' using errcode = 'P0001';
  end if;
  select * into r from public.bildschirme
    where code = regexp_replace(coalesce(p_code, ''), '\D', '', 'g') and betrieb_id is null and code_bis > now()
    for update;
  if not found then
    insert into public.koppel_versuche (user_id) values (me);
    raise exception 'Diesen Code kennen wir nicht. Steht er noch auf dem Fernseher?' using errcode = 'P0001';
  end if;
  update public.bildschirme set betrieb_id = b, code = null, code_bis = null, gekoppelt = now(),
      name = coalesce(nullif(trim(p_name), ''), 'Bildschirm'), standort = coalesce(trim(p_standort), ''),
      ausrichtung = case when p_ausrichtung = 'port' then 'port' else 'land' end, show_id = p_show_id,
      protokoll = public.protokoll_plus('[]', 'Gekoppelt')
    where id = r.id returning * into r;
  return to_jsonb(r) - 'geraet' - 'foto';
end $$;
drop function public.bildschirm_koppeln(text, text, text, text, text);

revoke execute on function public.ist_admin, public.admin_betriebe, public.bildschirm_koppeln from public, anon;
grant execute on function public.ist_admin, public.admin_betriebe, public.bildschirm_koppeln to authenticated;
