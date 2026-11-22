-- Benutzerverwaltung für Admins (Panel → „Benutzer“).
--
-- Admins sehen alle Konten mit Abo, letzter Anmeldung, Zwei-Faktor und Boxen und können:
-- - die Abo-Stufe ändern (Cloud oder Pro, befristet, KI-Kontingent),
-- - ein Konto sperren und wieder freigeben,
-- - die E-Mail von Hand als bestätigt markieren,
-- - ein Konto mit seinem Betrieb löschen.
--
-- Sicherheit:
-- - Jede Funktion prüft zuerst ist_admin() auf dem Server (Admin-Konto und, falls eingerichtet, Zwei-Faktor-Code).
--   Was das Panel anzeigt oder schickt, spielt dafür keine Rolle.
-- - Admin-Konten (auch das eigene) lassen sich hier weder sperren noch löschen. Admin wird man weiter nur per SQL.
-- - Jede Änderung landet in admin_protokoll (wer, wann, was, bei wem).
-- - Gesperrte Konten kommen auch mit einer noch gültigen Sitzung nicht mehr an Daten (konto_ok() in ist_mitglied).

-- ---------- Gesperrte Konten sofort draußen ----------
-- Supabase lehnt die Anmeldung gesperrter Konten ab (banned_until). Eine schon laufende Sitzung hätte aber bis zu
-- einer Stunde weiter Zugriff. Darum prüfen die Zugriffsregeln die Sperre selbst.
create function public.konto_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aal_ok() and not exists (
    select 1 from auth.users where id = (select auth.uid()) and banned_until is not null and banned_until > now());
$$;
revoke execute on function public.konto_ok() from public, anon;
grant execute on function public.konto_ok() to authenticated;

create or replace function public.ist_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid())) and public.konto_ok();
$$;

