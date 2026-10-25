"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import AdminDashboard from "@/components/admin/AdminDashboard";
import AdminLogin from "@/components/admin/AdminLogin";
import Button from "@/components/Button";
import type { AdminSessionResponse } from "@/lib/admin/types";
import { APP_TITLE } from "@/lib/games/registry";

const HUB_TABLE = "#0F7983";

type View = { kind: "loading" } | { kind: "error" } | ({ kind: "session" } & AdminSessionResponse);

async function fetchSession(): Promise<View> {
  try {
    const response = await fetch("/api/admin/session", { cache: "no-store" });
    if (!response.ok) return { kind: "error" };
    return { kind: "session", ...((await response.json()) as AdminSessionResponse) };
  } catch {
    return { kind: "error" };
  }
}

/**
 * The owner's dashboard. Everything privileged happens in /api/admin/*
 * (firebase-admin behind a password cookie); this page only calls those
 * routes. Not linked from the hub.
 */
export default function AdminPage() {
  const [view, setView] = useState<View>({ kind: "loading" });

  // State is set from the fetch's .then(), never synchronously in the effect body.
  const refresh = useCallback(() => void fetchSession().then(setView), []);
  useEffect(refresh, [refresh]);

  const logOut = async () => {
    await fetch("/api/admin/logout", { method: "POST" }).catch(() => {});
    refresh();
  };

  if (view.kind === "session" && view.signedIn) {
    return (
      <Shell wide>
        <header className="flex items-center justify-between gap-3">
          <h1 className="m-0 text-2xl font-bold text-white">{APP_TITLE} admin</h1>
          <Button variant="sm" className="mt-0 mr-0" onClick={() => void logOut()}>
            Log out
          </Button>
        </header>
        {view.database?.ok ? (
          <AdminDashboard onSignedOut={refresh} />
        ) : (
          <Card>
            <p role="alert" className="m-0 font-bold text-[#B3123F]">
              {view.database?.error ?? "Database not checked."}
            </p>
          </Card>
        )}
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="m-0 text-center text-2xl font-bold text-white">{APP_TITLE} admin</h1>
      <Card>
        {view.kind === "loading" ? (
          <p className="m-0">Loading…</p>
        ) : view.kind === "error" ? (
          <p role="alert" className="m-0 font-bold">
            Couldn&apos;t reach the server. Reload to try again.
          </p>
        ) : !view.enabled ? (
          <p className="m-0">Admin is turned off here. Set ADMIN_PASSWORD to turn it on.</p>
        ) : (
          <AdminLogin onSignedIn={refresh} />
        )}
      </Card>
    </Shell>
  );
}

function Shell({ wide, children }: { wide?: boolean; children: ReactNode }) {
  return (
    <div className="min-h-screen px-4 py-8 text-black" style={{ backgroundColor: HUB_TABLE }}>
      <main className={`mx-auto flex flex-col gap-4 ${wide ? "max-w-[1040px]" : "max-w-[420px]"}`}>{children}</main>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return <section className="rounded-2xl bg-white p-5 shadow-[0_4px_0_rgba(0,0,0,.25)]">{children}</section>;
}
