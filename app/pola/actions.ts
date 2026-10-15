"use server";

import { createClient } from "@/lib/supabase/server";

export interface PolaQuestion {
  word: string;
  gloss: string | null;
  ref: string;
  options: string[];
  answer: number;
}

/** Kategori pola yang bisa diturunkan dari fitur morfologi QAC. */
const CATEGORIES: { feature: string; label: string; hint: string }[] = [
  { feature: "PERF", label: "fi'il madhi", hint: "kata kerja lampau" },
  { feature: "IMPF", label: "fi'il mudhari'", hint: "kata kerja sekarang/akan" },
  { feature: "IMPV", label: "fi'il amr", hint: "kata kerja perintah" },
  { feature: "ACT_PCPL", label: "isim fa'il", hint: "pelaku" },
  { feature: "PASS_PCPL", label: "isim maf'ul", hint: "yang dikenai perbuatan" },
  { feature: "VN", label: "mashdar", hint: "kata benda dari kata kerja" },
];

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [r[i], r[j]] = [r[j], r[i]];
  }
  return r;
}

export async function generatePolaQuiz(count = 10): Promise<PolaQuestion[]> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];

  const { data: top } = await supabase.from("words").select("id").order("id", { ascending: false }).limit(1).single();
  const maxId = Number(top?.id ?? 1);
  const seen = new Set<number>();
  const out: PolaQuestion[] = [];

  for (let n = 0; n < count; n++) {
    const cat = CATEGORIES[n % CATEGORIES.length];
    const pick = async (from: number) =>
      supabase
        .from("words")
        .select("id,surah,ayah,text_ar,gloss_id")
        .contains("morph", [{ features: [cat.feature] }])
        .gte("id", from)
        .order("id")
        .limit(1)
        .maybeSingle();
    let { data: w } = await pick(1 + Math.floor(Math.random() * maxId));
    if (!w || seen.has(Number(w.id))) ({ data: w } = await pick(1 + Math.floor(Math.random() * maxId)));
    if (!w || seen.has(Number(w.id))) continue;
    seen.add(Number(w.id));
    const others = shuffle(CATEGORIES.filter((c) => c.feature !== cat.feature)).slice(0, 3);
    const options = shuffle([cat, ...others]).map((c) => c.label);
    out.push({
      word: w.text_ar,
      gloss: w.gloss_id,
      ref: `${w.surah}:${w.ayah}`,
      options,
      answer: options.indexOf(cat.label),
    });
  }
  return shuffle(out);
}
