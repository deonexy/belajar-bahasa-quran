# TASKS

Pelacak kerja (sumber kebenaran: SPEC bagian 11). Perbarui setiap task selesai.

## M0 Fondasi
- [x] Next.js + TypeScript strict, Tailwind, Vitest
- [x] Proyek Supabase `belajar-bahasa-quran` (ap-southeast-1)
- [ ] Auth magic link + proteksi route
- [x] GitHub Actions: lint, typecheck, test, build
- [ ] Deploy Vercel (production + preview)

## M1 Korpus
- [x] Migrasi tabel konten + pengguna + RLS (`supabase/migrations`)
- [x] Parser korpus + validasi (`supabase/functions/import-corpus/parse.ts`)
- [x] Edge Function impor `import-corpus` (idempoten)
- [x] 3 pelajaran contoh Q1 (`supabase/seed/lessons.sql`)
- [ ] Verifikasi hasil impor (jumlah kata/ayat/lemma, gloss)

## M2 Engine & sesi MVP
- [x] `lib/engine` lengkap + unit test
- [ ] Rencana harian (`daily-plan`) + fallback saat aplikasi dibuka
- [ ] Layar `/belajar` (review, kartu baru, latihan recognize/recall/context)
- [ ] Beranda: kuota + alasan

## Berikutnya
- [ ] M3 Eksplorasi: pembaca ayat, kosakata, pelajaran, streak
- [ ] M4 Pengingat: Web Push, Telegram, pg_cron
- [ ] M5 Statistik & offline (PWA)
- [ ] Tinjau gloss lemma (`content/glosses_id.tsv`, kolom reviewed) dan lanjutkan ke 700 lemma
