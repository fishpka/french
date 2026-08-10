import { useEffect, useMemo, useState } from 'react';

export const SAVED_WORDS_STORAGE_KEY = 'french_saved_words';

const cefrLevels = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'Unknown', 'Excluded']);

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeWordValue(value) {
  return normalizeText(value).toLowerCase().replace(/[’]/g, "'");
}

export function getWordId(wordData = {}) {
  const lemma = normalizeWordValue(wordData.lemma || wordData.normalizedWord);
  if (lemma) return lemma;
  return normalizeWordValue(wordData.word);
}

function normalizeSavedWord(item) {
  if (!item || typeof item !== 'object') return null;

  const word = normalizeText(item.word);
  const lemma = normalizeWordValue(item.lemma || item.normalizedWord || word);
  const id = getWordId({ ...item, lemma });

  if (!word || !lemma || !id) return null;

  const savedAt = normalizeText(item.savedAt) || new Date().toISOString();
  const cefr = cefrLevels.has(item.cefr) ? item.cefr : 'Unknown';
  const savedWord = {
    word,
    lemma,
    cefr,
    savedAt,
  };

  const pos = normalizeText(item.pos || item.partOfSpeech);
  const translation = normalizeText(item.translation);
  const definition = normalizeText(item.definition);
  const frequency = Number(item.frequency);
  const count = Number(item.count);

  if (pos) savedWord.pos = pos;
  if (Number.isFinite(frequency)) savedWord.frequency = frequency;
  if (Number.isFinite(count)) savedWord.count = count;
  if (translation) savedWord.translation = translation;
  if (definition) savedWord.definition = definition;

  return savedWord;
}

function dedupeWords(words) {
  const map = new Map();

  words.forEach((item) => {
    const normalized = normalizeSavedWord(item);
    if (!normalized) return;

    const id = getWordId(normalized);
    if (!map.has(id)) {
      map.set(id, normalized);
      return;
    }

    const current = map.get(id);
    map.set(id, {
      ...current,
      ...normalized,
      savedAt: current.savedAt || normalized.savedAt,
    });
  });

  return [...map.values()];
}

function readSavedWords() {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(SAVED_WORDS_STORAGE_KEY);
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return dedupeWords(parsed);
  } catch {
    return [];
  }
}

function writeSavedWords(words) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(SAVED_WORDS_STORAGE_KEY, JSON.stringify(dedupeWords(words)));
  } catch {
    // LocalStorage can fail in private browsing or quota-limited contexts.
  }
}

export function useSavedWords() {
  const [savedWords, setSavedWords] = useState(readSavedWords);

  useEffect(() => {
    writeSavedWords(savedWords);
  }, [savedWords]);

  useEffect(() => {
    const handleStorage = (event) => {
      if (event.key === SAVED_WORDS_STORAGE_KEY) {
        setSavedWords(readSavedWords());
      }
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  const savedIds = useMemo(() => new Set(savedWords.map(getWordId)), [savedWords]);

  const isSaved = (word) => savedIds.has(getWordId(word));

  const saveWord = (word) => {
    const normalized = normalizeSavedWord({
      ...word,
      savedAt: word?.savedAt || new Date().toISOString(),
    });

    if (!normalized) return null;

    setSavedWords((current) => {
      const next = dedupeWords([normalized, ...current]);
      return next;
    });

    return normalized;
  };

  const removeWord = (word) => {
    const id = getWordId(word);
    if (!id) return null;

    let removed = null;
    setSavedWords((current) => current.filter((item) => {
      const shouldRemove = getWordId(item) === id;
      if (shouldRemove) removed = item;
      return !shouldRemove;
    }));

    return removed;
  };

  const toggleSavedWord = (word) => {
    if (isSaved(word)) {
      return { action: 'removed', word: removeWord(word) };
    }

    return { action: 'saved', word: saveWord(word) };
  };

  const clearSavedWords = () => {
    setSavedWords([]);
  };

  return {
    savedWords,
    isSaved,
    saveWord,
    removeWord,
    toggleSavedWord,
    clearSavedWords,
    savedCount: savedWords.length,
  };
}
