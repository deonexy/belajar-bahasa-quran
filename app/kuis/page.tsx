import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { buildQuiz } from "@/lib/server/session";
import Session from "../belajar/session";

export default function KuisPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm opacity-60">Menyusun kuis...</p>}>
      <QuizLoader />
    </Suspense>
  );
}

// Soal dibangun ulang pada setiap permintaan, jadi tiap kuis berbeda.
async function QuizLoader() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const cards = await buildQuiz(supabase, auth.user!.id, 10);
  // key unik agar komponen mulai dari awal setiap kuis baru dimuat.
  return <Session key={crypto.randomUUID()} cards={cards} mode="kuis" />;
}
