"use client";

import { useEffect, useId, useRef, useState } from "react";

export interface ConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  /** Ask for the admin password too; the server checks it. */
  password?: boolean;
  /** Does the work (given the password typed, if asked); resolves to an error message to show, or null once done. */
  run: (password: string) => Promise<string | null>;
}

/**
 * The dashboard's own confirm box, in place of the browser's confirm() and
 * alert(), which show the site's address and dim the whole window. A modal
 * <dialog> that opens on Cancel (the safe choice), or on the password field
 * when it asks for one; Escape backs out too, except while the work runs. A
 * failure (a wrong password included) shows in the box, with a retry.
 */
export default function ConfirmDialog({ request, onFinish }: { request: ConfirmRequest; onFinish: (done: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    const failure = await request.run(password).catch(() => "Something went wrong.");
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
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void confirm();
        }}
      >
        <h2 id={titleId} className="m-0 text-lg font-bold">
          {request.title}
        </h2>
        <p className="m-0 mt-2 text-sm leading-relaxed text-black/75">{request.message}</p>
        {request.password && (
          <label className="mt-4 flex flex-col gap-1 text-xs font-semibold text-black/60">
            Admin password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
              // text-base on phones: iOS Safari zooms into any field under 16px when it's focused.
              className="w-full rounded-lg border border-black/25 bg-white px-2.5 py-2 text-base font-normal text-black min-[760px]:text-sm"
            />
          </label>
        )}
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
            type="submit"
            disabled={busy || (request.password && !password)}
            className="cursor-pointer rounded-lg border-2 border-[#B3123F] bg-[#B3123F] px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? request.busyLabel : error ? "Try again" : request.confirmLabel}
          </button>
        </div>
      </form>
    </dialog>
  );
}
