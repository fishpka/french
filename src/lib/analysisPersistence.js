import { supabase } from './supabaseClient.js';

function requireSupabase() {
  if (!supabase) {
    throw new Error('Supabase is not configured.');
  }

  return supabase;
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

export async function deleteAnalysisSession(sessionId) {
  const client = requireSupabase();
  const { error } = await client
    .from('analysis_sessions')
    .delete()
    .eq('id', sessionId);

  if (error) throw error;
}
