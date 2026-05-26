import { ArrowDown } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export default function Hero({ messages }) {
  const reduceMotion = useReducedMotion();
  const reveal = (delay) => ({
    initial: reduceMotion ? false : { opacity: 0, y: 24 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: reduceMotion ? 0 : 0.7, delay, ease: [0.16, 1, 0.3, 1] },
  });

  return (
    <section className="hero-section mx-auto grid max-w-7xl gap-12 px-5 pb-18 pt-16 sm:px-8 sm:pt-22 lg:grid-cols-[1fr_20rem] lg:px-12 lg:pb-24 lg:pt-28">
      <div>
        <motion.p {...reveal(0)} className="label">
          {messages.heroLabel}
        </motion.p>
        <motion.h1
          {...reveal(0.07)}
          className="mt-8 max-w-4xl text-[clamp(3.1rem,7.7vw,6.9rem)] font-medium leading-[1.03] tracking-[-0.075em]"
        >
          Not just translation,
          <span className="block text-accent dark:text-accent-soft">{messages.heroAccent}</span>
        </motion.h1>
        <motion.p
          {...reveal(0.15)}
          className="mt-9 max-w-xl text-base leading-8 text-muted dark:text-muted-dark sm:text-lg"
        >
          {messages.heroBody}
        </motion.p>
      </div>

      <motion.aside
        {...reveal(0.2)}
        id="method"
        className="hero-note flex flex-col justify-end border-t border-line pt-6 text-sm leading-7 text-muted dark:border-line-dark dark:text-muted-dark lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
      >
        <div className="verse-mark" aria-hidden="true">
          <span>言</span>
          <p>{messages.verse}</p>
        </div>
        <p className="label mb-4">{messages.methodLabel}</p>
        <p>{messages.method}</p>
        <a className="mt-7 inline-flex items-center gap-2 text-ink dark:text-moon" href="#explore">
          {messages.begin} <ArrowDown size={15} />
        </a>
      </motion.aside>
    </section>
  );
}
