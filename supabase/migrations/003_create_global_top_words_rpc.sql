create or replace function public.get_global_top_words(
  p_limit integer default 100
)
returns table (
  word text,
  normalized_word text,
  total_count bigint,
  cefr_level text
)
language sql
security definer
set search_path = public
as $$
  select
    word_frequencies.normalized_word as word,
    word_frequencies.normalized_word,
    sum(word_frequencies.count)::bigint as total_count,
    (
      array_agg(
        word_frequencies.cefr_level
        order by case word_frequencies.cefr_level
          when 'A1' then 1
          when 'A2' then 2
          when 'B1' then 3
          when 'B2' then 4
          when 'C1' then 5
          when 'C2' then 6
          else 7
        end
      )
    )[1] as cefr_level
  from public.word_frequencies
  where word_frequencies.normalized_word is not null
    and word_frequencies.normalized_word <> ''
    and lower(word_frequencies.normalized_word) not in (
      'donc',
      'être',
      'pouvoir',
      'face',
      'celle',
      'fin',
      'jamais'
    )
  group by word_frequencies.normalized_word
  order by sum(word_frequencies.count) desc, word_frequencies.normalized_word asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

grant execute on function public.get_global_top_words(integer) to anon, authenticated;
