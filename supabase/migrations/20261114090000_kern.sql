-- ShowCube Backend, kleinster Kern.
--
-- Wer ist wer:
-- - Ein Betrieb ist ein Kundenkonto (Pizzeria, Makler). Menschen melden sich mit E-Mail und Passwort an
--   und sind Mitglied in genau einem Betrieb (mehrere Nutzer pro Betrieb gehen später in der Pro-Stufe).
-- - Eine Box meldet sich anonym an (eigenes, unsichtbares Konto pro Box) und bekommt einen Koppel-Code.
--   Erst wenn ein Mitglied den Code im Panel eingibt, gehört die Box zu dessen Betrieb.
-- - Das Panel speichert Slideshows und Dateien. Beim Veröffentlichen legt es ein Paket ab
--   (dasselbe Format wie die USB-Datei, Dateien als Verweis in den Speicher).
-- - Die Box ruft alle paar Sekunden box_stand() auf: das ist Herzschlag und Abruf in einem.
--   zuletzt/zustand sind damit schon die Grundlage für die Ausfall-Erkennung (Schritt 2).

-- ---------- Betriebe und Mitglieder ----------
create table public.betriebe (
  id uuid primary key default gen_random_uuid(),
  name text not null default '',
  hinweis jsonb,                                  -- Sofort-Hinweis: {text, until, screens[]}
  einstellungen jsonb not null default '{}',     -- z.B. {"alert": {"on": true, "after": 10, "to": "..."}}
  erstellt timestamptz not null default now()
);

create table public.mitglieder (
  betrieb_id uuid not null references public.betriebe on delete cascade,
  user_id uuid not null references auth.users on delete cascade,
  rolle text not null default 'inhaber' check (rolle in ('inhaber', 'mitarbeiter')),
  erstellt timestamptz not null default now(),
  primary key (betrieb_id, user_id)
);
create index on public.mitglieder (user_id);

-- Hilfsfunktionen für die Zugriffsregeln. security definer, damit sie die Regeln nicht selbst wieder auslösen.
create function public.ist_mitglied(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.mitglieder where betrieb_id = b and user_id = (select auth.uid()));
$$;

create function public.mein_betrieb() returns uuid
language sql stable security definer set search_path = '' as $$
  select betrieb_id from public.mitglieder where user_id = (select auth.uid()) order by erstellt limit 1;
$$;

-- Neues Konto (kein anonymes Box-Konto): eigenen Betrieb anlegen.
create function public.neues_konto() returns trigger
language plpgsql security definer set search_path = '' as $$
declare b uuid;
begin
  if coalesce(new.is_anonymous, false) then return new; end if;
  insert into public.betriebe (name) values (coalesce(new.raw_user_meta_data ->> 'betrieb', '')) returning id into b;
  insert into public.mitglieder (betrieb_id, user_id) values (b, new.id);
  return new;
end $$;
create trigger neues_konto after insert on auth.users for each row execute function public.neues_konto();

-- ---------- Slideshows ----------
-- `daten` ist die Slideshow so, wie das Panel sie führt: Name, Entwurf, veröffentlichter Stand, Versionen.
-- Die Box liest nie hier, sondern nur fertige Pakete.
create table public.shows (
  betrieb_id uuid not null references public.betriebe on delete cascade,
  id text not null,
  daten jsonb not null,
  revision int not null default 0,
  geaendert timestamptz not null default now(),
  primary key (betrieb_id, id)
);

-- ---------- Dateien (Bilder, Videos, Logos) ----------
-- Die Datei selbst liegt im Speicher-Bucket `medien` unter <betrieb_id>/<id>.
create table public.dateien (
  betrieb_id uuid not null references public.betriebe on delete cascade,
  id text not null,
  typ text not null check (typ in ('image', 'video', 'logo')),
  name text not null default '',
  groesse bigint not null default 0,
  erstellt timestamptz not null default now(),
  primary key (betrieb_id, id)
);

-- ---------- Pakete: veröffentlichte Stände ----------
create table public.pakete (
  betrieb_id uuid not null references public.betriebe on delete cascade,
  show_id text not null,
  revision int not null,
  paket jsonb not null,
  erstellt timestamptz not null default now(),
  primary key (betrieb_id, show_id, revision)
);