create or replace function public.ist_mitglied(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.konto_ok() and (
    exists (select 1 from public.mitglieder where betrieb_id = b and user_id = (select auth.uid()))
    or exists (select 1 from public.admins where user_id = (select auth.uid())));
$$;

-- ---------- Protokoll ----------
create table public.admin_protokoll (
  id bigint generated always as identity primary key,
  zeit timestamptz not null default now(),
  admin_id uuid references auth.users on delete set null,
  admin_email text,
  ziel_id uuid,                -- bleibt stehen, auch wenn das Konto gelöscht ist
  ziel_email text,
  aktion text not null,
  details jsonb not null default '{}'
);
create index on public.admin_protokoll (ziel_id, zeit desc);
alter table public.admin_protokoll enable row level security;
revoke all on public.admin_protokoll from public, anon, authenticated;

-- Hilfen (nicht von außen aufrufbar).
create function public.admin_pruefen() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.ist_admin() then raise exception 'Nur für Admins.' using errcode = '42501'; end if;
end $$;

create function public.admin_merken(p_ziel uuid, p_aktion text, p_details jsonb default '{}') returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_protokoll (admin_id, admin_email, ziel_id, ziel_email, aktion, details)
  select (select auth.uid()), (select email::text from auth.users where id = (select auth.uid())),
         p_ziel, (select email::text from auth.users where id = p_ziel), p_aktion, coalesce(p_details, '{}');
$$;

-- Ziel prüfen: muss ein echtes Konto sein (keine Box) und darf kein Admin sein.
create function public.admin_ziel(p_user uuid) returns auth.users
language plpgsql stable security definer set search_path = '' as $$
declare u auth.users;
begin
  select * into u from auth.users where id = p_user;
  if not found or coalesce(u.is_anonymous, false) then raise exception 'Dieses Konto gibt es nicht.' using errcode = 'P0002'; end if;
  if exists (select 1 from public.admins where user_id = p_user) then
    raise exception 'Admin-Konten lassen sich hier nicht ändern.' using errcode = '42501';
  end if;
  return u;
end $$;

revoke execute on function public.admin_pruefen(), public.admin_merken(uuid, text, jsonb), public.admin_ziel(uuid) from public, anon, authenticated;

-- ---------- Liste aller Konten ----------
create function public.admin_benutzer()
returns table (id uuid, email text, erstellt timestamptz, zuletzt timestamptz, bestaetigt boolean, gesperrt boolean,
               zwei_faktor boolean, admin boolean, betrieb_id uuid, betrieb text, rolle text,
               stufe text, bis timestamptz, ki_grenze int, ki_genutzt int, bildschirme bigint, online bigint)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_pruefen();
  return query
  select u.id, u.email::text, u.created_at, u.last_sign_in_at, u.email_confirmed_at is not null,
    coalesce(u.banned_until > now(), false),
    exists (select 1 from auth.mfa_factors f where f.user_id = u.id and f.status = 'verified'),
    exists (select 1 from public.admins ad where ad.user_id = u.id),
    m.betrieb_id, b.name, m.rolle,
    coalesce(a.stufe, 'cloud'), a.bis, coalesce(a.ki_grenze, 50),
    case when m.betrieb_id is null then 0 else public.ki_genutzt(m.betrieb_id) end,
    (select count(*) from public.bildschirme s where s.betrieb_id = m.betrieb_id),
    (select count(*) from public.bildschirme s where s.betrieb_id = m.betrieb_id and s.zuletzt > now() - interval '35 seconds')
  from auth.users u
  left join lateral (select mm.betrieb_id, mm.rolle from public.mitglieder mm where mm.user_id = u.id order by mm.erstellt limit 1) m on true
  left join public.betriebe b on b.id = m.betrieb_id
  left join public.abos a on a.betrieb_id = m.betrieb_id
  where not coalesce(u.is_anonymous, false)
  order by u.created_at desc;
end $$;

-- ---------- Abo ändern ----------
-- p_bis leer = unbefristet. p_ki_grenze leer = bleibt, wie es ist (neu: 50).
create function public.admin_abo_setzen(p_betrieb uuid, p_stufe text, p_bis timestamptz default null, p_ki_grenze int default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  vorher public.abos;
  nachher public.abos;
  inhaber uuid;
begin
  perform public.admin_pruefen();
  if p_stufe is null or p_stufe not in ('cloud', 'pro') then raise exception 'Unbekannte Abo-Stufe.' using errcode = '22023'; end if;
  if p_ki_grenze is not null and (p_ki_grenze < 0 or p_ki_grenze > 10000) then raise exception 'KI-Kontingent muss zwischen 0 und 10000 liegen.' using errcode = '22023'; end if;
  if not exists (select 1 from public.betriebe where id = p_betrieb) then raise exception 'Diesen Betrieb gibt es nicht.' using errcode = 'P0002'; end if;
  select * into vorher from public.abos where betrieb_id = p_betrieb;
  insert into public.abos (betrieb_id, stufe, bis, ki_grenze)
    values (p_betrieb, p_stufe, p_bis, coalesce(p_ki_grenze, 50))
  on conflict (betrieb_id) do update set stufe = excluded.stufe, bis = excluded.bis,
    ki_grenze = coalesce(p_ki_grenze, public.abos.ki_grenze)
  returning * into nachher;
  select user_id into inhaber from public.mitglieder where betrieb_id = p_betrieb order by erstellt limit 1;
  perform public.admin_merken(inhaber, 'abo', jsonb_build_object('betrieb', p_betrieb,
    'vorher', jsonb_build_object('stufe', coalesce(vorher.stufe, 'cloud'), 'bis', vorher.bis, 'ki_grenze', vorher.ki_grenze),
    'nachher', jsonb_build_object('stufe', nachher.stufe, 'bis', nachher.bis, 'ki_grenze', nachher.ki_grenze)));
  return to_jsonb(nachher);
end $$;

-- ---------- Sperren und freigeben ----------
create function public.admin_sperren(p_user uuid, p_sperren boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_pruefen();
  perform public.admin_ziel(p_user);
  -- Ein fester Zeitpunkt weit in der Zukunft statt „infinity“, das kann nicht jedes Programm lesen.
  update auth.users set banned_until = case when p_sperren then now() + interval '100 years' else null end where id = p_user;
  -- Laufende Sitzungen beenden: ohne Sitzung lässt sich die Anmeldung nicht verlängern.
  if p_sperren then delete from auth.sessions where user_id = p_user; end if;
  perform public.admin_merken(p_user, case when p_sperren then 'gesperrt' else 'freigegeben' end);
end $$;

-- ---------- E-Mail von Hand bestätigen (falls die Mail nicht ankommt) ----------
create function public.admin_bestaetigen(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_pruefen();
  perform public.admin_ziel(p_user);
  update auth.users set email_confirmed_at = coalesce(email_confirmed_at, now()) where id = p_user;
  perform public.admin_merken(p_user, 'bestätigt');
end $$;

-- ---------- Konto löschen ----------
-- Löscht das Konto und jeden Betrieb, in dem es das einzige Mitglied ist (mit Slideshows, Abo, gekoppelten Boxen).
-- Gibt die gelöschten Betriebe zurück, damit das Panel danach deren Dateien im Speicher wegräumt.
create function public.admin_loeschen(p_user uuid) returns uuid[]
language plpgsql security definer set search_path = '' as $$
declare
  u auth.users;
  weg uuid[];
begin
  perform public.admin_pruefen();
  u := public.admin_ziel(p_user);
  select coalesce(array_agg(m.betrieb_id), '{}') into weg from public.mitglieder m
    where m.user_id = p_user and not exists (select 1 from public.mitglieder o where o.betrieb_id = m.betrieb_id and o.user_id <> p_user);
  perform public.admin_merken(p_user, 'gelöscht', jsonb_build_object('betriebe', to_jsonb(weg), 'erstellt', u.created_at));
  delete from public.betriebe where id = any (weg);
  delete from auth.users where id = p_user;
  return weg;
end $$;

-- ---------- Protokoll lesen ----------
create function public.admin_protokoll_lesen(p_user uuid default null)
returns table (zeit timestamptz, admin_email text, ziel_email text, aktion text, details jsonb)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  perform public.admin_pruefen();
  return query select p.zeit, p.admin_email, p.ziel_email, p.aktion, p.details from public.admin_protokoll p
    where p_user is null or p.ziel_id = p_user order by p.zeit desc limit 50;
end $$;

revoke execute on function public.admin_benutzer(), public.admin_abo_setzen(uuid, text, timestamptz, int), public.admin_sperren(uuid, boolean),
  public.admin_bestaetigen(uuid), public.admin_loeschen(uuid), public.admin_protokoll_lesen(uuid) from public, anon;
grant execute on function public.admin_benutzer(), public.admin_abo_setzen(uuid, text, timestamptz, int), public.admin_sperren(uuid, boolean),
  public.admin_bestaetigen(uuid), public.admin_loeschen(uuid), public.admin_protokoll_lesen(uuid) to authenticated;
