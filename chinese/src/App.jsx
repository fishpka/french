import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { loadTeachingDatabase } from './data/teachingDatabase.js';
import { copy, searchPrompts } from './i18n.js';
import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import SearchPanel from './components/SearchPanel.jsx';
import ExpressionCard from './components/ExpressionCard.jsx';
import Pagination from './components/Pagination.jsx';
import useTheme from './hooks/useTheme.js';
import useCardPersistence, { applyEditedFields } from './hooks/useCardPersistence.js';

const pageSize = 24;
const searchCharacterMap = {
  慮: '虑', 獨: '独', 曖: '暧', 無: '无', 懷: '怀', 舊: '旧', 關: '关',
  係: '系', 複: '复', 雜: '杂', 藥: '药', 救: '救', 險: '险', 惡: '恶',
  詞: '词', 語: '语', 節: '节', 氣: '气', 憶: '忆', 戀: '恋', 寫: '写',
  說: '说', 離: '离', 疏: '疏', 鬱: '郁', 煩: '烦', 憂: '忧',
};

function normalizeSearchText(value) {
  return value
    .toLocaleLowerCase()
    .replace(/./gu, (character) => searchCharacterMap[character] || character);
}

function matchesQuery(entry, query) {
  if (!query.trim()) return true;

  const needle = normalizeSearchText(query);
  return normalizeSearchText(entry.searchableText).includes(needle);
}

export default function App() {
  const [query, setQuery] = useState('');
  const [locale, setLocale] = useState('zh');
  const [currentPage, setCurrentPage] = useState(1);
  const [database, setDatabase] = useState({ source: 'Chinese-teaching.txt', total: 0, entries: [], loading: true });
  const { theme, toggleTheme } = useTheme();
  const { restoreEdits, saveEdit } = useCardPersistence();
  const reduceMotion = useReducedMotion();
  const messages = copy[locale];
  const results = useMemo(
    () => database.entries.filter((entry) => matchesQuery(entry, query)),
    [database.entries, query],
  );
  const totalPages = Math.max(1, Math.ceil(results.length / pageSize));
  const visiblePage = Math.min(currentPage, totalPages);
  const pageResults = results.slice((visiblePage - 1) * pageSize, visiblePage * pageSize);

  const transition = reduceMotion ? { duration: 0 } : { duration: 0.42, ease: [0.16, 1, 0.3, 1] };

  useEffect(() => {
    document.documentElement.lang = locale === 'zh' ? 'zh-Hant' : locale;
  }, [locale]);

  useEffect(() => {
    let active = true;

    loadTeachingDatabase()
      .then((loadedDatabase) => {
        if (active) {
          setDatabase({
            ...loadedDatabase,
            entries: restoreEdits(loadedDatabase.entries),
            loading: false,
          });
        }
      })
      .catch(() => {
        if (active) setDatabase((value) => ({ ...value, loading: false }));
      });

    return () => {
      active = false;
    };
  }, [restoreEdits]);

  function handleSaveEntry(entryId, editedFields) {
    const saved = saveEdit(entryId, editedFields);
    setDatabase((current) => ({
      ...current,
      entries: current.entries.map((entry) => {
        if (entry.id !== entryId) return entry;
        return applyEditedFields(entry, editedFields);
      }),
    }));
    return saved;
  }

  function handlePageChange(page) {
    setCurrentPage(page);
    window.requestAnimationFrame(() => {
      document.getElementById('results-heading')?.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
    });
  }

  function handleQueryChange(value) {
    setQuery(value);
    setCurrentPage(1);
  }

  return (
    <div className="min-h-screen bg-canvas text-ink transition-colors duration-500 dark:bg-night dark:text-moon">
      <Header
        locale={locale}
        messages={messages}
        theme={theme}
        onLocaleChange={setLocale}
        onThemeToggle={toggleTheme}
      />
      <main>
        <Hero messages={messages} />

        <motion.section
          id="explore"
          className="mx-auto max-w-7xl px-5 pb-20 sm:px-8 lg:px-12 lg:pb-28"
          initial={reduceMotion ? false : { opacity: 0, y: 22 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-80px' }}
          transition={transition}
        >
          <SearchPanel
            locale={locale}
            messages={messages}
            query={query}
            resultCount={database.loading ? null : results.length}
            suggestions={searchPrompts}
            onQueryChange={handleQueryChange}
          />

          <div id="results-heading" className="scroll-mt-28 mt-12 flex items-end justify-between border-b border-line pb-5 dark:border-line-dark">
            <div>
              <p className="label">{messages.entries}</p>
              <h2 className="mt-3 text-2xl font-medium tracking-tight sm:text-3xl">
                {messages.results(query)}
              </h2>
            </div>
            <span className="hidden text-sm tracking-[0.16em] text-muted dark:text-muted-dark sm:block">
              {messages.count(results.length)}
            </span>
          </div>

          <motion.div layout className="mt-8 grid gap-5 lg:grid-cols-2">
            <AnimatePresence mode="popLayout">
              {pageResults.map((entry, index) => (
                <ExpressionCard
                  key={entry.id}
                  entry={entry}
                  locale={locale}
                  messages={messages}
                  index={index}
                  reduceMotion={reduceMotion}
                  onSave={handleSaveEntry}
                />
              ))}
            </AnimatePresence>
          </motion.div>

          {database.loading && (
            <p className="mt-12 text-center text-sm tracking-[0.2em] text-muted dark:text-muted-dark">
              {messages.loading}
            </p>
          )}

          {!database.loading && results.length > pageSize && (
            <>
              <p className="mt-9 text-center text-sm tracking-[0.12em] text-muted dark:text-muted-dark">
                {messages.showing((visiblePage - 1) * pageSize + 1, Math.min(visiblePage * pageSize, results.length), results.length)}
              </p>
              <Pagination
                key={`${visiblePage}-${totalPages}`}
                currentPage={visiblePage}
                totalPages={totalPages}
                messages={messages}
                onPageChange={handlePageChange}
              />
            </>
          )}

          <AnimatePresence>
            {!database.loading && !results.length && (
              <motion.div
                className="mt-8 border border-line bg-paper px-7 py-16 text-center dark:border-line-dark dark:bg-panel"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                <p className="text-xl font-medium">{messages.emptyTitle}</p>
                <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted dark:text-muted-dark">
                  {messages.emptyBody}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.section>
      </main>

      <footer className="border-t border-line px-5 py-8 text-sm text-muted dark:border-line-dark dark:text-muted-dark sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col justify-between gap-3 sm:flex-row">
          <p className="tracking-[0.22em]">{messages.archive}</p>
          <p>{messages.source}: {database.source} / {database.total} {messages.matches}</p>
          <p>{messages.footer}</p>
        </div>
      </footer>
    </div>
  );
}
