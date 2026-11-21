-- Pro-Funktion „Vorlage aus Bild“ im Vorlagen-Designer.
--
-- Der Designer schickt ein Bild an die Edge Function `vorlage-aus-bild` (supabase/functions/). Die fragt ein
-- KI-Modell (Claude) und gibt eine Vorlage mit Ebenen zurück. Jede Analyse kostet ein paar Cent, darum:
-- - nur für Betriebe mit Abo-Stufe „pro“ (Tabelle abos) und für Admins,
-- - mit einem Kontingent pro Monat (abos.ki_grenze, Standard 50).
--
-- Einen Betrieb auf Pro stellen (im SQL Editor, geht bewusst nicht über die Website):
--   insert into public.abos (betrieb_id, stufe) values ('<betrieb-id>', 'pro')
--   on conflict (betrieb_id) do update set stufe = 'pro';

-- ---------- Abo-Stufe pro Betrieb ----------
-- Eigene Tabelle statt Spalte in betriebe: Betriebe dürfen ihre Zeile in betriebe selbst ändern,
-- ihre Stufe aber natürlich nicht. Hier gibt es nur Lesen, geschrieben wird per SQL (später vom Zahlungsanbieter).
create table public.abos (
  betrieb_id uuid primary key references public.betriebe on delete cascade,
  stufe text not null default 'cloud' check (stufe in ('cloud', 'pro')),
  bis timestamptz,                                  -- leer = unbefristet
  ki_grenze int not null default 50 check (ki_grenze >= 0),   -- KI-Analysen pro Kalendermonat
  erstellt timestamptz not null default now()
);
alter table public.abos enable row level security;
create policy "eigenes Abo lesen" on public.abos for select to authenticated using (public.ist_mitglied(betrieb_id));

-- ---------- Protokoll der KI-Analysen (für Kontingent und Kosten) ----------
create table public.ki_analysen (
  id uuid primary key default gen_random_uuid(),
  betrieb_id uuid references public.betriebe on delete cascade,
  user_id uuid references auth.users on delete set null,
  art text not null default 'vorlage-aus-bild',
  ok boolean not null default false,               -- false = läuft noch (oder abgebrochen)
  modell text,
  tokens_ein int,
  tokens_aus int,
  erstellt timestamptz not null default now()
);
create index on public.ki_analysen (betrieb_id, erstellt);
alter table public.ki_analysen enable row level security;
create policy "eigene KI-Analysen lesen" on public.ki_analysen for select to authenticated using (public.ist_mitglied(betrieb_id));
-- Schreiben nur über ki_analyse_buchen() und die Edge Function (Secret Key).

-- Wie viele Analysen zählen diesen Monat: fertige und solche, die gerade laufen (jünger als 5 Minuten).
create function public.ki_genutzt(b uuid) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.ki_analysen
  where betrieb_id = b and erstellt >= date_trunc('month', now())
    and (ok or erstellt > now() - interval '5 minutes');
$$;
revoke execute on function public.ki_genutzt(uuid) from public, anon, authenticated;

-- Für die Anzeige im Designer: darf ich, und wie viel ist noch übrig?
create function public.ki_kontingent() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  b uuid := public.mein_betrieb();
  admin boolean := public.ist_admin();
  a public.abos;
  pro boolean;
  genutzt int := 0;
begin
  if (select auth.uid()) is null then raise exception 'Nicht angemeldet'; end if;
  select * into a from public.abos where betrieb_id = b;
  pro := admin or coalesce(a.stufe = 'pro' and (a.bis is null or a.bis > now()), false);
  if b is not null then genutzt := public.ki_genutzt(b); end if;
  return jsonb_build_object('pro', pro, 'admin', admin, 'grenze', case when admin then null else coalesce(a.ki_grenze, 50) end, 'genutzt', genutzt);
end $$;
revoke execute on function public.ki_kontingent() from public, anon;
grant execute on function public.ki_kontingent() to authenticated;

-- Vor jeder Analyse (ruft die Edge Function im Namen des Nutzers auf): prüft Pro und Kontingent und
-- legt einen Eintrag an. Gibt {id, rest} zurück. Fehler mit festen Kennungen, die der Designer übersetzt.
create function public.ki_analyse_buchen() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  u uuid := (select auth.uid());
  b uuid := public.mein_betrieb();
  admin boolean := public.ist_admin();
  a public.abos;
  grenze int;
  genutzt int;
  neu uuid;
begin
  if u is null or coalesce((select is_anonymous from auth.users where id = u), false) then raise exception 'KI_NICHT_ANGEMELDET'; end if;
  if b is null and not admin then raise exception 'KI_KEIN_BETRIEB'; end if;
  select * into a from public.abos where betrieb_id = b;
  if not admin and not coalesce(a.stufe = 'pro' and (a.bis is null or a.bis > now()), false) then raise exception 'KI_NUR_PRO'; end if;
  grenze := coalesce(a.ki_grenze, 50);
  -- Gleichzeitige Aufrufe desselben Betriebs nacheinander zählen.
  if b is not null then perform pg_advisory_xact_lock(hashtext('ki:' || b::text)); genutzt := public.ki_genutzt(b); else genutzt := 0; end if;
  if not admin and genutzt >= grenze then raise exception 'KI_KONTINGENT'; end if;
  insert into public.ki_analysen (betrieb_id, user_id) values (b, u) returning id into neu;
  return jsonb_build_object('id', neu, 'rest', case when admin then null else grenze - genutzt - 1 end);
end $$;
revoke execute on function public.ki_analyse_buchen() from public, anon;
grant execute on function public.ki_analyse_buchen() to authenticated;
