import { Moon, Sun } from 'lucide-react';

export default function ThemeToggle({ theme, messages, onToggle }) {
  const dark = theme === 'dark';

  return (
    <button
      type="button"
      className="grid size-10 place-items-center border border-line text-muted transition-colors hover:border-ink hover:text-ink dark:border-line-dark dark:text-muted-dark dark:hover:border-moon dark:hover:text-moon"
      aria-label={dark ? messages.themeLight : messages.themeDark}
      onClick={onToggle}
    >
      {dark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
}
