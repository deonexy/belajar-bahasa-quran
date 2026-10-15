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

## M3 Penyelarasan dengan `docs/SPEC_FASE1.md` (keputusan: PROJECT_CONTEXT bagian 9)
Rincian paket kerja P1–P5: `docs/SPEC_FASE1.md` bagian "Urutan implementasi".
- [x] Putuskan rumus gerbang F2 dan definisi "dikuasai" (PROJECT_CONTEXT bagian 9)
- [ ] **PENDING (ditunda pemilik, 2026-10-16)** RLS `review_logs` append-only. Pemilik belum paham kegunaannya dan baru bisa akses Supabase siang hari. Jangan diterapkan tanpa konfirmasi baru dari pemilik.
  - Kegunaan: saat ini pengguna secara teknis bisa mengubah/menghapus riwayat review miliknya sendiri lewat API. Perubahan ini membatasinya hanya baca + tambah, supaya data riwayat (dasar streak, retensi, laporan) tidak bisa rusak atau terhapus tidak sengaja. Aplikasi tidak berubah perilakunya. Risiko tanpa perubahan: rendah (hanya satu pengguna).
  - File siap: `supabase/pending/20261015000007_review_logs_append_only.sql` (6 baris; menghapus policy `own_rows`, menambah `own_select` dan `own_insert`).
  - Kendala: alat Supabase di sesi agen membatalkan otomatis perintah `drop policy`. Cara: pemilik menempelkan file itu di Supabase SQL Editor, atau agen memakai alternatif `revoke update, delete on review_logs from authenticated` setelah pemilik setuju.
  - Setelah diterapkan: pindahkan file ke `supabase/migrations/` dan centang butir ini.
- [x] Tabel `data_source`, snapshot harian (`daily_stats` + `pg_cron`), target di `user_settings`
- [x] Dashboard target dan proyeksi (`/dashboard`)

## Berikutnya
- [x] F5 pembaca ayat interlinear (`/baca`)
- [x] F3 halaman akar + kuis pola (versi awal); F4 8 unit nahwu-sharaf
- [ ] Pemilik: tinjau isi 8 pelajaran nahwu-sharaf (`supabase/seed/lessons_nahwu_sharaf.sql`)
- [ ] F6 tes ayat dengan AI (butuh API key LLM di secret Edge Function)
- [ ] M4 Pengingat: Web Push, Telegram, pg_cron
- [x] PWA dasar: manifest, ikon, service worker, halaman offline
- [ ] M5 Statistik & offline penuh (sesi belajar tanpa internet)
- [x] Draf arti lemma sampai peringkat 700 (≈85% token)
- [ ] Pemilik: tinjau gloss (`content/glosses_id.tsv`, `content/glosses_id_321_700.tsv`, kolom reviewed)
