"use client";

import { useState } from "react";
import { button } from "./ui";

// Owner: Member 1. Splits a long list into pages. Each list keeps its own page, and the page resets when the list
// shrinks below it (for example after a search).

export function usePaged<T>(items: readonly T[], pageSize: number) {
  const [page, setPage] = useState(1);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(page, pageCount);
  return {
    page: current,
    pageCount,
    setPage,
    pageItems: items.slice((current - 1) * pageSize, current * pageSize),
    first: items.length === 0 ? 0 : (current - 1) * pageSize + 1,
    last: Math.min(current * pageSize, items.length),
    total: items.length,
  };
}

export function Pager({ paged, label }: { paged: ReturnType<typeof usePaged<unknown>>; label: string }) {
  if (paged.pageCount <= 1) return null;
  return (
    <nav aria-label={`${label} pages`} className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm text-slate-600">
      <span className="tabular">{paged.first}–{paged.last} of {paged.total}</span>
      <span className="flex items-center gap-2">
        <button type="button" className={`${button.secondary} px-3 py-1.5`} disabled={paged.page === 1} onClick={() => paged.setPage(paged.page - 1)}>← Previous</button>
        <span className="tabular" aria-live="polite">Page {paged.page} of {paged.pageCount}</span>
        <button type="button" className={`${button.secondary} px-3 py-1.5`} disabled={paged.page === paged.pageCount} onClick={() => paged.setPage(paged.page + 1)}>Next →</button>
      </span>
    </nav>
  );
}
