import Link from "next/link";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { fetchLemmas } from "@/lib/server/lemmas";
import { understanding, type FsrsCardJson } from "@/lib/engine";
import WordList, { type WordRow } from "./word-list";

export default function KosakataPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <div className="flex items-center justify-between text-sm opacity-70">
        <Link href="/">← Beranda</Link>
        <Link href="/kuis" className="rounded-lg bg-emerald-700 px-3 py-1 text-white opacity-100">
          Kuis latihan
        </Link>
      </div>
      <h1 className="text-xl font-semibold">Kosakata dipelajari</h1>
      <Suspense fallback={<p className="text-sm opacity-60">Memuat daftar kata...</p>}>
        <Words />
      </Suspense>
    </main>
  );
}

async function Words() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const { data } = await supabase
    .from("user_items")
    .select("level,status,fsrs,due_at,items!inner(kind,ref_id)")
    .eq("user_id", auth.user!.id)
    .eq("items.kind", "lemma");

  type Row = {
    level: number;
    status: string;
    fsrs: FsrsCardJson;
    due_at: string;
    items: { ref_id: number } | { ref_id: number }[];
  };
  const rows = ((data ?? []) as unknown as Row[]).map((r) => ({
    ...r,
    refId: Number((Array.isArray(r.items) ? r.items[0] : r.items).ref_id),
  }));
  const lemmas = await fetchLemmas(supabase, rows.map((r) => r.refId));

  const words: WordRow[] = rows
    .map((r) => {
      const l = lemmas.get(r.refId);
      if (!l) return null;
      return {
        id: l.id,
        arab: l.lemma_ar,
        gloss: l.gloss_id ?? "",
        pos: l.pos,
        root: l.root_ar,
        freq: l.freq,
        level: r.level,
        status: r.status,
        percent: Math.round(understanding(r.level, r.fsrs.stability)),
        dueAt: r.due_at,
        seen: (r.fsrs.reps ?? 0) > 0,
      } satisfies WordRow;
    })
    .filter((w): w is WordRow => w !== null);

  return <WordList words={words} />;
}
