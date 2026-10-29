-- Szenario: zwei Konten, Spielstände getrennt, Freundschaft per Code.
\set ON_ERROR_STOP on
grant select, insert, update, delete on all tables in schema public to authenticated;

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@test');

-- Trigger hat Profile mit Codes angelegt
do $$ begin
  assert (select count(*) from public.profiles) = 2, 'zwei Profile erwartet';
  assert (select bool_and(friend_code ~ '^[A-HJ-NP-Z2-9]{6}$') from public.profiles), 'Codeformat';
end $$;

set role authenticated;

-- A speichert, sieht nur sich
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
insert into public.saves (user_id, data, version, updated_at) values (auth.uid(), '{"shells": 5}', 1, now());
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'A sieht nur das eigene Profil';
  assert (select count(*) from public.saves) = 1, 'A sieht den eigenen Stand';
end $$;

-- B sieht A's Stand nicht und darf nicht für A schreiben
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select count(*) from public.saves) = 0, 'B sieht keinen fremden Stand';
  begin
    insert into public.saves (user_id, data, version, updated_at) values ('00000000-0000-0000-0000-00000000000a', '{}', 1, now());
    assert false, 'B durfte für A schreiben';
  exception when insufficient_privilege then null;
  end;
end $$;

-- B schickt A eine Anfrage per Code (Code holt der Test als Superuser)
reset role;
select friend_code as code_a from public.profiles where id = '00000000-0000-0000-0000-00000000000a' \gset
select friend_code as code_b from public.profiles where id = '00000000-0000-0000-0000-00000000000b' \gset
set role authenticated;
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert public.send_friend_request('XXXXXX') = 'unknown', 'unbekannter Code';
end $$;
select public.send_friend_request(lower(:'code_a')) as r \gset
do $$ begin
  assert (select direction from public.list_friends()) = 'outgoing', 'B wartet auf A';
end $$;
select public.send_friend_request(:'code_b') = 'self' as self_ok \gset

-- A sieht die Anfrage und nimmt an
set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000a';
do $$ begin
  assert (select direction from public.list_friends()) = 'incoming', 'A hat eine eingehende Anfrage';
  assert public.accept_friend_request('00000000-0000-0000-0000-00000000000b'), 'Annahme klappt';
  assert (select direction from public.list_friends()) = 'friend', 'jetzt befreundet';
end $$;
select public.send_friend_request(:'code_b') as again \gset

set request.jwt.claim.sub = '00000000-0000-0000-0000-00000000000b';
do $$ begin
  assert (select name from public.list_friends()) = 'Oktopus', 'B sieht A als Freund';
end $$;

reset role;
-- Rückgabewerte: erste Anfrage 'sent', an sich selbst 'self', nach Freundschaft 'already'
select case when :'r' = 'sent' and :'self_ok' and :'again' = 'already' then 1 else 1 / 0 end as rueckgabewerte_ok;
\echo 'Datenbank-Tests: OK'
