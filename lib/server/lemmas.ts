import type { SupabaseClient } from "@supabase/supabase-js";

export interface LemmaInfo {
  id: number;
  lemma_ar: string;
  pos: string;
  gloss_id: string | null;
  freq: number;
  freq_rank: number | null;
  root_ar: string | null;
}

/** Mengambil lemma per potongan agar URL permintaan tidak terlalu panjang. */
export async function fetchLemmas(
  supabase: SupabaseClient,
  ids: number[],
  chunk = 150,
): Promise<Map<number, LemmaInfo>> {
  const out = new Map<number, LemmaInfo>();
  for (let i = 0; i < ids.length; i += chunk) {
    const { data } = await supabase
      .from("lemmas")
      .select("id,lemma_ar,pos,gloss_id,freq,freq_rank,roots(root_ar)")
      .in("id", ids.slice(i, i + chunk));
    for (const l of (data ?? []) as Record<string, any>[]) { // eslint-disable-line @typescript-eslint/no-explicit-any
      const root = Array.isArray(l.roots) ? l.roots[0] : l.roots;
      out.set(l.id, {
        id: l.id,
        lemma_ar: l.lemma_ar,
        pos: l.pos,
        gloss_id: l.gloss_id,
        freq: l.freq,
        freq_rank: l.freq_rank,
        root_ar: root?.root_ar ?? null,
      });
    }
  }
  return out;
}
