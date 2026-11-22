-- Sicherheitscheck 2026-11-22: kleine Aufräumarbeiten aus den Supabase-Hinweisen (Advisors).
--
-- 1. protokoll_plus() bekommt einen festen search_path, wie alle anderen Funktionen.
-- 2. abos und ki_analysen: Nicht angemeldete Besucher (anon) hatten noch das Leserecht der Tabelle.
--    Die Zeilenregeln gelten nur für angemeldete Konten, es war also nichts lesbar. Das Recht fällt trotzdem weg,
--    damit eine spätere Regel nicht aus Versehen etwas öffnet.
alter function public.protokoll_plus(jsonb, text) set search_path = '';
revoke all on public.abos, public.ki_analysen from anon;

-- 3. Box-Koppeln: Ein Koppel-Code gilt nur noch 1 Stunde statt 7 Tage. Die Box holt sich danach von selbst
--    einen neuen (box_stand liefert keinen abgelaufenen Code, der Player meldet sich dann neu an).
--    Ein Trigger kürzt jede längere Gültigkeit, so muss box_anmelden() nicht neu geschrieben werden.
create function public.code_kurz() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.code_bis is not null and new.code_bis > now() + interval '1 hour' then new.code_bis := now() + interval '1 hour'; end if;
  return new;
end $$;
revoke execute on function public.code_kurz() from public, anon, authenticated;
create trigger code_kurz before insert or update of code_bis on public.bildschirme for each row execute function public.code_kurz();
update public.bildschirme set code_bis = now() + interval '1 hour' where code_bis > now() + interval '1 hour';

-- 4. Zwei-Faktor-Anmeldung (Authenticator-App): Wer einen zweiten Faktor eingerichtet hat, kommt mit Passwort
--    allein nicht mehr an die Daten. Die Sitzung muss dann die Stufe aal2 haben (Code aus der App eingegeben).
create function public.aal_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
      or not exists (select 1 from auth.mfa_factors f where f.user_id = (select auth.uid()) and f.status = 'verified');
$$;
revoke execute on function public.aal_ok() from public, anon;
grant execute on function public.aal_ok() to authenticated;

create or replace function public.ist_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid())) and public.aal_ok();
$$;

create or replace function public.ist_mitglied(b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.aal_ok() and (
    exists (select 1 from public.mitglieder where betrieb_id = b and user_id = (select auth.uid()))
    or exists (select 1 from public.admins where user_id = (select auth.uid())));
$$;

-- 5. Koppeln: Zusätzlich zur Sperre pro Konto (10 Fehlversuche pro Stunde) eine Sperre über alle Konten.
--    Sonst könnte jemand mit vielen Konten die 6-stelligen Codes durchprobieren. Mehr als 100 Fehlversuche in
--    10 Minuten gibt es im echten Betrieb nicht. Alte Versuche werden dabei weggeräumt.
create or replace function public.bildschirm_koppeln(p_code text, p_name text, p_standort text, p_ausrichtung text, p_show_id text, p_betrieb uuid default null)
returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  me uuid := (select auth.uid());
  b uuid := coalesce(p_betrieb, public.mein_betrieb());
  r public.bildschirme;
begin
  if b is null or not public.ist_mitglied(b) then raise exception 'Kein Betrieb zu diesem Konto' using errcode = '42501'; end if;
  delete from public.koppel_versuche where zeit < now() - interval '1 day';
  if (select count(*) from public.koppel_versuche where user_id = me and zeit > now() - interval '1 hour') >= 10 then
    raise exception 'Zu viele falsche Codes. Bitte in einer Stunde nochmal versuchen.' using errcode = 'P0001';
  end if;
  if (select count(*) from public.koppel_versuche where zeit > now() - interval '10 minutes') >= 100 then
    raise exception 'Gerade werden zu viele falsche Codes probiert. Bitte in zehn Minuten nochmal versuchen.' using errcode = 'P0001';
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
revoke execute on function public.bildschirm_koppeln(text, text, text, text, text, uuid) from public, anon;
grant execute on function public.bildschirm_koppeln(text, text, text, text, text, uuid) to authenticated;
