import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { understanding, type FsrsCardJson } from "@/lib/engine";
import { LESSON_KIND_LABEL } from "@/lib/lesson-labels";

export default function PelajaranPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between text-sm opacity-70">
        <Link href="/">← Beranda</Link>
        <Link href="/pola" className="rounded-lg bg-emerald-700 px-3 py-1 text-white opacity-100">
          Kuis pola
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Pelajaran nahwu &amp; sharaf</h1>
      <Suspense fallback={<p className="text-sm opacity-60">Memuat pelajaran...</p>}>
        <Lessons />
      </Suspense>
    </main>
  );
}

type Row = {
  level: number;
  ever_reached_one: boolean;
  fsrs: FsrsCardJson;
  items: { ref_id: number; seq: number } | { ref_id: number; seq: number }[];
};

async function Lessons() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const [{ data }, { count: total }] = await Promise.all([
    supabase
      .from("user_items")
      .select("level,ever_reached_one,fsrs,items!inner(kind,ref_id,seq)")
      .eq("user_id", auth.user!.id)
      .eq("items.kind", "lesson"),
    supabase.from("lessons").select("id", { count: "exact", head: true }),
  ]);

  const rows = ((data ?? []) as unknown as Row[])
    .map((r) => {
      const it = Array.isArray(r.items) ? r.items[0] : r.items;
      return { ...r, refId: Number(it.ref_id), seq: it.seq };
    })
    .sort((a, b) => a.seq - b.seq);

  const { data: lessons } = rows.length
    ? await supabase
        .from("lessons")
        .select("id,code,kind,title")
        .in("id", rows.map((r) => r.refId))
    : { data: [] };

  const list = rows
    .map((r) => {
      const l = (lessons ?? []).find((x) => x.id === r.refId);
      if (!l) return null;
      return {
        code: l.code,
        kind: l.kind,
        title: l.title,
        passed: r.ever_reached_one,
        percent: Math.round(understanding(r.level, r.fsrs.stability)),
      };
    })
    .filter((l): l is NonNullable<typeof l> => l !== null);

  if (list.length === 0) {
    return (
      <div className="rounded-2xl border border-current/15 p-5 text-sm">
        <p>Belum ada pelajaran yang dibuka.</p>
        <Link
          href="/belajar"
          className="mt-3 inline-block rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white"
        >
          Mulai belajar
        </Link>
      </div>
    );
  }

  return (
    <>
      <p className="text-sm opacity-70">
        {list.length} dari {total ?? list.length} pelajaran sudah dibuka
      </p>
      <ul className="flex flex-col gap-2">
        {list.map((l) => (
          <li key={l.code}>
            <Link
              href={`/pelajaran/${l.code}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-current/15 p-4 active:bg-emerald-700/10"
            >
              <span className="flex flex-col gap-1">
                <span className="font-medium">{l.title}</span>
                <span className="text-xs opacity-60">{LESSON_KIND_LABEL[l.kind] ?? l.kind}</span>
              </span>
              <span
                className={`shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${
                  l.passed ? "bg-emerald-700/15 text-emerald-700 dark:text-emerald-300" : "bg-black/10 dark:bg-white/15"
                }`}
              >
                {l.passed ? `${l.percent}%` : "Baru"}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
