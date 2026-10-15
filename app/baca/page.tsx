import Link from "next/link";

export default function BacaIndex() {
  const surahs = Array.from({ length: 114 }, (_, i) => i + 1);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-5 py-6">
      <Link href="/" className="text-sm opacity-70">← Beranda</Link>
      <h1 className="text-xl font-semibold">Baca Al-Qur&apos;an</h1>
      <p className="text-sm opacity-70">
        Pilih surah. Setiap kata diberi arti dan diwarnai menurut tingkat penguasaanmu.
      </p>
      <div className="grid grid-cols-6 gap-2">
        {surahs.map((n) => (
          <Link key={n} href={`/baca/${n}`} className="rounded-lg border border-black/10 py-2 text-center text-sm dark:border-white/20">
            {n}
          </Link>
        ))}
      </div>
    </main>
  );
}
