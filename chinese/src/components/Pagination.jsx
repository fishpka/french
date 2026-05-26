import { useState } from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

export default function Pagination({ currentPage, totalPages, messages, onPageChange }) {
  const [pageInput, setPageInput] = useState(String(currentPage));

  function submitPage(event) {
    event.preventDefault();
    const requestedPage = Number.parseInt(pageInput, 10);
    if (Number.isNaN(requestedPage)) {
      setPageInput(String(currentPage));
      return;
    }
    onPageChange(Math.min(totalPages, Math.max(1, requestedPage)));
  }

  return (
    <nav className="pagination" aria-label={messages.pagination}>
      <button
        className="pagination__button"
        type="button"
        disabled={currentPage === 1}
        onClick={() => onPageChange(currentPage - 1)}
      >
        <ArrowLeft size={15} />
        {messages.previous}
      </button>

      <div className="pagination__status">
        <span>{messages.page}</span>
        <form onSubmit={submitPage}>
          <label className="sr-only" htmlFor="page-input">{messages.goToPage}</label>
          <input
            id="page-input"
            type="number"
            min="1"
            max={totalPages}
            value={pageInput}
            onChange={(event) => setPageInput(event.target.value)}
            onBlur={() => setPageInput(String(currentPage))}
          />
        </form>
        <span>{messages.pageOf(totalPages)}</span>
      </div>

      <button
        className="pagination__button"
        type="button"
        disabled={currentPage === totalPages}
        onClick={() => onPageChange(currentPage + 1)}
      >
        {messages.next}
        <ArrowRight size={15} />
      </button>
    </nav>
  );
}
