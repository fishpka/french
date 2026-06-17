import { supabase } from './supabaseClient.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

export async function saveAnalysisSession(userId, snapshot) {
  const client = requireSupabase();
  const sessionPayload = {
    user_id: userId,
    total_words: snapshot.totalWords,
    content_words: snapshot.contentWords,
    unique_words: snapshot.uniqueWords,
    sentence_count: snapshot.sentenceCount,
    cefr_summary: snapshot.cefrSummary,
    top_words: snapshot.topWords,
  };

  const { data: session, error: sessionError } = await client
    .from('analysis_sessions')
    .insert(sessionPayload)
    .select()
    .single();

  if (sessionError) throw sessionError;

  const wordRows = snapshot.wordFrequencies.map((item) => ({
    session_id: session.id,
    user_id: userId,
    word: item.word,
    normalized_word: item.normalizedWord,
    count: item.count,
    cefr_level: item.cefrLevel,
  }));

  if (wordRows.length) {
    const { error: wordsError } = await client
      .from('word_frequencies')
      .insert(wordRows);

    if (wordsError) throw wordsError;
  }

  return session;
}

export async function getAnalysisHistory() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('analysis_sessions')
    .select(`
      id,
      created_at,
      total_words,
      content_words,
      unique_words,
      sentence_count,
      cefr_summary,
      top_words,
      word_frequencies (
        id,
        word,
        normalized_word,
        count,
        cefr_level
      )
    `)
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) throw error;
  return data || [];
}

export async function deleteAnalysisSession(sessionId) {
  const client = requireSupabase();
  const { error } = await client
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}