-- ---------- Bildschirme (Boxen) ----------
create table public.bildschirme (
  id uuid primary key default gen_random_uuid(),
  geraet uuid unique references auth.users on delete cascade,   -- anonymes Konto der Box
  betrieb_id uuid references public.betriebe on delete cascade, -- leer, bis gekoppelt
  code text unique,                                              -- Koppel-Code, nur solange nicht gekoppelt
  code_bis timestamptz,
  name text not null default '',
  standort text not null default '',
  ausrichtung text not null default 'land' check (ausrichtung in ('land', 'port')),
  show_id text,
  strom boolean not null default true,      -- Bildschirm an/aus aus der Ferne
  zuletzt timestamptz,                      -- letzter Herzschlag
  zustand jsonb,                            -- was die Box zuletzt gemeldet hat (Folie, Tageszeit, Auflösung, Wiedergaben …)
  show_stand text,                          -- welches Paket die Box gerade zeigt: <show_id>:<revision>
  stand int not null default 0,
  version text,
  foto text, foto_zeit timestamptz,         -- letztes Bildschirmfoto (kleines JPEG als data:-URL)
  protokoll jsonb not null default '[]',
  gekoppelt timestamptz,
  erstellt timestamptz not null default now()
);
create index on public.bildschirme (betrieb_id);

-- Zu welchem Betrieb gehört die Box, die gerade fragt? (leer für Menschen und ungekoppelte Boxen)
create function public.box_betrieb() returns uuid
language sql stable security definer set search_path = '' as $$
  select betrieb_id from public.bildschirme where geraet = (select auth.uid());
$$;

-- Für das Panel: wie lange ist der letzte Herzschlag her, gemessen an der Server-Uhr.
create view public.bildschirme_panel with (security_invoker = on) as
  select b.*, extract(epoch from now() - b.zuletzt)::float as her from public.bildschirme b;

-- ---------- Befehle an die Box: Neustart, Finden, Foto ----------
create table public.befehle (
  id bigint generated always as identity primary key,
  betrieb_id uuid not null references public.betriebe on delete cascade,
  bildschirm_id uuid not null references public.bildschirme on delete cascade,
  befehl text not null check (befehl in ('restart', 'identify', 'shot')),
  daten jsonb not null default '{}',
  erstellt timestamptz not null default now(),
  erledigt timestamptz
);
create index on public.befehle (bildschirm_id) where erledigt is null;

-- Fehlversuche beim Koppeln, damit niemand fremde Codes durchprobiert.
create table public.koppel_versuche (
  user_id uuid not null, zeit timestamptz not null default now()
);
create index on public.koppel_versuche (user_id, zeit);

-- ---------- Zugriffsregeln ----------
alter table public.betriebe enable row level security;
alter table public.mitglieder enable row level security;
alter table public.shows enable row level security;
alter table public.dateien enable row level security;
alter table public.pakete enable row level security;
alter table public.bildschirme enable row level security;
alter table public.befehle enable row level security;
alter table public.koppel_versuche enable row level security;

create policy "eigener Betrieb lesen" on public.betriebe for select to authenticated using (public.ist_mitglied(id));
create policy "eigener Betrieb ändern" on public.betriebe for update to authenticated using (public.ist_mitglied(id));
revoke insert, delete, update on public.betriebe from anon, authenticated;
grant update (name, hinweis, einstellungen) on public.betriebe to authenticated;

create policy "eigene Mitgliedschaft lesen" on public.mitglieder for select to authenticated using (public.ist_mitglied(betrieb_id));
revoke insert, update, delete on public.mitglieder from anon, authenticated;

create policy "Slideshows des Betriebs" on public.shows for all to authenticated
  using (public.ist_mitglied(betrieb_id)) with check (public.ist_mitglied(betrieb_id));
create policy "Dateien des Betriebs" on public.dateien for all to authenticated
  using (public.ist_mitglied(betrieb_id)) with check (public.ist_mitglied(betrieb_id));
create policy "Pakete lesen" on public.pakete for select to authenticated using (public.ist_mitglied(betrieb_id));
create policy "Pakete ablegen" on public.pakete for insert to authenticated with check (public.ist_mitglied(betrieb_id));
create policy "Pakete aufräumen" on public.pakete for delete to authenticated using (public.ist_mitglied(betrieb_id));

