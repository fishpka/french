import { motion } from 'framer-motion';
import { locales } from '../i18n.js';
import ThemeToggle from './ThemeToggle.jsx';

export default function Header({ locale, messages, theme, onLocaleChange, onThemeToggle }) {
  return (
    <motion.header
      className="site-header sticky top-0 z-30 border-b border-line bg-canvas/90 backdrop-blur-xl dark:border-line-dark dark:bg-night/88"
      initial={{ opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
    >
      <div className="mx-auto flex h-17 max-w-7xl items-center justify-between px-5 sm:px-8 lg:px-12">
        <a className="flex items-center gap-3" href="#" aria-label={messages.brandSubtitle}>
          <span className="seal-mark grid size-9 place-items-center text-base font-medium">
            境
          </span>
          <span>
            <span className="block text-base font-medium tracking-[0.3em]">語境</span>
            <span className="hidden text-[10px] tracking-[0.34em] text-muted dark:text-muted-dark sm:block">
              {messages.brandSubtitle}
            </span>
          </span>
        </a>

        <div className="flex items-center gap-6">
          <nav className="hidden items-center gap-7 text-sm text-muted dark:text-muted-dark md:flex" aria-label="主要導覽">
            <a className="ink-link transition-colors hover:text-ink dark:hover:text-moon" href="#explore">{messages.navExplore}</a>
            <a className="ink-link transition-colors hover:text-ink dark:hover:text-moon" href="#method">{messages.navAbout}</a>
          </nav>
          <div className="locale-switcher hidden items-center border border-line dark:border-line-dark sm:flex" aria-label="Language">
            {locales.map((option) => (
              <button
                key={option.id}
                type="button"
                className={`px-3 py-2 text-xs transition-colors ${
                  locale === option.id
                    ? 'bg-ink text-canvas dark:bg-moon dark:text-night'
                    : 'text-muted hover:text-ink dark:text-muted-dark dark:hover:text-moon'
                }`}
                onClick={() => onLocaleChange(option.id)}
              >
                {option.label}
              </button>
            ))}
          </div>
          <ThemeToggle theme={theme} messages={messages} onToggle={onThemeToggle} />
        </div>
      </div>
      <div className="flex justify-center gap-1 border-t border-line px-5 py-2 dark:border-line-dark sm:hidden" aria-label="Language">
        {locales.map((option) => (
          <button
            key={option.id}
            type="button"
            className={`px-4 py-1.5 text-xs ${
              locale === option.id ? 'text-accent dark:text-accent-soft' : 'text-muted dark:text-muted-dark'
            }`}
            onClick={() => onLocaleChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </motion.header>
  );
}
