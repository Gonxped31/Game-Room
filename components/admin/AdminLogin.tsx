"use client";

import { useState, type FormEvent } from "react";
import Button from "@/components/Button";

/** The password box for /admin. Calls `onSignedIn` once the server has set the admin cookie. */
export default function AdminLogin({ onSignedIn }: { onSignedIn: () => void }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (response.ok) {
        setPassword("");
        onSignedIn();
        return;
      }
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Couldn't sign in.");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="flex flex-col">
      <label htmlFor="admin-password" className="text-sm font-bold">
        Admin password
      </label>
      <input
        id="admin-password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        className="mt-1.5 rounded-xl border-2 border-black/20 bg-white px-3 py-2.5 text-base text-black outline-none focus:border-[#0F7983]"
      />
      {error && (
        <p role="alert" className="m-0 mt-2 text-sm font-bold text-[#B3123F]">
          {error}
        </p>
      )}
      <Button type="submit" disabled={busy || !password}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