create policy "Bildschirme des Betriebs" on public.bildschirme for select to authenticated using (public.ist_mitglied(betrieb_id));
create policy "Bildschirme einstellen" on public.bildschirme for update to authenticated using (public.ist_mitglied(betrieb_id));
create policy "Bildschirme entfernen" on public.bildschirme for delete to authenticated using (public.ist_mitglied(betrieb_id));
-- Das Panel darf nur seine eigenen Felder ändern. Herzschlag, Code und Gerät schreibt nur die Box über box_stand().
revoke insert, update on public.bildschirme from anon, authenticated;
grant update (name, standort, ausrichtung, show_id, strom, protokoll) on public.bildschirme to authenticated;

create policy "Befehle des Betriebs" on public.befehle for select to authenticated using (public.ist_mitglied(betrieb_id));
create policy "Befehle senden" on public.befehle for insert to authenticated
  with check (public.ist_mitglied(betrieb_id) and exists (select 1 from public.bildschirme s where s.id = bildschirm_id and s.betrieb_id = befehle.betrieb_id));
revoke update, delete on public.befehle from anon, authenticated;

revoke all on public.koppel_versuche from anon, authenticated;
revoke all on public.betriebe, public.mitglieder, public.shows, public.dateien, public.pakete, public.bildschirme, public.befehle from anon;
revoke all on public.bildschirme_panel from anon;

-- Protokoll pro Bildschirm: neue Einträge vorne, höchstens 30.
create function public.protokoll_plus(p jsonb, msg text) returns jsonb
language sql stable as $$
  select coalesce(jsonb_agg(e), '[]'::jsonb) from (
    select e from jsonb_array_elements(jsonb_build_array(jsonb_build_object('t', (extract(epoch from now()) * 1000)::bigint, 'msg', msg)) || coalesce(p, '[]'::jsonb)) with ordinality x(e, n)
    order by n limit 30) y;
$$;

-- ---------- Box: anmelden und Koppel-Code holen ----------
-- Aufruf mit dem anonymen Konto der Box. Gibt den Bildschirm zurück, solange er nicht gekoppelt ist mit Code.
create function public.box_anmelden() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r public.bildschirme;
  c text;
begin
  if me is null then raise exception 'nicht angemeldet'; end if;
  select * into r from public.bildschirme where geraet = me;
  if not found then
    insert into public.bildschirme (geraet) values (me) returning * into r;
  end if;
  if r.betrieb_id is null and (r.code is null or r.code_bis < now()) then
    loop
      c := lpad((floor(random() * 1000000))::int::text, 6, '0');
      begin
        update public.bildschirme set code = c, code_bis = now() + interval '7 days' where id = r.id returning * into r;
        exit;
      exception when unique_violation then
        -- Code schon vergeben, nochmal würfeln. Abgelaufene Codes geben wir dabei frei.
        update public.bildschirme set code = null where code = c and code_bis < now();
      end;
    end loop;
  end if;
  return jsonb_build_object('id', r.id, 'code', case when r.betrieb_id is null then r.code end, 'gekoppelt', r.betrieb_id is not null);
end $$;

-- ---------- Panel: Box mit Code koppeln ----------
create function public.bildschirm_koppeln(p_code text, p_name text, p_standort text, p_ausrichtung text, p_show_id text)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b uuid := public.mein_betrieb();
  r public.bildschirme;
begin
  if b is null then raise exception 'Kein Betrieb zu diesem Konto' using errcode = '42501'; end if;
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

