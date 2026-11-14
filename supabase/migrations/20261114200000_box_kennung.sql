-- Box-Kennung aus der Seriennummer des Raspberry Pi.
--
-- Bisher war eine Box nur ihr anonymes Konto, und das liegt im Browser (localStorage von Chromium).
-- Wird das Browser-Profil gelöscht, war die Box für den Server eine neue Box und musste neu gekoppelt werden.
--
-- Jetzt richtet scripts/box-einrichten.sh auf dem Pi zwei Werte ein und übergibt sie dem Player:
-- - Kennung, z.B. SC-K7QD-2MXA: aus der Seriennummer des Pi berechnet. Öffentlich, steht aufs Gehäuse.
-- - Schlüssel: 32 Zufallsbytes, nur in einer Datei auf der Box. Beweist, dass wirklich diese Box fragt.
-- Die Kennung allein reicht nie, um eine Box zu übernehmen: Wer sie vom Gehäuse abliest, kennt den Schlüssel nicht.
-- Meldet sich die Box mit neuem anonymem Konto (Browser zurückgesetzt), hängt box_anmelden() den alten
-- Bildschirm samt Kopplung an das neue Konto um. Der Kunde merkt nichts.

create table public.boxen (
  kennung text primary key check (kennung ~ '^SC-[A-Z2-7]{4}-[A-Z2-7]{4}$'),
  schluessel bytea,                          -- SHA-256 des Schlüssels (der Schlüssel selbst bleibt auf der Box); leer = vom Admin freigegeben
  erstellt timestamptz not null default now()
);
alter table public.boxen enable row level security;
revoke all on public.boxen from anon, authenticated;

alter table public.bildschirme add column kennung text unique references public.boxen on delete set null;

-- Die Panel-Ansicht muss die neue Spalte mitnehmen (b.* wird beim Anlegen festgeschrieben).
drop view public.bildschirme_panel;
create view public.bildschirme_panel with (security_invoker = on) as
  select b.*, extract(epoch from now() - b.zuletzt)::float as her from public.bildschirme b;
revoke all on public.bildschirme_panel from anon;
grant select on public.bildschirme_panel to authenticated;

-- Box anmelden. Ohne Kennung wie bisher (Test im Browser). Mit Kennung und Schlüssel:
-- erste Anmeldung legt die Box an, danach muss der Schlüssel passen.
drop function public.box_anmelden();
create function public.box_anmelden(p_kennung text default null, p_schluessel text default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  r public.bildschirme;
  bx public.boxen;
  h bytea;
  c text;
begin
  if me is null then raise exception 'nicht angemeldet'; end if;

  if p_kennung is not null then
    p_kennung := upper(trim(p_kennung));
    if p_kennung !~ '^SC-[A-Z2-7]{4}-[A-Z2-7]{4}$' then raise exception 'Box-Kennung ungültig' using errcode = '22023'; end if;
    if length(coalesce(p_schluessel, '')) < 32 then raise exception 'Box-Schlüssel fehlt' using errcode = '22023'; end if;
    h := sha256(convert_to(p_schluessel, 'UTF8'));
    select * into bx from public.boxen where kennung = p_kennung for update;
    if not found then
      insert into public.boxen (kennung, schluessel) values (p_kennung, h);
    elsif bx.schluessel is null then
      update public.boxen set schluessel = h where kennung = p_kennung;
    elsif bx.schluessel <> h then
      raise exception 'Box-Kennung gehört zu einem anderen Schlüssel' using errcode = '42501';
    end if;

    select * into r from public.bildschirme where kennung = p_kennung for update;
    if found then
      if r.geraet is distinct from me then
        -- Browser zurückgesetzt: neues anonymes Konto. Einen eben dafür angelegten, leeren Bildschirm wegräumen.
        delete from public.bildschirme where geraet = me and id <> r.id and betrieb_id is null;
        if exists (select 1 from public.bildschirme where geraet = me) then
          raise exception 'Dieses Konto gehört schon zu einem anderen Bildschirm' using errcode = '42501';
        end if;
        update public.bildschirme set geraet = me, protokoll = public.protokoll_plus(protokoll, 'Box neu angemeldet')
          where id = r.id returning * into r;
      end if;
    else
      select * into r from public.bildschirme where geraet = me for update;
      if found then
        if r.kennung is not null then raise exception 'Dieses Konto gehört schon zu einer anderen Box' using errcode = '42501'; end if;
        -- Bestehende Testbox bekommt ihre Kennung und bleibt gekoppelt.
        update public.bildschirme set kennung = p_kennung where id = r.id returning * into r;
      else
        insert into public.bildschirme (geraet, kennung) values (me, p_kennung) returning * into r;
      end if;
    end if;
  else
    select * into r from public.bildschirme where geraet = me;
    if not found then
      insert into public.bildschirme (geraet) values (me) returning * into r;
    end if;
  end if;

  if r.betrieb_id is null and (r.code is null or r.code_bis < now()) then
    loop
      c := lpad((floor(random() * 1000000))::int::text, 6, '0');
      begin
        update public.bildschirme set code = c, code_bis = now() + interval '7 days' where id = r.id returning * into r;
        exit;
      exception when unique_violation then
        update public.bildschirme set code = null where code = c and code_bis < now();
      end;
    end loop;
  end if;
  return jsonb_build_object('id', r.id, 'kennung', r.kennung, 'code', case when r.betrieb_id is null then r.code end, 'gekoppelt', r.betrieb_id is not null);
end $$;

-- Admin: Box nach neu bespielter SD-Karte (neuer Schlüssel) wieder freigeben.
-- Die nächste Anmeldung mit dieser Kennung legt den neuen Schlüssel fest, die Kopplung bleibt.
-- Nur kurz vor dem Start der Box freigeben: bis dahin könnte sich jeder mit der Kennung melden.
create function public.admin_box_freigeben(p_kennung text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public.ist_admin() then raise exception 'Nur für Admins' using errcode = '42501'; end if;
  update public.boxen set schluessel = null where kennung = upper(trim(p_kennung));
end $$;

revoke execute on function public.box_anmelden, public.admin_box_freigeben from public, anon;
grant execute on function public.box_anmelden, public.admin_box_freigeben to authenticated;
