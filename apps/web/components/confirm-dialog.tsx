"use client";

import { type ReactNode, useEffect, useId, useRef } from "react";
import { button } from "./ui";

/** Asks before an action that can't be undone. Focus starts on Cancel, and Esc also cancels. */
export function ConfirmDialog({ open, title, children, confirmLabel, onConfirm, onCancel }: { open: boolean; title: string; children: ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={(event) => { event.preventDefault(); onCancel(); }} className="m-auto w-[calc(100%-2rem)] max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-navy backdrop:bg-navy/50">
      <h2 id={titleId} className="text-lg font-bold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-slate-600">{children}</div>
      <div className="mt-5 flex justify-end gap-2.5">
        <button type="button" autoFocus onClick={onCancel} className={button.secondary}>Cancel</button>
        <button type="button" onClick={onConfirm} className={button.confirm}>{confirmLabel}</button>
      </div>
    </dialog>
  );
}