-- ---------- Box: Herzschlag und Abruf in einem ----------
-- p_zustand: was die Box gerade macht. p_stand: '<show_id>:<revision>' des Pakets, das sie hat.
-- p_erledigt: Befehls-Nummern, die die Box seit dem letzten Aufruf ausgeführt hat.
-- Antwort: gekoppelt, Name, Strom, Sofort-Hinweis, offene Befehle und, nur wenn es ein neueres gibt, das Paket.
create function public.box_stand(p_zustand jsonb default '{}', p_stand text default '', p_erledigt bigint[] default '{}', p_version text default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r public.bildschirme;
  pk record;
  h jsonb;
  bef jsonb;
  stand_neu text;
begin
  if me is null then raise exception 'nicht angemeldet'; end if;
  select * into r from public.bildschirme where geraet = me;
  if not found then return jsonb_build_object('bekannt', false); end if;

  update public.befehle set erledigt = now() where bildschirm_id = r.id and id = any (p_erledigt) and erledigt is null;

  if r.betrieb_id is null then
    update public.bildschirme set zuletzt = now(), zustand = p_zustand, version = coalesce(p_version, version) where id = r.id;
    return jsonb_build_object('bekannt', true, 'gekoppelt', false, 'code', case when r.code_bis > now() then r.code end);
  end if;

  select p.revision, p.paket into pk from public.pakete p
    where p.betrieb_id = r.betrieb_id and p.show_id = r.show_id order by p.revision desc limit 1;
  stand_neu := case when pk.revision is null then '' else r.show_id || ':' || pk.revision end;

  update public.bildschirme set zuletzt = now(), zustand = p_zustand, version = coalesce(p_version, version),
      show_stand = nullif(p_stand, ''),
      stand = coalesce(nullif(split_part(p_stand, ':', 2), '')::int, 0),
      protokoll = case
        when r.zuletzt is null or r.zuletzt < now() - interval '2 minutes' then public.protokoll_plus(r.protokoll, 'Box meldet sich')
        when coalesce(r.show_stand, '') <> coalesce(nullif(p_stand, ''), '') and p_stand <> '' then public.protokoll_plus(r.protokoll, 'Inhalte Stand ' || split_part(p_stand, ':', 2) || ' übernommen')
        else r.protokoll end
    where id = r.id;

  select b.hinweis into h from public.betriebe b where b.id = r.betrieb_id;
  if h is not null and not (coalesce(h -> 'screens', '[]'::jsonb) ? r.id::text) then h := null; end if;
  if h is not null and coalesce((h ->> 'until')::bigint, 0) > 0 and (h ->> 'until')::bigint < extract(epoch from now()) * 1000 then h := null; end if;

  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'befehl', befehl, 'daten', daten) order by id), '[]') into bef
    from public.befehle where bildschirm_id = r.id and erledigt is null and erstellt > now() - interval '10 minutes';

  return jsonb_build_object(
    'bekannt', true, 'gekoppelt', true, 'id', r.id, 'name', r.name, 'strom', r.strom,
    'hinweis', case when h is null then null else jsonb_build_object('text', h ->> 'text', 'until', coalesce((h ->> 'until')::bigint, 0)) end,
    'befehle', bef,
    'stand', stand_neu,
    'paket', case when stand_neu <> '' and stand_neu <> coalesce(p_stand, '') then pk.paket end);
end $$;

-- ---------- Box: Bildschirmfoto abliefern ----------
create function public.box_foto(p_befehl bigint, p_bild text) returns void
language plpgsql security definer set search_path = '' as $$
declare r public.bildschirme;
begin
  select * into r from public.bildschirme where geraet = (select auth.uid());
  if not found or r.betrieb_id is null then return; end if;
  if length(p_bild) > 400000 then raise exception 'Bild zu groß'; end if;
  update public.bildschirme set foto = p_bild, foto_zeit = now() where id = r.id;
  update public.befehle set erledigt = now() where id = p_befehl and bildschirm_id = r.id;
end $$;

revoke execute on function public.box_anmelden, public.box_stand, public.box_foto, public.bildschirm_koppeln, public.ist_mitglied, public.mein_betrieb, public.box_betrieb from public, anon;
grant execute on function public.box_anmelden, public.box_stand, public.box_foto, public.bildschirm_koppeln, public.ist_mitglied, public.mein_betrieb, public.box_betrieb to authenticated;
revoke execute on function public.neues_konto, public.protokoll_plus from public, anon, authenticated;

-- ---------- Speicher für Dateien ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('medien', 'medien', false, 52428800, array['image/*', 'video/*'])
on conflict (id) do nothing;

-- Mitglieder lesen und schreiben im Ordner ihres Betriebs. Eine gekoppelte Box darf dort nur lesen.
create policy "medien lesen" on storage.objects for select to authenticated using (
  bucket_id = 'medien' and (
    public.ist_mitglied(((storage.foldername(name))[1])::uuid)
    or public.box_betrieb()::text = (storage.foldername(name))[1]));
create policy "medien hochladen" on storage.objects for insert to authenticated with check (
  bucket_id = 'medien' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));
create policy "medien ersetzen" on storage.objects for update to authenticated using (
  bucket_id = 'medien' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));
create policy "medien löschen" on storage.objects for delete to authenticated using (
  bucket_id = 'medien' and public.ist_mitglied(((storage.foldername(name))[1])::uuid));
