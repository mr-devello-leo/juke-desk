-- JukeDesk Supabase Schema
-- Supabase 대시보드 > SQL Editor에 아래 내용을 그대로 붙여넣고 Run 하세요.

-- 1. 곡 대기열 및 재생 기록 테이블
create table if not exists public.tracks (
  id uuid primary key default gen_random_uuid(),
  video_id text not null,
  title text not null,
  author_name text not null default '',
  thumbnail_url text not null,
  requested_by text not null,
  status text not null default 'queued'
    check (status in ('queued', 'playing', 'played', 'skipped')),
  created_at timestamptz not null default now(),
  started_at timestamptz
);

create index if not exists tracks_status_created_idx
  on public.tracks (status, created_at asc);

-- 2. 좋아요 및 스킵 투표 테이블 (1인 1표 중복 방지)
create table if not exists public.votes (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.tracks (id) on delete cascade,
  user_id text not null,
  type text not null check (type in ('like', 'skip')),
  created_at timestamptz not null default now(),
  constraint votes_unique_per_user unique (track_id, user_id, type)
);

create index if not exists votes_track_id_idx
  on public.votes (track_id);

-- 3. 플레이어 공용 설정 테이블 (원격 볼륨 조절 / 음소거)
create table if not exists public.player_settings (
  id integer primary key default 1 check (id = 1),
  volume integer not null default 70 check (volume >= 0 and volume <= 100),
  is_muted boolean not null default false,
  updated_at timestamptz not null default now()
);

insert into public.player_settings (id, volume, is_muted)
values (1, 70, false)
on conflict (id) do nothing;

-- 4. RLS(Row Level Security) 설정
-- 사내 MVP용으로 익명 키(anon) 접근을 허용합니다.
alter table public.tracks enable row level security;
alter table public.votes enable row level security;
alter table public.player_settings enable row level security;

drop policy if exists "Allow public read tracks" on public.tracks;
create policy "Allow public read tracks"
  on public.tracks for select using (true);

drop policy if exists "Allow public insert tracks" on public.tracks;
create policy "Allow public insert tracks"
  on public.tracks for insert with check (true);

drop policy if exists "Allow public update tracks" on public.tracks;
create policy "Allow public update tracks"
  on public.tracks for update using (true) with check (true);

drop policy if exists "Allow public delete tracks" on public.tracks;
create policy "Allow public delete tracks"
  on public.tracks for delete using (true);

drop policy if exists "Allow public read votes" on public.votes;
create policy "Allow public read votes"
  on public.votes for select using (true);

drop policy if exists "Allow public insert votes" on public.votes;
create policy "Allow public insert votes"
  on public.votes for insert with check (true);

drop policy if exists "Allow public delete votes" on public.votes;
create policy "Allow public delete votes"
  on public.votes for delete using (true);

drop policy if exists "Allow public read player_settings" on public.player_settings;
create policy "Allow public read player_settings"
  on public.player_settings for select using (true);

drop policy if exists "Allow public insert player_settings" on public.player_settings;
create policy "Allow public insert player_settings"
  on public.player_settings for insert with check (true);

drop policy if exists "Allow public update player_settings" on public.player_settings;
create policy "Allow public update player_settings"
  on public.player_settings for update using (true) with check (true);

-- 5. Supabase Realtime 활성화 (Host와 Client 간 즉시 동기화)
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'tracks'
  ) then
    alter publication supabase_realtime add table public.tracks;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'votes'
  ) then
    alter publication supabase_realtime add table public.votes;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'player_settings'
  ) then
    alter publication supabase_realtime add table public.player_settings;
  end if;
end $$;
