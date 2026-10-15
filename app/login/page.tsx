"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        // Aplikasi pribadi: hanya akun yang sudah ada yang boleh masuk.
        shouldCreateUser: false,
      },
    });
    if (error) {
      setState("error");
      setMsg(error.message);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Belajar Bahasa Al-Qur&apos;an</h1>
        <p className="mt-1 text-sm opacity-70">Masuk dengan tautan yang dikirim ke email.</p>
      </div>
      {state === "sent" ? (
        <p className="rounded-lg border border-emerald-600/40 p-4 text-sm">
          Tautan masuk sudah dikirim ke <b>{email}</b>. Buka email dan ketuk tautannya.
        </p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email@contoh.com"
            className="rounded-lg border border-current/30 bg-transparent px-3 py-2"
          />
          <button
            disabled={state === "sending"}
            className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white disabled:opacity-60"
          >
            {state === "sending" ? "Mengirim..." : "Kirim tautan masuk"}
          </button>
          {state === "error" && <p className="text-sm text-red-500">{msg}</p>}
        </form>
      )}
    </main>
  );
}
