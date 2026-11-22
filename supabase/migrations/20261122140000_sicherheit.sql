-- Sicherheitscheck 2026-11-22: kleine Aufräumarbeiten aus den Supabase-Hinweisen (Advisors).
--
-- 1. protokoll_plus() bekommt einen festen search_path, wie alle anderen Funktionen.
-- 2. abos und ki_analysen: Nicht angemeldete Besucher (anon) hatten noch das Leserecht der Tabelle.
--    Die Zeilenregeln gelten nur für angemeldete Konten, es war also nichts lesbar. Das Recht fällt trotzdem weg,
--    damit eine spätere Regel nicht aus Versehen etwas öffnet.
alter function public.protokoll_plus(jsonb, text) set search_path = '';
revoke all on public.abos, public.ki_analysen from anon;
