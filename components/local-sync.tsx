"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { getDb, localStorageAvailable, wipeUserData } from "@/lib/local/db";
import { runSync, warmOffline } from "@/lib/local/runtime";

/**
 * Menjaga salinan lokal tetap segar tanpa bertanya: sinkron di awal sesi, saat kembali online,
 * saat tab aktif lagi, dan setelah login. Data pengguna lokal dihapus saat keluar.
 */
export default function LocalSync() {
  useEffect(() => {
    if (!localStorageAvailable()) return;
    const supabase = createClient();
    let warmed = false;
    const sync = (force = false) =>
      void runSync(force).then((r) => {
        if (r?.ok && !warmed) {
          warmed = true;
          void warmOffline();
        }
      });

    sync();
    const onOnline = () => sync(true);
    const onVisible = () => {
      if (document.visibilityState === "visible") sync();
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    // Jangan memanggil metode auth langsung di dalam callback ini (bisa buntu): tunda satu tick.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") setTimeout(() => sync(), 0);
      if (event === "SIGNED_OUT") setTimeout(() => void wipeUserData(getDb()), 0);
    });

    return () => {
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
      data.subscription.unsubscribe();
    };
  }, []);
  return null;
}
