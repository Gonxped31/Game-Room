"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  /** Does the work; resolves to an error message to show, or null once done. */
  run: () => Promise<string | null>;
}

/**
 * The dashboard's own confirm box, in place of the browser's confirm() and
 * alert(), which show the site's address and dim the whole window. A modal
 * <dialog> that opens on Cancel (the safe choice); Escape backs out too,
 * except while the work runs. A failure shows in the box, with a retry.
 */
export default function ConfirmDialog({ request, onFinish }: { request: ConfirmRequest; onFinish: (done: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const failure = await request.run().catch(() => "Something went wrong.");
    setBusy(false);
    if (failure) setError(failure);
    else onFinish(true);
  };

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onFinish(false);
      }}
      className="m-auto w-[min(28rem,calc(100%-2rem))] max-w-none rounded-2xl border-0 bg-white p-5 text-black opacity-100 shadow-[0_8px_30px_rgba(0,0,0,.25)] transition-opacity duration-150 backdrop:bg-black/30 starting:open:opacity-0"
    >
      <h2 id={titleId} className="m-0 text-lg font-bold">
        {request.title}
      </h2>
      <p className="m-0 mt-2 text-sm leading-relaxed text-black/75">{request.message}</p>
      {error && (
        <p role="alert" className="m-0 mt-3 text-sm font-bold text-[#B3123F]">
          {error}
        </p>
      )}
      <div className="mt-5 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => onFinish(false)}
          disabled={busy}
          className="cursor-pointer rounded-lg border-2 border-black/20 bg-white px-4 py-2 text-sm font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void confirm()}
          disabled={busy}
          className="cursor-pointer rounded-lg border-2 border-[#B3123F] bg-[#B3123F] px-4 py-2 text-sm font-bold text-white disabled:cursor-wait disabled:opacity-60"
        >
          {busy ? request.busyLabel : error ? "Try again" : request.confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
