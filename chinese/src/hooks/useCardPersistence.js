import { useCallback } from 'react';

const storageKey = 'yujing-word-card-edits';

function readEdits() {
  try {
    const value = window.localStorage.getItem(storageKey);
    return value ? JSON.parse(value) : {};
  } catch {
    return {};
  }
}

export function applyEditedFields(entry, editedFields) {
  return {
    ...entry,
    term: editedFields.term,
    editable: editedFields,
    searchableText: [
      entry.baseSearchableText || entry.searchableText,
      editedFields.term,
      editedFields.english,
      editedFields.french,
      editedFields.scenario,
      ...editedFields.emotions,
    ].join(' '),
  };
}

export default function useCardPersistence() {
  const restoreEdits = useCallback((entries) => {
    const savedEdits = readEdits();
    return entries.map((entry) => (
      savedEdits[entry.id] ? applyEditedFields(entry, savedEdits[entry.id]) : entry
    ));
  }, []);

  const saveEdit = useCallback((entryId, editedFields) => {
    try {
      const savedEdits = readEdits();
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({ ...savedEdits, [entryId]: editedFields }),
      );
      return true;
    } catch {
      return false;
    }
  }, []);

  return { restoreEdits, saveEdit };
}
