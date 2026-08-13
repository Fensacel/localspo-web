-- LocalSpo Web — Full Schema Migration
-- Run this in Supabase SQL editor or via `supabase db push`

-- ─── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ─── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text,
  display_name  text,
  username      text unique,
  avatar_url    text,
  banner_url    text,
  bio           text,
  country       text,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

alter table public.profiles enable row level security;

drop policy if exists "Public profiles readable" on public.profiles;
create policy "Public profiles readable" on public.profiles
  for select using (true);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- Auto-create profile on sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─── playlists ────────────────────────────────────────────────────────────────
create table if not exists public.playlists (
  id            uuid primary key default uuid_generate_v4(),
  owner_id      uuid not null references public.profiles(id) on delete cascade,
  title         text not null,
  description   text,
  cover_url     text,
  type          text default 'local' check (type in ('local','imported','cloud','followed','spotify')),
  source        text check (source in ('spotify','localspo') or source is null),
  source_playlist_id text,
  created_at    timestamptz default now() not null,
  updated_at    timestamptz default now() not null
);

alter table public.playlists enable row level security;

drop policy if exists "Owners read own playlists" on public.playlists;
create policy "Owners read own playlists" on public.playlists
  for select using (auth.uid() = owner_id);

drop policy if exists "Owners insert playlists" on public.playlists;
create policy "Owners insert playlists" on public.playlists
  for insert with check (auth.uid() = owner_id);

drop policy if exists "Owners update playlists" on public.playlists;
create policy "Owners update playlists" on public.playlists
  for update using (auth.uid() = owner_id);

drop policy if exists "Owners delete playlists" on public.playlists;
create policy "Owners delete playlists" on public.playlists
  for delete using (auth.uid() = owner_id);

-- ─── playlist_tracks ─────────────────────────────────────────────────────────
create table if not exists public.playlist_tracks (
  id            uuid primary key default uuid_generate_v4(),
  playlist_id   uuid not null references public.playlists(id) on delete cascade,
  track_id      text not null,
  position      int not null default 0,
  title         text not null,
  artist        text,
  album         text,
  thumbnail_url text,
  duration      int,
  video_id      text,
  metadata_json jsonb,
  created_at    timestamptz default now() not null,
  unique (playlist_id, track_id)
);

create index if not exists idx_playlist_tracks_playlist_id on public.playlist_tracks(playlist_id);

alter table public.playlist_tracks enable row level security;

drop policy if exists "Playlist tracks readable by owner" on public.playlist_tracks;
create policy "Playlist tracks readable by owner" on public.playlist_tracks
  for select using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

