import Link from "next/link";
import PolaQuiz from "./quiz";

export default function PolaPage() {
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <Link href="/" className="text-sm opacity-70">← Beranda</Link>
      <h1 className="text-xl font-semibold">Kuis pola kata</h1>
      <p className="text-sm opacity-70">
        Kenali bentuk kata dari ayat Al-Qur&apos;an: madhi, mudhari&apos;, amr, isim fa&apos;il, isim maf&apos;ul, atau mashdar.
        Soal diambil acak dari data morfologi korpus (latihan bebas, tidak memengaruhi gerbang).
      </p>
      <PolaQuiz />
    </main>
  );
}
