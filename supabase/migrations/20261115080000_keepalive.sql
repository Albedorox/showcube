-- Wachhalten im Free-Plan.
--
-- Supabase legt ein Free-Projekt nach etwa einer Woche ohne Zugriffe schlafen. Solange noch keine Box
-- dauerhaft läuft, fragt deshalb .github/workflows/keepalive.yml alle zwei Tage diese Tabelle ab.
-- Jede API-Anfrage zählt als Aktivität, Schreiben ist nicht nötig. Die Tabelle hat genau eine Zeile
-- und verrät nichts.

create table public.keepalive (
  id smallint primary key default 1 check (id = 1),
  hinweis text not null
);
insert into public.keepalive (hinweis) values ('Hält das Projekt im Free-Plan wach, siehe keepalive.yml');

alter table public.keepalive enable row level security;
revoke all on public.keepalive from anon, authenticated;
grant select on public.keepalive to anon;
create policy "keepalive lesen" on public.keepalive for select to anon using (true);
