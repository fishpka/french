import { supabase } from './supabaseClient.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
}

function isMissingRpcError(error) {
  return (
    error?.code === 'PGRST202'
    || error?.message?.includes('Could not find the function public.save_analysis_session')
  );
}

async function saveAnalysisSessionDirectly(client, userId, snapshot) {
  const { data: session, error: sessionError } = await client
    .from('analysis_sessions')
    .insert({
      user_id: userId,
      total_words: snapshot.totalWords,
      content_words: snapshot.contentWords,
      unique_words: snapshot.uniqueWords,
      sentence_count: snapshot.sentenceCount,
      cefr_summary: snapshot.cefrSummary,
      top_words: snapshot.topWords,
    })
    .select()
    .single();

  if (sessionError) throw sessionError;

  const wordFrequencies = (snapshot.wordFrequencies || []).map((item) => ({
    session_id: session.id,
    user_id: userId,
    word: item.word,
    normalized_word: item.normalizedWord,
    count: item.count,
    cefr_level: item.cefrLevel || 'Unknown',
  }));

  if (wordFrequencies.length) {
    const { error: wordsError } = await client
      .from('word_frequencies')
      .insert(wordFrequencies);

    if (wordsError) throw wordsError;
  }

  return session;
}

export async function saveAnalysisSession(userId, snapshot) {
  const client = requireSupabase();
  if (!userId) throw new Error('User is not authenticated.');

  const { data: session, error } = await client.rpc('save_analysis_session', {
    p_total_words: snapshot.totalWords,
    p_content_words: snapshot.contentWords,
    p_unique_words: snapshot.uniqueWords,
    p_sentence_count: snapshot.sentenceCount,
    p_cefr_summary: snapshot.cefrSummary,
    p_top_words: snapshot.topWords,
    p_word_frequencies: snapshot.wordFrequencies,
  });

  if (isMissingRpcError(error)) {
    return saveAnalysisSessionDirectly(client, userId, snapshot);
  }

  if (error) throw error;
  return session;
}

const analysisSessionSelect = `
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
`;

export async function getAnalysisHistory() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('analysis_sessions')
    .select(analysisSessionSelect)
    .order('created_at', { ascending: false })
    .limit(24);

  if (error) throw error;
  return data || [];
}

export async function getAnalysisExportData() {
  const client = requireSupabase();
  const { data, error } = await client
    .from('analysis_sessions')
    .select(analysisSessionSelect)
    .order('created_at', { ascending: true })
    .limit(1000);

  if (error) throw error;
  return data || [];
}

export async function getGlobalTopWords(limit = 100) {
  const client = requireSupabase();
  const { data, error } = await client.rpc('get_global_top_words', {
    p_limit: limit,
  });

  if (error) throw error;

  const excludedGlobalWords = new Set(['donc', 'être', 'pouvoir', 'face', 'celle', 'fin', 'jamais']);

  return (data || [])
    .filter((item) => !excludedGlobalWords.has(String(item.normalized_word || item.word || '').toLowerCase()))
    .map((item) => ({
      word: item.word,
      normalizedWord: item.normalized_word,
      count: Number(item.total_count || 0),
      cefrLevel: item.cefr_level || 'Unknown',
    }));
}

export async function deleteAnalysisSession(sessionId) {
  const client = requireSupabase();
  const { error } = await client
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}
