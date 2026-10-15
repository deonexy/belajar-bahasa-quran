import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { describeMorph, type MorphPart } from "@/lib/morph-labels";
import Reader, { type ReaderAyah } from "../reader";

const PER_PAGE = 10;

export default function SurahPage(props: PageProps<"/baca/[surah]">) {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 px-5 py-6">
      <Suspense fallback={<p className="text-sm opacity-60">Memuat ayat...</p>}>
        <Content {...props} />
      </Suspense>
    </main>
  );
}

async function Content({ params, searchParams }: PageProps<"/baca/[surah]">) {
  const { surah: s } = await params;
  const sp = await searchParams;
  const surah = Number(s);
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) notFound();
  const page = Math.max(1, Number(Array.isArray(sp.hal) ? sp.hal[0] : sp.hal) || 1);
  const from = (page - 1) * PER_PAGE + 1;
  const to = from + PER_PAGE - 1;

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();

  const { data: ayahRows } = await supabase
    .from("ayahs")
    .select("ayah,translation_id")
    .eq("surah", surah)
    .gte("ayah", from)
    .lte("ayah", to)
    .order("ayah");
  if (!ayahRows || ayahRows.length === 0) notFound();

  const { data: totalRow } = await supabase
    .from("ayahs")
    .select("ayah")
    .eq("surah", surah)
    .order("ayah", { ascending: false })
    .limit(1)
    .single();
  const total = totalRow?.ayah ?? to;

  const { data: wordRows } = await supabase
    .from("words")
    .select("ayah,position,text_ar,lemma_id,gloss_id,morph,lemmas(lemma_ar,roots(root_ar))")
    .eq("surah", surah)
    .gte("ayah", from)
    .lte("ayah", to)
    .order("ayah")
    .order("position");

  const { data: ui } = await supabase
    .from("user_items")
    .select("level,items!inner(kind,ref_id)")
    .eq("user_id", auth.user!.id)
    .eq("items.kind", "lemma");
  const level = new Map<number, number>();
  for (const r of (ui ?? []) as unknown as { level: number; items: { ref_id: number } | { ref_id: number }[] }[]) {
    const it = Array.isArray(r.items) ? r.items[0] : r.items;
    level.set(Number(it.ref_id), r.level);
  }

  type WRow = {
    ayah: number;
    position: number;
    text_ar: string;
    lemma_id: number | null;
    gloss_id: string | null;
    morph: MorphPart[];
    lemmas: { lemma_ar: string; roots: { root_ar: string } | { root_ar: string }[] | null } | { lemma_ar: string; roots: { root_ar: string } | { root_ar: string }[] | null }[] | null;
  };
  const byAyah = new Map<number, ReaderAyah["words"]>();
  for (const w of (wordRows ?? []) as unknown as WRow[]) {
    const lem = Array.isArray(w.lemmas) ? w.lemmas[0] : w.lemmas;
    const root = lem ? (Array.isArray(lem.roots) ? lem.roots[0] : lem.roots) : null;
    const list = byAyah.get(w.ayah) ?? [];
    list.push({
      text: w.text_ar,
      gloss: w.gloss_id,
      lemmaId: w.lemma_id,
      lemmaAr: lem?.lemma_ar ?? null,
      rootAr: root?.root_ar ?? null,
      level: w.lemma_id != null && level.has(w.lemma_id) ? level.get(w.lemma_id)! : null,
      features: describeMorph(w.morph ?? []),
    });
    byAyah.set(w.ayah, list);
  }
  const ayahs: ReaderAyah[] = ayahRows.map((a) => ({
    ayah: a.ayah,
    translation: a.translation_id,
    words: byAyah.get(a.ayah) ?? [],
  }));

  const pages = Math.ceil(total / PER_PAGE);
  return (
    <>
      <div className="flex items-center justify-between text-sm opacity-70">
        <Link href="/baca">← Daftar surah</Link>
        <span>Surah {surah} · ayat {from}–{Math.min(to, total)} dari {total}</span>
      </div>
      <Reader surah={surah} ayahs={ayahs} />
      <div className="flex justify-between text-sm">
        {page > 1 ? <Link href={`/baca/${surah}?hal=${page - 1}`}>← Sebelumnya</Link> : <span />}
        {page < pages ? <Link href={`/baca/${surah}?hal=${page + 1}`}>Berikutnya →</Link> : <span />}
      </div>
    </>
  );
}
