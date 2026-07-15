create or replace function public.save_analysis_session(
  p_total_words integer,
  p_content_words integer,
  p_unique_words integer,
  p_sentence_count integer,
  p_cefr_summary jsonb,
  p_top_words jsonb,
  p_word_frequencies jsonb
)
returns public.analysis_sessions
language plpgsql
security definer
set search_path = public
as $$
declare
  inserted_session public.analysis_sessions;
  daily_session_count integer;
  max_sessions_per_24_hours constant integer := 50;
  max_word_frequencies_per_session constant integer := 1000;
  max_summary_bytes constant integer := 20000;
  word_frequency_count integer;
begin
  if auth.uid() is null then
    raise exception 'User is not authenticated.';
  end if;

  if jsonb_typeof(coalesce(p_cefr_summary, '[]'::jsonb)) <> 'array' then
    raise exception 'CEFR summary must be an array.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_top_words, '[]'::jsonb)) <> 'array' then
    raise exception 'Top words must be an array.' using errcode = '22023';
  end if;

  if jsonb_typeof(coalesce(p_word_frequencies, '[]'::jsonb)) <> 'array' then
    raise exception 'Word frequencies must be an array.' using errcode = '22023';
  end if;

  word_frequency_count := jsonb_array_length(coalesce(p_word_frequencies, '[]'::jsonb));

  if word_frequency_count > max_word_frequencies_per_session then
    raise exception 'Word frequency quota exceeded.' using errcode = '54000';
  end if;

  if octet_length(coalesce(p_cefr_summary, '[]'::jsonb)::text) > max_summary_bytes
    or octet_length(coalesce(p_top_words, '[]'::jsonb)::text) > max_summary_bytes
    or octet_length(coalesce(p_word_frequencies, '[]'::jsonb)::text) > max_summary_bytes * 5 then
    raise exception 'Analysis payload quota exceeded.' using errcode = '54000';
  end if;

  select count(*) into daily_session_count
  from public.analysis_sessions
  where user_id = auth.uid()
    and created_at >= now() - interval '24 hours';

  if daily_session_count >= max_sessions_per_24_hours then
    raise exception 'Daily save quota exceeded.' using errcode = '54000';
  end if;

  insert into public.analysis_sessions (
    user_id,
    total_words,
    content_words,
    unique_words,
    sentence_count,
    cefr_summary,
    top_words
  )
  values (
    auth.uid(),
    greatest(coalesce(p_total_words, 0), 0),
    greatest(coalesce(p_content_words, 0), 0),
    greatest(coalesce(p_unique_words, 0), 0),
    greatest(coalesce(p_sentence_count, 0), 0),
    coalesce(p_cefr_summary, '[]'::jsonb),
    coalesce(p_top_words, '[]'::jsonb)
  )
  returning * into inserted_session;

  insert into public.word_frequencies (
    session_id,
    user_id,
    word,
    normalized_word,
    count,
    cefr_level
  )
  select
    inserted_session.id,
    auth.uid(),
    left(item.word, 120),
    left(item."normalizedWord", 120),
    least(item.count, 100000),
    left(coalesce(item."cefrLevel", 'Unknown'), 20)
  from jsonb_to_recordset(coalesce(p_word_frequencies, '[]'::jsonb))
    as item(word text, "normalizedWord" text, count integer, "cefrLevel" text)
  where item.word is not null
    and item."normalizedWord" is not null
    and item.count > 0;

  return inserted_session;
end;
$$;

drop policy if exists "Users can insert their own analysis sessions"
  on public.analysis_sessions;

drop policy if exists "Users can insert their own word frequencies"
  on public.word_frequencies;

revoke insert on public.analysis_sessions from anon, authenticated;
revoke insert on public.word_frequencies from anon, authenticated;

grant execute on function public.save_analysis_session(
  integer,
  integer,
  integer,
  integer,
  jsonb,
  jsonb,
  jsonb
) to authenticated;

revoke execute on function public.get_global_top_words(integer) from anon;
grant execute on function public.get_global_top_words(integer) to authenticated;
