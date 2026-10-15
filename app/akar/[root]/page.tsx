import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default function AkarPage(props: PageProps<"/akar/[root]">) {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <Link href="/baca" className="text-sm opacity-70">← Baca</Link>
      <Suspense fallback={<p className="text-sm opacity-60">Memuat akar...</p>}>
        <Content {...props} />
      </Suspense>
    </main>
  );
}

async function Content({ params }: PageProps<"/akar/[root]">) {
  const { root } = await params;
  const rootAr = decodeURIComponent(root);
  const supabase = await createClient();
  const { data: r } = await supabase.from("roots").select("id,root_ar,meaning_core").eq("root_ar", rootAr).maybeSingle();
  if (!r) notFound();
  const { data: lemmas } = await supabase
    .from("lemmas")
    .select("id,lemma_ar,pos,gloss_id,freq")
    .eq("root_id", r.id)
    .order("freq", { ascending: false });
  const total = (lemmas ?? []).reduce((s, l) => s + l.freq, 0);
  return (
    <>
      <h1 className="text-2xl font-semibold" lang="ar">{r.root_ar}</h1>
      {r.meaning_core && <p className="text-sm opacity-80">{r.meaning_core}</p>}
      <p className="text-sm opacity-70">
        {lemmas?.length ?? 0} lema · {total} kemunculan dalam Al-Qur&apos;an
      </p>
      <ul className="flex flex-col divide-y divide-black/10 dark:divide-white/15">
        {(lemmas ?? []).map((l) => (
          <li key={l.id} className="flex items-baseline justify-between py-2">
            <span className="text-xl" lang="ar">{l.lemma_ar}</span>
            <span className="text-sm opacity-80">
              {l.gloss_id ?? "(arti belum tersedia)"} <span className="opacity-50">· {l.pos} · {l.freq}×</span>
            </span>
          </li>
        ))}
      </ul>
    </>
  );
}
