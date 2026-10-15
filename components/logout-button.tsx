"use client";

import { useTransition } from "react";
import { signOut } from "@/app/actions";
import { getDb, localStorageAvailable, wipeUserData } from "@/lib/local/db";
import { pendingCount } from "@/lib/local/outbox";
import { flushNow } from "@/lib/local/runtime";

/** Keluar: kirim dulu jawaban yang tertunda, lalu hapus data pengguna lokal. */
export default function LogoutButton() {
  const [pending, start] = useTransition();

  function logout() {
    start(async () => {
      if (localStorageAvailable()) {
        const db = getDb();
        await flushNow();
        const left = await pendingCount(db);
        if (
          left > 0 &&
          !window.confirm(
            `Ada ${left} jawaban yang belum terkirim ke server dan akan hilang bila Anda keluar sekarang. Tetap keluar?`,
          )
        ) {
          return;
        }
        await wipeUserData(db);
      }
      await signOut();
    });
  }

  return (
    <button onClick={logout} disabled={pending} className="text-sm underline opacity-60 disabled:opacity-40">
      Keluar
    </button>
  );
}
