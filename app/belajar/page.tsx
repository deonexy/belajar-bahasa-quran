import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { ensureDailyPlan, getSettings } from "@/lib/server/daily";
import { buildSession } from "@/lib/server/session";
import Session from "./session";


export default function BelajarPage() {
  return (
    <Suspense fallback={<p className="p-8 text-sm opacity-60">Menyiapkan sesi...</p>}>
      <SessionLoader />
    </Suspense>
  );
}

async function SessionLoader() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user!;
  const settings = await getSettings(supabase, user.id);
  await ensureDailyPlan(supabase, user.id, settings);
  const cards = await buildSession(supabase, user.id);
  return <Session cards={cards} />;
}
