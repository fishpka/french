create extension if not exists "pgcrypto";

create table if not exists public.analysis_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  total_words integer not null default 0 check (total_words >= 0),
  content_words integer not null default 0 check (content_words >= 0),
  unique_words integer not null default 0 check (unique_words >= 0),
  sentence_count integer not null default 0 check (sentence_count >= 0),
  cefr_summary jsonb not null default '[]'::jsonb,
  top_words jsonb not null default '[]'::jsonb
);

create table if not exists public.word_frequencies (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.analysis_sessions(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  word text not null,
  normalized_word text not null,
  count integer not null check (count > 0),
  cefr_level text not null default 'Unknown',
  created_at timestamptz not null default now()
);

create index if not exists analysis_sessions_user_created_at_idx
  on public.analysis_sessions (user_id, created_at desc);

create index if not exists word_frequencies_user_word_idx
  on public.word_frequencies (user_id, word);

create index if not exists word_frequencies_session_id_idx
  on public.word_frequencies (session_id);

alter table public.analysis_sessions enable row level security;
alter table public.word_frequencies enable row level security;

create policy "Users can read their own analysis sessions"
  on public.analysis_sessions
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own analysis sessions"
  on public.analysis_sessions
  for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own analysis sessions"
  on public.analysis_sessions
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their own word frequencies"
  on public.word_frequencies
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own word frequencies"
  on public.word_frequencies
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.analysis_sessions
      where analysis_sessions.id = word_frequencies.session_id
        and analysis_sessions.user_id = auth.uid()
    )
  );

create policy "Users can delete their own word frequencies"
  on public.word_frequencies
  for delete
  using (auth.uid() = user_id);
