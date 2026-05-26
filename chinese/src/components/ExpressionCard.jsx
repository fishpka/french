import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, PencilLine, X } from 'lucide-react';

const categoryNames = {
  zh: { 成語: '成語', 典故: '典故', 文化詞彙: '文化詞彙' },
  en: { 成語: 'Idiom', 典故: 'Allusion', 文化詞彙: 'Cultural term' },
  fr: { 成語: 'Expression', 典故: 'Allusion', 文化詞彙: 'Terme culturel' },
};

function getDraft(entry) {
  return {
    ...entry.editable,
    emotions: entry.editable.emotions.join('、'),
  };
}

export default function ExpressionCard({ entry, locale, messages, index, reduceMotion, onSave }) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(() => getDraft(entry));
  const [showSaved, setShowSaved] = useState(false);
  const selected = entry.content[locale];
  const example = selected.example || entry.content.zh.example;

  useEffect(() => {
    if (!showSaved) return undefined;
    const timeout = window.setTimeout(() => setShowSaved(false), 1400);
    return () => window.clearTimeout(timeout);
  }, [showSaved]);

  function beginEditing() {
    setDraft(getDraft(entry));
    setIsEditing(true);
  }

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  function saveChanges(event) {
    event.preventDefault();
    const fields = {
      term: draft.term.trim() || entry.term,
      english: draft.english.trim(),
      french: draft.french.trim(),
      emotions: draft.emotions
        .split(/[,，、]/u)
        .map((emotion) => emotion.trim())
        .filter(Boolean),
      scenario: draft.scenario.trim(),
    };
    if (!fields.emotions.length) fields.emotions = [entry.category];
    const saved = onSave(entry.id, fields);
    setShowSaved(saved !== false);
    setIsEditing(false);
  }

  return (
    <motion.article
      layout
      className={`expression-card group border bg-paper p-6 transition-colors dark:bg-panel sm:p-8 ${
        isEditing
          ? 'border-accent/45 dark:border-accent-soft/50'
          : 'cursor-pointer border-line hover:border-ink/40 dark:border-line-dark dark:hover:border-moon/35'
      }`}
      initial={reduceMotion ? false : { opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
      transition={{ duration: reduceMotion ? 0 : 0.38, delay: reduceMotion ? 0 : index * 0.035, ease: [0.16, 1, 0.3, 1] }}
      onClick={!isEditing ? beginEditing : undefined}
    >
      <AnimatePresence initial={false} mode="wait">
        {isEditing ? (
          <EditForm
            key="edit"
            draft={draft}
            messages={messages}
            reduceMotion={reduceMotion}
            onChange={updateField}
            onCancel={() => setIsEditing(false)}
            onSave={saveChanges}
          />
        ) : (
          <ReadCard
            key="read"
            entry={entry}
            example={example}
            locale={locale}
            messages={messages}
            reduceMotion={reduceMotion}
            onEdit={beginEditing}
            showSaved={showSaved}
          />
        )}
      </AnimatePresence>
    </motion.article>
  );
}

function ReadCard({ entry, example, locale, messages, reduceMotion, onEdit, showSaved }) {
  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? undefined : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.2 }}
    >
      <div className="flex justify-between gap-4">
        <div>
          <div className="flex items-baseline gap-3">
            <h3 className="text-3xl font-medium tracking-tight sm:text-4xl">{entry.editable.term}</h3>
            <span className="text-xs tracking-[0.18em] text-muted dark:text-muted-dark">
              {categoryNames[locale][entry.category]}
            </span>
          </div>
          <div className="mt-3 h-5 text-xs text-faint dark:text-faint-dark">
            <AnimatePresence mode="wait" initial={false}>
              {showSaved ? (
                <motion.span
                  key="saved"
                  className="inline-flex items-center gap-1.5 text-accent dark:text-accent-soft"
                  initial={reduceMotion ? false : { opacity: 0, y: 3 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduceMotion ? undefined : { opacity: 0, y: -3 }}
                >
                  <Check size={12} />
                  {messages.saved}
                </motion.span>
              ) : (
                <motion.span key="hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  {messages.editHint}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
        <button
          className="edit-trigger flex size-9 items-center justify-center text-muted dark:text-muted-dark"
          type="button"
          aria-label={messages.edit}
          onClick={(event) => {
            event.stopPropagation();
            onEdit();
          }}
        >
          <PencilLine size={15} />
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {entry.editable.emotions.map((emotion) => (
          <span key={emotion} className="emotion-tag bg-canvas px-3 py-1.5 text-xs text-muted dark:bg-night dark:text-muted-dark">
            {emotion}
          </span>
        ))}
      </div>

      <dl className="mt-7 space-y-5 text-sm">
        <Detail label={messages.english} text={entry.editable.english || messages.fallback} />
        <Detail label={messages.french} text={entry.editable.french || messages.fallback} />
        <Detail label={messages.scenario} text={entry.editable.scenario || messages.fallback} clamp />
        {example && <Detail label={messages.example} text={example} emphasized clamp />}
      </dl>
    </motion.div>
  );
}

function EditForm({ draft, messages, reduceMotion, onChange, onCancel, onSave }) {
  return (
    <motion.form
      className="edit-form"
      initial={reduceMotion ? false : { opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduceMotion ? undefined : { opacity: 0, y: -5 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
      onSubmit={onSave}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="flex items-center justify-between border-b border-line pb-5 dark:border-line-dark">
        <p className="label">{messages.edit}</p>
        <button type="button" className="text-muted hover:text-ink dark:text-muted-dark dark:hover:text-moon" onClick={onCancel}>
          <X size={17} />
        </button>
      </div>
      <Field label={messages.term} value={draft.term} onChange={(value) => onChange('term', value)} term />
      <Field label={messages.english} value={draft.english} onChange={(value) => onChange('english', value)} />
      <Field label={messages.french} value={draft.french} onChange={(value) => onChange('french', value)} />
      <Field
        label={messages.emotions}
        value={draft.emotions}
        placeholder={messages.emotionsHint}
        onChange={(value) => onChange('emotions', value)}
      />
      <Field label={messages.scenario} value={draft.scenario} onChange={(value) => onChange('scenario', value)} multiline />
      <div className="mt-7 flex justify-end gap-3">
        <button className="card-action card-action--quiet" type="button" onClick={onCancel}>{messages.cancel}</button>
        <button className="card-action card-action--save" type="submit">
          <Check size={15} />
          {messages.save}
        </button>
      </div>
    </motion.form>
  );
}

function Field({ label, value, placeholder, onChange, multiline = false, term = false }) {
  const Element = multiline ? 'textarea' : 'input';
  return (
    <label className="edit-field">
      <span>{label}</span>
      <Element
        className={term ? 'edit-field__term' : undefined}
        value={value}
        placeholder={placeholder}
        rows={multiline ? 3 : undefined}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  );
}

function Detail({ label, text, emphasized = false, clamp = false }) {
  return (
    <div className="grid gap-2 sm:grid-cols-[5.5rem_1fr]">
      <dt className="text-xs tracking-[0.14em] text-muted dark:text-muted-dark">{label}</dt>
      <dd className={`${emphasized ? 'text-ink dark:text-moon' : 'text-muted dark:text-muted-dark'} ${clamp ? 'line-clamp-4' : ''} leading-7`}>
        {text}
      </dd>
    </div>
  );
}
