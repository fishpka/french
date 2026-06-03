import { Menu, X } from 'lucide-react';
import { useState } from 'react';

export default function Navbar({ brand, links }) {
  const [isOpen, setIsOpen] = useState(false);

  const closeMenu = () => setIsOpen(false);
  const mark = brand?.trim()?.charAt(0) || 'L';

  return (
    <header className="navbar">
      <a className="navbar__brand" href="#home" onClick={closeMenu}>
        <span className="navbar__mark" aria-hidden="true">{mark}</span>
        {brand}
      </a>

      <nav className={`navbar__nav ${isOpen ? 'navbar__nav--open' : ''}`} aria-label="主要導覽">
        {links.map((link) => (
          <a
            key={link.href}
            className={link.href === '#home' ? 'navbar__link--active' : undefined}
            href={link.href}
            onClick={closeMenu}
          >
            {link.label}
          </a>
        ))}
        <a className="navbar__cta" href="#analyzer" onClick={closeMenu}>
          開始分析
        </a>
      </nav>

      <button
        className={`navbar__toggle ${isOpen ? 'navbar__toggle--open' : ''}`}
        type="button"
        aria-label={isOpen ? '關閉選單' : '開啟選單'}
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
      >
        <Menu className="navbar__icon navbar__icon--menu" size={22} aria-hidden="true" />
        <X className="navbar__icon navbar__icon--close" size={22} aria-hidden="true" />
      </button>
    </header>
  );
}