drop policy if exists "Playlist tracks insertable by owner" on public.playlist_tracks;
create policy "Playlist tracks insertable by owner" on public.playlist_tracks
  for insert with check (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

drop policy if exists "Playlist tracks deletable by owner" on public.playlist_tracks;
create policy "Playlist tracks deletable by owner" on public.playlist_tracks
  for delete using (
    exists (select 1 from public.playlists p where p.id = playlist_id and p.owner_id = auth.uid())
  );

-- ─── liked_tracks ────────────────────────────────────────────────────────────
create table if not exists public.liked_tracks (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  track_id      text not null,
  title         text not null,
  artist        text,
  album         text,
  thumbnail_url text,
  duration      int,
  video_id      text,
  metadata_json jsonb,
  created_at    timestamptz default now() not null,
  unique (user_id, track_id)
);

create index if not exists idx_liked_tracks_user_id on public.liked_tracks(user_id);

alter table public.liked_tracks enable row level security;

drop policy if exists "Users read own liked tracks" on public.liked_tracks;
create policy "Users read own liked tracks" on public.liked_tracks
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own liked tracks" on public.liked_tracks;
create policy "Users insert own liked tracks" on public.liked_tracks
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own liked tracks" on public.liked_tracks;
create policy "Users update own liked tracks" on public.liked_tracks
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own liked tracks" on public.liked_tracks;
create policy "Users delete own liked tracks" on public.liked_tracks
  for delete using (auth.uid() = user_id);

-- ─── play_history ────────────────────────────────────────────────────────────
create table if not exists public.play_history (
  id            uuid primary key default uuid_generate_v4(),
  user_id       uuid not null references public.profiles(id) on delete cascade,
  track_id      text not null,
  title         text not null,
  artist        text,
  album         text,
  thumbnail_url text,
  duration      int,
  video_id      text,
  progress      int default 0,
  played_at     timestamptz default now() not null,
  metadata_json jsonb
);

create index if not exists idx_play_history_user_id on public.play_history(user_id);
create index if not exists idx_play_history_played_at on public.play_history(played_at desc);

alter table public.play_history enable row level security;

drop policy if exists "Users read own history" on public.play_history;
create policy "Users read own history" on public.play_history
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own history" on public.play_history;
create policy "Users insert own history" on public.play_history
  for insert with check (auth.uid() = user_id);

-- ─── followed_playlists ───────────────────────────────────────────────────────
create table if not exists public.followed_playlists (
  id                  uuid primary key default uuid_generate_v4(),
  user_id             uuid not null references public.profiles(id) on delete cascade,
  source              text not null,
  source_playlist_id  text not null,
  playlist_name       text,
  playlist_description text,
  playlist_cover      text,
  sync_enabled        boolean default true,
  last_synced_at      timestamptz,
  created_at          timestamptz default now() not null,
  updated_at          timestamptz default now() not null,
  unique (user_id, source, source_playlist_id)
);

alter table public.followed_playlists enable row level security;

drop policy if exists "Users read own followed playlists" on public.followed_playlists;
create policy "Users read own followed playlists" on public.followed_playlists
  for select using (auth.uid() = user_id);

drop policy if exists "Users insert own followed playlists" on public.followed_playlists;
create policy "Users insert own followed playlists" on public.followed_playlists
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users update own followed playlists" on public.followed_playlists;
create policy "Users update own followed playlists" on public.followed_playlists
  for update using (auth.uid() = user_id);

drop policy if exists "Users delete own followed playlists" on public.followed_playlists;
create policy "Users delete own followed playlists" on public.followed_playlists
  for delete using (auth.uid() = user_id);

-- ─── followed_playlist_tracks ─────────────────────────────────────────────────
create table if not exists public.followed_playlist_tracks (
  id                    uuid primary key default uuid_generate_v4(),
  followed_playlist_id  uuid not null references public.followed_playlists(id) on delete cascade,
  track_id              text not null,
  title                 text not null,
  artist                text,
  album                 text,
  thumbnail_url         text,
  duration              int,
  video_id              text,
  position              int default 0,
  first_seen_at         timestamptz default now() not null,
  last_seen_at          timestamptz default now() not null,
  unique (followed_playlist_id, track_id)
);

alter table public.followed_playlist_tracks enable row level security;

drop policy if exists "Users read own followed playlist tracks" on public.followed_playlist_tracks;
create policy "Users read own followed playlist tracks" on public.followed_playlist_tracks
  for select using (
    exists (select 1 from public.followed_playlists fp where fp.id = followed_playlist_id and fp.user_id = auth.uid())
  );

drop policy if exists "Users insert own followed playlist tracks" on public.followed_playlist_tracks;
create policy "Users insert own followed playlist tracks" on public.followed_playlist_tracks
  for insert with check (
    exists (select 1 from public.followed_playlists fp where fp.id = followed_playlist_id and fp.user_id = auth.uid())
  );

-- ─── chat_rooms ──────────────────────────────────────────────────────────────
create table if not exists public.chat_rooms (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  owner_id    uuid references public.profiles(id) on delete set null,
  created_at  timestamptz default now() not null
);

alter table public.chat_rooms enable row level security;

drop policy if exists "Chat rooms publicly readable" on public.chat_rooms;
create policy "Chat rooms publicly readable" on public.chat_rooms
  for select using (true);

drop policy if exists "Authenticated users create rooms" on public.chat_rooms;
create policy "Authenticated users create rooms" on public.chat_rooms
  for insert with check (auth.uid() is not null);

-- ─── chat_members ────────────────────────────────────────────────────────────
create table if not exists public.chat_members (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  joined_at   timestamptz default now() not null,
  unique (room_id, user_id)
);

alter table public.chat_members enable row level security;

drop policy if exists "Members readable by authenticated" on public.chat_members;
create policy "Members readable by authenticated" on public.chat_members
  for select using (auth.uid() is not null);

drop policy if exists "Users join rooms" on public.chat_members;
create policy "Users join rooms" on public.chat_members
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users leave rooms" on public.chat_members;
create policy "Users leave rooms" on public.chat_members
  for delete using (auth.uid() = user_id);

-- ─── chat_messages ───────────────────────────────────────────────────────────
create table if not exists public.chat_messages (
  id          uuid primary key default uuid_generate_v4(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) <= 2000),
  created_at  timestamptz default now() not null
);

create index if not exists idx_chat_messages_room_id on public.chat_messages(room_id, created_at);

alter table public.chat_messages enable row level security;

drop policy if exists "Messages readable by authenticated" on public.chat_messages;
create policy "Messages readable by authenticated" on public.chat_messages
  for select using (auth.uid() is not null);

drop policy if exists "Authenticated users send messages" on public.chat_messages;
create policy "Authenticated users send messages" on public.chat_messages
  for insert with check (auth.uid() = user_id);

-- ─── listening_presence ──────────────────────────────────────────────────────
create table if not exists public.listening_presence (
  user_id       uuid primary key references public.profiles(id) on delete cascade,
  track_id      text,
  track_title   text,
  track_artist  text,
  is_playing    boolean default false,
  updated_at    timestamptz default now() not null
);

alter table public.listening_presence enable row level security;

drop policy if exists "Presence readable by authenticated" on public.listening_presence;
create policy "Presence readable by authenticated" on public.listening_presence
  for select using (auth.uid() is not null);

drop policy if exists "Users manage own presence" on public.listening_presence;
create policy "Users manage own presence" on public.listening_presence
  for all using (auth.uid() = user_id);

-- ─── Enable Realtime ─────────────────────────────────────────────────────────
-- Run in Supabase dashboard → Replication → Add tables:
-- chat_messages, listening_presence
