"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Mode = "login" | "register";

const MESSAGES: [RegExp, string][] = [
  [/invalid login credentials/i, "Email atau kata sandi salah."],
  [/email not confirmed/i, "Email belum dikonfirmasi. Cek kotak masuk Anda."],
  [/already registered|already been registered/i, "Email ini sudah terdaftar. Silakan masuk."],
  [/password should be at least/i, "Kata sandi minimal 8 karakter."],
  [/rate limit/i, "Terlalu banyak percobaan. Coba lagi beberapa menit lagi."],
  [/signups not allowed|signup is disabled/i, "Pendaftaran sedang ditutup."],
];

function friendly(message: string): string {
  return MESSAGES.find(([re]) => re.test(message))?.[1] ?? message;
}

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const isLogin = mode === "login";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!isLogin && password !== confirm) {
      setError("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    const supabase = createClient();

    if (isLogin) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) return setError(friendly(error.message));
      router.replace("/");
      router.refresh();
      return;
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (error) return setError(friendly(error.message));
    // Email yang sudah terdaftar: Supabase mengembalikan user tanpa identitas.
    if (data.user && data.user.identities?.length === 0) {
      return setError("Email ini sudah terdaftar. Silakan masuk.");
    }
    if (data.session) {
      router.replace("/");
      router.refresh();
    } else {
      setCheckEmail(true);
    }
  }

  async function google() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(friendly(error.message));
  }

  if (checkEmail) {
    return (
      <Frame title="Cek email Anda">
        <p className="rounded-lg border border-emerald-600/40 p-4 text-sm">
          Tautan konfirmasi sudah dikirim ke <b>{email}</b>. Buka email, ketuk tautannya, lalu Anda
          akan langsung masuk.
        </p>
        <Link href="/login" className="text-sm underline">Kembali ke halaman masuk</Link>
      </Frame>
    );
  }

  const input = "rounded-lg border border-current/30 bg-transparent px-3 py-2";
  return (
    <Frame title={isLogin ? "Masuk" : "Daftar akun"}>
      <button
        type="button"
        onClick={google}
        className="flex items-center justify-center gap-2 rounded-lg border border-current/30 px-3 py-2 font-medium"
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
          <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
          <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.4-4.7 7l7.3 5.7c4.3-4 7.1-9.9 7.1-17.2z" />
          <path fill="#FBBC05" d="M10.5 28.7a14.5 14.5 0 0 1 0-9.4l-7.9-6.1a24 24 0 0 0 0 21.6l7.9-6.1z" />
          <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.3-5.7c-2 1.4-4.7 2.3-8.6 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
        </svg>
        Lanjutkan dengan Google
      </button>

      <div className="flex items-center gap-3 text-xs opacity-50">
        <span className="h-px flex-1 bg-current" /> atau <span className="h-px flex-1 bg-current" />
      </div>

      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          className={input}
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete={isLogin ? "current-password" : "new-password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={isLogin ? "Kata sandi" : "Kata sandi (min. 8 karakter)"}
          className={input}
        />
        {!isLogin && (
          <input
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Ulangi kata sandi"
            className={input}
          />
        )}
        <button
          disabled={busy}
          className="rounded-lg bg-emerald-700 px-3 py-2 font-medium text-white disabled:opacity-60"
        >
          {busy ? "Memproses..." : isLogin ? "Masuk" : "Daftar"}
        </button>
        {error && <p className="text-sm text-red-500">{error}</p>}
      </form>

      <p className="text-sm opacity-80">
        {isLogin ? (
          <>Belum punya akun? <Link href="/register" className="underline">Daftar</Link></>
        ) : (
          <>Sudah punya akun? <Link href="/login" className="underline">Masuk</Link></>
        )}
      </p>
    </Frame>
  );
}

function Frame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-5 px-6">
      <div>
        <h1 className="text-2xl font-semibold">Belajar Bahasa Al-Qur&apos;an</h1>
        <p className="mt-1 text-sm opacity-70">{title}</p>
      </div>
      {children}
    </main>
  );
}
