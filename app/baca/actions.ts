"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { newCard } from "@/lib/engine";

/** Menambahkan lemma ke daftar belajar (item baru, level 0). Idempoten. */
export async function addLemmaToReview(lemmaId: number): Promise<{ ok: boolean }> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };
  const { data: item } = await supabase
    .from("items")
    .select("id")
    .eq("kind", "lemma")
    .eq("ref_id", lemmaId)
    .maybeSingle();
  if (!item) return { ok: false };
  const card = newCard(new Date());
  const { error } = await supabase.from("user_items").upsert(
    {
      user_id: auth.user.id,
      item_id: item.id,
      status: "learning",
      level: 0,
      fsrs: card,
      due_at: card.due,
      priority: true,
    },
    { onConflict: "user_id,item_id", ignoreDuplicates: true },
  );
  if (error) return { ok: false };
  revalidatePath("/baca", "layout");
  return { ok: true };
}
