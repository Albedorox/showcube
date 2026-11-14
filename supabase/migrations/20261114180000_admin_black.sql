-- Erstes Admin-Konto (Inhaber von ShowCube). Die E-Mail steht nur als SHA-256 hier,
-- damit sie nicht im öffentlichen Repository lesbar ist.
-- Greift nur, wenn das Konto beim Ausrollen schon existiert. Ein Konto, das sich erst
-- später mit dieser E-Mail registriert, wird bewusst NICHT automatisch Admin
-- (E-Mail-Bestätigung ist aus, sonst könnte sich jemand Fremdes damit Admin-Rechte holen).
insert into public.admins (user_id)
select id from auth.users
where encode(sha256(convert_to(lower(email), 'UTF8')), 'hex') = '4df87cb569b0dc6beb3c383841bfea030ee7066e5afae4576ccd2ce393cc1030'
  and not coalesce(is_anonymous, false)
on conflict do nothing;
