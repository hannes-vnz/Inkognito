-- Inkognito: Profile, Spielstände und Freundschaften.
-- Alle Tabellen mit Row Level Security: jeder sieht nur seine eigenen Daten,
-- Freunde nur über die Funktionen unten.

-- Freundescode: 6 Zeichen ohne verwechselbare Zeichen (kein 0/O, 1/I/L).
create or replace function public.new_friend_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  code text;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = code);
  end loop;
  return code;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null default 'Oktopus' check (char_length(name) between 1 and 24),
  avatar_color text not null default '#ec5a84' check (avatar_color ~ '^#[0-9a-fA-F]{6}$'),
  reef_level int not null default 1 check (reef_level >= 1),
  friend_code text not null unique,
  created_at timestamptz not null default now()
);

create table public.saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  data jsonb not null,
  version int not null check (version >= 1),
  -- Zeitpunkt der letzten Änderung im Spiel (aus dem Spielstand), entscheidet bei Konflikten.
  updated_at timestamptz not null,
  synced_at timestamptz not null default now()
);

create table public.friends (
  user_id uuid not null references auth.users (id) on delete cascade,
  friend_id uuid not null references auth.users (id) on delete cascade,
  status text not null check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);

alter table public.profiles enable row level security;
alter table public.saves enable row level security;
alter table public.friends enable row level security;

create policy "Profil lesen: eigenes" on public.profiles for select using (auth.uid() = id);
create policy "Profil ändern: eigenes" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create policy "Spielstand lesen: eigener" on public.saves for select using (auth.uid() = user_id);
create policy "Spielstand anlegen: eigener" on public.saves for insert with check (auth.uid() = user_id);
create policy "Spielstand ändern: eigener" on public.saves for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "Freundschaften lesen: beteiligt" on public.friends for select using (auth.uid() in (user_id, friend_id));
create policy "Freundschaft lösen: beteiligt" on public.friends for delete using (auth.uid() in (user_id, friend_id));

-- Neues Konto bekommt automatisch ein Profil mit Freundescode.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, friend_code) values (new.id, public.new_friend_code());
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Freundschaftsanfrage per Code. Gibt zurück: 'sent', 'accepted' (Gegenanfrage lag schon vor),
-- 'already', 'self' oder 'unknown'.
create or replace function public.send_friend_request(code text) returns text
language plpgsql security definer set search_path = public as $$
declare
  me uuid := auth.uid();
  other uuid;
begin
  if me is null then raise exception 'not authenticated'; end if;
  select id into other from profiles where friend_code = upper(trim(code));
  if other is null then return 'unknown'; end if;
  if other = me then return 'self'; end if;
  if exists (select 1 from friends where user_id = me and friend_id = other)
     or exists (select 1 from friends where user_id = other and friend_id = me and status = 'accepted') then
    return 'already';
  end if;
  if exists (select 1 from friends where user_id = other and friend_id = me and status = 'pending') then
    update friends set status = 'accepted' where user_id = other and friend_id = me;
    return 'accepted';
  end if;
  insert into friends (user_id, friend_id, status) values (me, other, 'pending');
  return 'sent';
end;
$$;

create or replace function public.accept_friend_request(requester uuid) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  update friends set status = 'accepted'
  where user_id = requester and friend_id = auth.uid() and status = 'pending';
  return found;
end;
$$;

-- Freundesliste mit Profilangaben der anderen Seite.
-- direction: 'friend' (angenommen), 'incoming' (wartet auf mich), 'outgoing' (wartet auf die andere Seite).
create or replace function public.list_friends()
returns table (id uuid, name text, avatar_color text, reef_level int, direction text)
language sql stable security definer set search_path = public as $$
  select p.id, p.name, p.avatar_color, p.reef_level,
    case
      when f.status = 'accepted' then 'friend'
      when f.friend_id = auth.uid() then 'incoming'
      else 'outgoing'
    end
  from friends f
  join profiles p on p.id = case when f.user_id = auth.uid() then f.friend_id else f.user_id end
  where auth.uid() in (f.user_id, f.friend_id)
  order by 5, 2;
$$;

revoke all on function public.send_friend_request(text) from public, anon;
revoke all on function public.accept_friend_request(uuid) from public, anon;
revoke all on function public.list_friends() from public, anon;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.accept_friend_request(uuid) to authenticated;
grant execute on function public.list_friends() to authenticated;
