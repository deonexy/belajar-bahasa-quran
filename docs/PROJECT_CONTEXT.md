# PROJECT_CONTEXT: dokumen hidup lintas sesi

Dokumen ini adalah **sumber konteks utama** untuk setiap sesi dan sub agent (model apa pun) yang bekerja di repo ini. Pemilik sering berpindah sesi dan model, jadi apa pun yang penting harus tertulis di sini, bukan hanya di percakapan.

**Aturan pakai (wajib):**
1. Awal sesi: baca file ini sampai habis, lalu `TASKS.md`, `docs/DECISIONS.md`, dan spec yang relevan.
2. Selama kerja: bila membuat keputusan, menemukan jebakan, atau mengubah status, perbarui file ini **dalam PR yang sama** dengan perubahan kodenya.
3. Akhir sesi: tambahkan satu entri di "Log sesi" (paling baru di atas) dan perbarui "Status saat ini" serta "Langkah berikutnya".
4. Jangan menulis rahasia (kunci API, kata sandi, token) di repo. Hanya nama variabel dan lokasi penyimpanannya.
5. Tulis fakta yang sudah diverifikasi. Tandai dugaan dengan "(belum diverifikasi)".
6. Bahasa dokumen: Indonesia. Kode dan identifier: sesuai konvensi yang ada.

Pemilik: Deka (System Architect). Komunikasi dengan pemilik memakai bahasa Indonesia.

---

## 1. Tujuan produk

Aplikasi web untuk belajar bahasa Arab Al-Qur'an selama 4 tahun:
- **Fase 1 (24 bulan):** memahami kata dan kalimat Al-Qur'an.
- **Fase 2 (12 bulan):** memahami teks Arab di literatur lain.
- **Fase 3 (12 bulan):** memahami percakapan dan berbicara sederhana.

Fitur inti: konten bertambah bertahap lewat **mastery gate** (materi baru hanya terbuka bila pemahaman terbukti), pengingat, streak, laporan perkembangan, ukuran tingkat pemahaman, jumlah kosakata dipahami, dan **% token Al-Qur'an yang dipahami**.

## 2. Infrastruktur dan alamat

