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
security invoker
set search_path = public
as $$
declare
  inserted_session public.analysis_sessions;
begin
  if auth.uid() is null then
    raise exception 'User is not authenticated.';
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
    coalesce(p_total_words, 0),
    coalesce(p_content_words, 0),
    coalesce(p_unique_words, 0),
    coalesce(p_sentence_count, 0),
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
    item.word,
    item."normalizedWord",
    item.count,
    coalesce(item."cefrLevel", 'Unknown')
  from jsonb_to_recordset(coalesce(p_word_frequencies, '[]'::jsonb))
    as item(word text, "normalizedWord" text, count integer, "cefrLevel" text)
  where item.word is not null
    and item."normalizedWord" is not null
    and item.count > 0;

  return inserted_session;
end;
$$;

grant execute on function public.save_analysis_session(
  integer,
  integer,
  integer,
  integer,
  jsonb,
  jsonb,
  jsonb
) to authenticated;
