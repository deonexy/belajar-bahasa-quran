# TASKS

Pelacak kerja. Konteks lengkap: `docs/PROJECT_CONTEXT.md`. Perbarui setiap task selesai.

## M0 Fondasi
- [x] Next.js + TypeScript strict, Tailwind, Vitest
- [x] Proyek Supabase `belajar-bahasa-quran` (ap-southeast-1)
- [x] Auth email/sandi + Google + register, proteksi route (`proxy.ts`)
- [x] GitHub Actions: lint, typecheck, test, build
- [x] Deploy Vercel (auto-deploy dari `main`)

## M1 Korpus
- [x] Migrasi tabel konten + pengguna + RLS (`supabase/migrations`)
- [x] Parser korpus + validasi (`supabase/functions/import-corpus/parse.ts`)
- [x] Edge Function impor `import-corpus` (idempoten)
- [x] 3 pelajaran contoh Q1 (`supabase/seed/lessons.sql`)
- [x] Verifikasi hasil impor (77.429 kata, 4.815 lemma, 6.236 ayat, 320 gloss)

## M2 Engine & sesi MVP
- [x] `lib/engine` lengkap + unit test
- [x] Rencana harian + mastery gate (dijalankan saat beranda/sesi dibuka)
- [x] Layar `/belajar` (review, kartu baru, latihan recognize/recall/context, pelajaran, terjemah ayat)
- [x] Beranda: kuota + alasan, streak, cakupan, pemahaman
- [x] `/kosakata` (persen pemahaman per kata) dan `/kuis` (kuis dinamis)
- [x] Tombol salin ayat dan arti pada contoh kata
- [x] Uji end-to-end dengan akun asli (pemilik sudah memakai: 14 review)

## M3 Penyelarasan dengan `docs/SPEC_FASE1.md` (menunggu keputusan pemilik, lihat PROJECT_CONTEXT bagian 9)
- [x] Putuskan rumus gerbang F2 dan definisi "dikuasai" (PROJECT_CONTEXT bagian 9)
- [ ] RLS `review_logs` append-only: file siap di `supabase/pending/`, menunggu persetujuan pemilik
- [x] Tabel `data_source`, snapshot harian (`daily_stats` + `pg_cron`), target di `user_settings`
- [x] Dashboard target dan proyeksi (`/dashboard`)

## Berikutnya
- [ ] F5 pembaca ayat interlinear (butuh arti kata penuh)
- [ ] F3 halaman akar + kuis pola; F4 unit nahwu-sharaf
- [ ] F6 tes ayat dengan AI (butuh API key LLM di secret Edge Function)
- [ ] M4 Pengingat: Web Push, Telegram, pg_cron
- [ ] M5 Statistik & offline (PWA)
- [ ] Tinjau gloss lemma (`content/glosses_id.tsv`, kolom reviewed) dan lanjutkan ke 700 lemma (676 lemma = 85% token)