| Komponen | Nilai |
| --- | --- |
| Repo | `github.com/deonexy/belajar-bahasa-quran` (branch utama `main`) |
| Produksi | `https://belajar-bahasa-quran.vercel.app` (Vercel, akun pribadi, auto-deploy dari `main`) |
| Supabase project id | `svqgxeviulejrlfebafn` (region ap-southeast-1, paket gratis) |
| Supabase URL | `https://svqgxeviulejrlfebafn.supabase.co` |
| Env aplikasi | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (kunci publishable, aman di klien). Lokal: `.env.local` (di-gitignore). Contoh: `.env.example` |
| Rahasia | `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server/Edge Function. Jangan pernah ke klien atau repo |
| Auth | Email + kata sandi, Google OAuth, halaman `/register`. Google perlu diaktifkan pemilik di dashboard Supabase (Client ID/Secret dari Google Cloud) |

## 3. Stack dan arsitektur

- **Next.js 16** (App Router, React 19, Tailwind 4, TypeScript strict). Baca `node_modules/next/dist/docs/` sebelum menulis kode Next; lihat jebakan di bagian 7.
- **Supabase:** Postgres + RLS, Auth, Edge Functions (Deno), `pg_net`; `pg_cron` direncanakan.
- **ts-fsrs** untuk spaced repetition. **Vitest** untuk uji unit. **Dexie** terpasang (belum dipakai) untuk offline.
- CI: `.github/workflows/ci.yml` (lint, typecheck, test, build).

Struktur penting:

| Path | Isi |
| --- | --- |
| `lib/engine/` | Logika murni tanpa UI: `rating`, `fsrs`, `mastery`, `gate`, `selection`, `coverage` (+ `understanding`). Semua punya uji di `lib/engine/__tests__` |
| `lib/server/` | `daily.ts` (rencana harian + buka item baru), `session.ts` (`buildSession`, `buildQuiz`), `stats.ts` (streak, cakupan), `lemmas.ts` |
| `lib/supabase/` | klien browser dan server (`@supabase/ssr`) |
| `proxy.ts` | proteksi route + penyegar sesi (pengganti `middleware.ts` di Next 16) |
| `app/` | `/` beranda, `/belajar`, `/kuis`, `/kosakata`, `/login`, `/register`, `/auth/callback` |
| `components/auth-form.tsx` | form login/register + Google |
| `supabase/migrations/` | 0001 konten, 0002 pengguna, 0003 kunci lemma, 0004 import_log, 0005 fungsi bantu |
| `supabase/functions/import-corpus/` | parser korpus (`parse.ts` + tes), impor idempoten, `glosses.ts` |
| `supabase/seed/` | `lessons.sql`, `gloss_backfill.sql` |
| `content/glosses_id.tsv` | draf arti Indonesia 320 lemma, kolom `reviewed` masih semua `false` |
| `docs/` | `DECISIONS.md` (keputusan teknis), `SPEC_FASE1.md` (spesifikasi pembaruan), file ini |

## 4. Skema data (ringkas, sesuai yang sudah diterapkan)

- **Konten (read-only untuk klien):** `corpus_meta`, `roots`, `lemmas` (kunci unik `(lemma_ar, pos)`), `ayahs`, `words` (`morph` jsonb berisi segmen + fitur), `lessons`, `items` (`kind`: lemma/lesson/ayah/..., `ref_id`, `seq`, `prereq_item_ids`).
- **Pengguna (RLS `user_id = auth.uid()`):** `user_settings`, `user_items` (level 0-3, `fsrs` jsonb, `status`, `due_at`), `review_logs` (`client_id` unik untuk idempotensi), `daily_plans`, `daily_stats`, `push_subscriptions`, `ai_usage`. View `v_user_coverage`.
- **Fungsi RPC (security invoker):** `review_days`, `new_item_candidates`, `openable_ayah_items`.
- Data terimpor (terverifikasi): 77.429 kata, 4.815 lemma, 6.236 ayat, 1.651 akar, 11.054 item. 320 lemma punya `gloss_id` (≈75% token).
- Nama tabel berbeda dari `docs/SPEC_FASE1.md` (spec: `root/lemma/verse/token/card`). **Keputusan: tidak mengganti nama**, tambahkan tabel yang belum ada.

## 5. Logika inti (perilaku saat ini)

- **Rating:** otomatis dari jawaban pilihan ganda: salah=1; benar >10 dtk=2; 3-10 dtk=3; <3 dtk=4. Terjemah ayat: penilaian mandiri benar/sebagian/salah.
- **Level 0-3:** naik bila rating ≥3, turun bila 1 (tidak di bawah 1 setelah pernah mencapai 1). Latihan: level 0 recognize, 1 recall, 2 context, 3 acak 20/30/50.
- **Dikuasai:** level 3 dan stabilitas FSRS ≥21 hari dan tanpa lapse 30 hari.
- **Pemahaman per kata (%):** `(level/3) × min(1, stabilitas/21) × 100` (`understanding()`).
- **Mastery gate harian** (`computeQuota`): R = akurasi benar/salah 7 hari (default 0,90 bila <20 jawaban); B = backlog jatuh tempo; L = item level<2. B>100 atau R<0,8 → kuota 0; 0,8-0,85 → maks 2; 0,85-0,9 → maks 3; ≥0,9 → maks N (default 5); dikurangi `max(0, L-20)`.
- **Item baru:** hanya lemma yang punya `gloss_id` dan pelajaran; ayat terbuka otomatis bila ≥85% kata berlemma sudah dikuasai (maks 3/hari).
- **Cakupan:** jumlah `freq` lemma dikuasai / total kata Al-Qur'an (77.429).
- **Kuis** (`/kuis`): 10 soal acak berbobot dari kata yang pernah dijawab; memakai `submitReview` yang sama sehingga memengaruhi level dan jadwal.

## 6. Status saat ini

Selesai dan terdeploy: fondasi, korpus, engine + 51 tes, auth (email/sandi + Google + register), beranda, sesi belajar, tombol salin ayat pada contoh kata, daftar kosakata dengan persen pemahaman, kuis dinamis.

Belum diuji dengan akun pengguna asli secara end-to-end (login hingga satu sesi penuh). Lakukan ini sebelum menganggap alur stabil.

Checklist rinci ada di `TASKS.md`.

## 7. Jebakan dan pelajaran (baca sebelum mengubah kode)

- **Next 16:** `proxy.ts`, bukan `middleware.ts`. `cacheComponents` aktif di `next.config.ts`: `export const dynamic` dilarang, dan halaman yang membaca cookies/data pengguna harus dibungkus `<Suspense>` (pola: komponen luar statis, komponen dalam async). Tipe `LayoutProps<"/">` dipakai di layout.
- **React lint ketat:** `Date.now()`/`Math.random()` tidak boleh saat render; ref tidak boleh dibaca saat render. Pakai `useEffect`/`useState(() => ...)`.
- **Unicode Arab:** urutan tasydid+harakat bisa beda antar sumber. 32 lemma bertasydid gagal cocok gloss saat impor. Cocokkan lewat `freq_rank`, bukan string Arab (lihat `supabase/seed/gloss_backfill.sql`).
- **Edge Function** `import-corpus` berjalan di latar (`EdgeRuntime.waitUntil`), hasil ada di tabel `import_log`; idempoten dan berhenti bila `corpus_meta` sudah terisi.
- **tsconfig** mengecualikan `supabase/functions` (Deno). ESLint juga mengabaikannya.
- **Jaringan sandbox agen** hanya mengizinkan registry paket dan GitHub. `corpus.quran.com`, `tanzil.net`, `api.quran.com` tidak terjangkau; sumber data memakai mirror GitHub (`mustafa0x/quran-morphology`, `fawazahmed0/quran-api`).
- **GitHub:** `gh pr create` gagal (GraphQL diblokir). Pakai REST: `gh api repos/deonexy/belajar-bahasa-quran/pulls ...` dan `PUT .../pulls/N/merge`.
- **Vercel MCP** tidak punya akses ke akun pemilik; deploy dibuat manual oleh pemilik. Auto-deploy jalan dari `main`.
- **Supabase:** migrasi diterapkan lewat MCP `apply_migration` (bukan CLI), jadi riwayat migrasi remote berbeda dari nama file. Perlu `supabase migration repair` bila ingin memakai CLI. Pembuatan secret Edge Function dilakukan pemilik di dashboard.
- **Pendaftaran publik terbuka**; data dipisah RLS. Tutup di dashboard bila aplikasi hanya untuk pemilik.
- **Web push** sering tidak jalan di perangkat tanpa layanan Google (HarmonyOS). Telegram (`telegram_chat_id` sudah ada) lebih realistis.

## 8. Alur kerja kode

- Satu perubahan = satu branch (`feat/...`, `docs/...`) → push → PR → squash merge ke `main` → Vercel auto-deploy. Jalankan `npm run lint && npx tsc --noEmit && npm test && npm run build` sebelum push.
- Logika baru di `lib/engine` wajib punya uji unit sebelum UI-nya.
- Commit/PR dari agen Claude memakai trailer atribusi yang diminta sesi (Co-Authored-By dan Claude-Session).
- Perubahan skema = file baru di `supabase/migrations/` (nomor berurutan) + diterapkan ke proyek + dicatat di bagian 4.

## 9. Keputusan terbuka (butuh jawaban pemilik)

Hasil review `docs/SPEC_FASE1.md` terhadap aplikasi (15 Okt 2026):
1. **Rumus gerbang F2 tidak konsisten:** materi baru butuh akurasi 7 hari ≥85%, tapi kuota dipotong 50% saat <80% (tidak pernah tercapai). Pilih ambang yang berlaku. Saat ini memakai ambang bertahap (bagian 5).
2. **Definisi "dikuasai":** spec = retrievability ≥0,9 dan stabilitas ≥21 hari (dinamis); aplikasi = level 3 + stabilitas ≥21 + tanpa lapse 30 hari. Usulan: gabungkan.
3. **Default kuota baru:** spec 10/hari, aplikasi 5/hari. Data: 676 lemma teratas = 85% token, 455 = 80%, 1.080 = 90%; target 85% hanya butuh <1 lemma/hari.
4. **Penilaian jawaban:** pilihan ganda (rating otomatis) vs 4 tombol Lupa/Sulit/Bisa/Mudah, atau dua mode.
5. **`review_log` harus append-only** (RLS saat ini mengizinkan semua operasi): perbaikan disetujui secara prinsip, belum dikerjakan.
6. Lisensi: QAC (GPL), Quran.com API (terjemah per kata, audio), atribusi Tanzil/mirror. Cek sebelum repo dibuat publik.

## 10. Langkah berikutnya (usulan urutan)

1. **M3 penyelarasan:** putuskan butir 1-2 di atas; RLS `review_logs` append-only; tabel `data_source`, `daily_snapshot` + `pg_cron`, target di `user_settings`; dashboard target dan proyeksi (F7 awal).
2. Lengkapi arti Indonesia lemma (draf AI → tinjau pemilik via `content/glosses_id.tsv`), lalu pembaca ayat interlinear (F5).
3. Halaman akar + kuis pola (F3), unit nahwu-sharaf (F4).
4. Tes pemahaman ayat dengan AI (F6): perlu API key LLM sebagai secret Edge Function (diisi pemilik).
5. Nice-to-have N1-N7 (heatmap, prioritas surah, mode dengar, leech, jurnal, PWA/Telegram, ekspor).

Batasan data yang perlu diingat: wazan isim dan peran sintaksis (mubtada/khabar/fa'il) **tidak ada** di sumber morfologi; yang ada: bentuk kata kerja (VF 1-10), partisip aktif/pasif, masdar, kasus (NOM/ACC/GEN), mood, person/gender/jumlah, keluarga partikel (إِنّ/كَان).

## 11. Log sesi (paling baru di atas; hanya tambah, jangan hapus)

- **2026-10-15 (sesi pembangunan awal, Claude Sonnet 5.5):** membangun M0-M2 (skema, impor korpus, engine, sesi belajar), deploy Vercel oleh pemilik, auth email/sandi + Google + register, tombol salin ayat, daftar kosakata + kuis dinamis, review spesifikasi fase 1, membuat dokumen ini. Kondisi akhir: `main` terdeploy, semua tes lulus (51). Keputusan terbuka: bagian 9.
