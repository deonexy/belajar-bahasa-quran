import Link from "next/link";
import LocalSummary from "@/components/local-summary";

export default function OfflinePage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-center gap-4 px-5 py-20 text-center">
      <h1 className="text-xl font-semibold">Sedang offline</h1>
      <p className="text-sm opacity-70">Belajar tetap bisa dari data yang tersimpan di perangkat ini.</p>
      <LocalSummary />
      <div className="flex gap-3">
        <Link href="/belajar" className="rounded-xl bg-emerald-700 px-5 py-2.5 font-medium text-white">
          Belajar
        </Link>
        <Link href="/kuis" className="rounded-xl border border-current/25 px-5 py-2.5 font-medium">
          Kuis
        </Link>
      </div>
      <p className="text-xs opacity-60">Sambungkan internet untuk mengirim jawaban dan memuat materi baru.</p>
    </main>
  );
}
