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
| `supabase/seed/` | `lessons.sql`, `gloss_backfill.sql`, `glosses_321_700.sql`, `lessons_nahwu_sharaf.sql` (dihasilkan `scripts/gen_lessons_f4.py`; teks ayat diambil dari `data/raw/fawaz`) |
| `content/glosses_id.tsv`, `content/glosses_id_321_700.tsv` | draf arti Indonesia lemma peringkat 1-320 dan 321-700 (kunci `rank` = `freq_rank`), kolom `reviewed` masih semua `false` |
| `docs/` | `DECISIONS.md` (keputusan teknis), `SPEC_FASE1.md` (spesifikasi pembaruan), file ini |

## 4. Skema data (ringkas, sesuai yang sudah diterapkan)

- **Konten (read-only untuk klien):** `corpus_meta`, `roots`, `lemmas` (kunci unik `(lemma_ar, pos)`), `ayahs`, `words` (`morph` jsonb berisi segmen + fitur), `lessons`, `items` (`kind`: lemma/lesson/ayah/..., `ref_id`, `seq`, `prereq_item_ids`).
- **Pengguna (RLS `user_id = auth.uid()`):** `user_settings`, `user_items` (level 0-3, `fsrs` jsonb, `status`, `due_at`), `review_logs` (`client_id` unik untuk idempotensi), `daily_plans`, `daily_stats`, `push_subscriptions`, `ai_usage`. View `v_user_coverage`.
- **Fungsi RPC (security invoker):** `review_days`, `new_item_candidates`, `openable_ayah_items`, `take_daily_snapshot(user, date)`, `lemmas_needed_for_target(target)`, `reviews_due_within(days)`.
- **M3 (migrasi 0006):** `data_source` (audit sumber/lisensi), kolom target di `user_settings` (`target_token_coverage`, `target_test_accuracy`, `daily_review_limit`, `phase1_deadline`), `daily_stats` dipakai sebagai snapshot harian (+`roots_mastered`, `test_accuracy_4w`), `pg_cron` job `daily-snapshot` (00.05 WIB, snapshot penutup hari kemarin), view `v_user_coverage` hanya menghitung lemma yang masih terjaga.
- Data terimpor (terverifikasi): 77.429 kata, 4.815 lemma, 6.236 ayat, 1.651 akar, 11.054 item. 700 lemma punya `gloss_id` (≈85% token; draf AI, belum ditinjau pemilik; seed `supabase/seed/glosses_321_700.sql`).
- Nama tabel berbeda dari `docs/SPEC_FASE1.md` (spec: `root/lemma/verse/token/card`). **Keputusan: tidak mengganti nama**, tambahkan tabel yang belum ada.

## 5. Logika inti (perilaku saat ini)

- **Rating:** otomatis dari jawaban pilihan ganda: salah=1; benar >10 dtk=2; 3-10 dtk=3; <3 dtk=4. Terjemah ayat: penilaian mandiri benar/sebagian/salah.
- **Level 0-3:** naik bila rating ≥3, turun bila 1 (tidak di bawah 1 setelah pernah mencapai 1). Latihan: level 0 recognize, 1 recall, 2 context, 3 acak 20/30/50.
- **Dikuasai:** level 3 dan stabilitas FSRS ≥21 hari dan tanpa lapse 30 hari (status tersimpan), DAN masih terjaga: R ≥ 0,9, setara hari-sejak-review ≤ stabilitas (`isRetained`). Cakupan, snapshot, dan dashboard hanya menghitung yang terjaga; status tersimpan tidak berubah sendiri.
- **Pemahaman per kata (%):** `(level/3) × min(1, stabilitas/21) × 100` (`understanding()`).
- **Mastery gate harian** (`computeQuota`): R = akurasi benar/salah 7 hari (default 0,90 bila <20 jawaban); B = backlog jatuh tempo; L = item level<2. B>100 atau R<0,8 → kuota 0; 0,8-0,85 → maks 2; 0,85-0,9 → maks 3; ≥0,9 → maks N (default 5); dikurangi `max(0, L-20)`. Tambahan M3: bila perkiraan review 7 hari (`B7`) > 7 × `daily_review_limit` (default 150) kuota 0.
- **Item baru:** hanya lemma yang punya `gloss_id` dan pelajaran; ayat terbuka otomatis bila ≥85% kata berlemma sudah dikuasai (maks 3/hari).
- **Cakupan:** jumlah `freq` lemma dikuasai / total kata Al-Qur'an (77.429).
- **Kuis** (`/kuis`): 10 soal acak berbobot dari kata yang pernah dijawab; memakai `submitReview` yang sama sehingga memengaruhi level dan jadwal.

## 6. Status saat ini

Selesai dan terdeploy: fondasi, korpus, engine + 51 tes, auth (email/sandi + Google + register), beranda, sesi belajar, tombol salin ayat pada contoh kata, daftar kosakata dengan persen pemahaman, kuis dinamis.

Pemilik sudah memakai aplikasi dengan akun asli (15 Okt 2026: 6 item, 14 review, retensi 93%), jadi alur login → sesi belajar terbukti jalan. M3 dan dashboard F7 (`/dashboard`) selesai.

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

## 9. Keputusan (diambil Claude atas perintah "eksekusi TASKS.md", 15 Okt 2026; pemilik boleh mengubah)

1. **Gerbang F2:** rumus spec kontradiktif, jadi dipakai ambang bertahap yang sudah ada + batas perkiraan review 7 hari (B7 > 7×150 → kuota 0). Syarat "review hari ini = 0" tidak dipakai: item baru dibuka saat rencana harian dibuat. Mengubahnya = ubah `computeQuota`/`ensureDailyPlan`.
2. **Dikuasai:** gabungan: kriteria tersimpan (level 3, S≥21, tanpa lapse 30 hari) DAN R≥0,9 (lihat bagian 5).
3. **Kuota baru default 5/hari** (spec 10). Data: 676 lemma = 85% token; target 85% <1 lemma/hari. Bisa diubah di `user_settings.daily_new_max`.
4. **Penilaian jawaban:** tetap pilihan ganda dengan rating otomatis (belum ada mode 4 tombol). Terbuka.
5. **`review_logs` append-only: MENUNGGU PERSETUJUAN PEMILIK.** Penerapannya (menghapus policy RLS lama) dibatalkan oleh sistem saat dijalankan, file ada di `supabase/pending/20261015000007_review_logs_append_only.sql`. Terapkan setelah pemilik setuju, lalu pindahkan ke `supabase/migrations/`.
6. **Lisensi** QAC (GPL), Quran.com API, atribusi Tanzil/mirror: belum dicek (tercatat di tabel `data_source`).
7. **Ambang lulus pelajaran** dinaikkan ke 80% (spec F4).

## 10. Langkah berikutnya (usulan urutan)

Rincian per paket kerja (P1–P5), status milestone spec, dan pemetaan nama tabel spec ke repo ada di `docs/SPEC_FASE1.md` bagian "Urutan implementasi".

1. ~~M3 penyelarasan + dashboard F7~~ selesai (kecuali RLS `review_logs`, butir 5 bagian 9).
2. ~~Arti lemma sampai 700~~ selesai (draf; pemilik perlu meninjau). ~~Pembaca interlinear F5~~ selesai (`/baca`).
3. ~~Halaman akar + kuis pola (F3), unit nahwu-sharaf (F4)~~ selesai versi awal (8 pelajaran baru, `/akar/[root]`, `/pola`).
4. Tes pemahaman ayat dengan AI (F6): perlu API key LLM sebagai secret Edge Function (diisi pemilik).
5. Nice-to-have N1-N7 (heatmap, prioritas surah, mode dengar, leech, jurnal, PWA/Telegram, ekspor).

Batasan data yang perlu diingat: wazan isim dan peran sintaksis (mubtada/khabar/fa'il) **tidak ada** di sumber morfologi; yang ada: bentuk kata kerja (VF 1-10), partisip aktif/pasif, masdar, kasus (NOM/ACC/GEN), mood, person/gender/jumlah, keluarga partikel (إِنّ/كَان).

## 11. Log sesi (paling baru di atas; hanya tambah, jangan hapus)

- **2026-10-16 (Claude Sonnet 5.5):** PWA dasar: `app/manifest.ts` (standalone, shortcut Belajar/Baca/Kuis), ikon asli buku terbuka + bintang (`scripts/gen_icons.mjs` menghasilkan `public/icons/*`, `app/icon.png`, `app/apple-icon.png`; `favicon.ico` bawaan dihapus), `public/sw.js` (cache aset statis; halaman data selalu dari jaringan; offline -> `/offline`), `components/register-sw.tsx` (hanya production). Sengaja TIDAK meng-cache halaman pribadi. Offline penuh (belajar tanpa internet) masih M5.

- **2026-10-16 (Claude Sonnet 5.5):** pembaca `/baca`: kata yang sudah dipelajari disorot hijau (4 tingkat, makin tua makin kuat), kata belum dipelajari tanpa isi dan berbingkai putus-putus, atas permintaan pemilik agar mudah dibedakan. Info: DB baru 45 MB dari kuota 500 MB (words 28 MB).

- **2026-10-15 (Claude Sonnet 5.5):** beranda disederhanakan atas permintaan pemilik: menu 5 tombol ikon + label pendek tanpa deskripsi (Baca, Kuis, Kata, Pola, Target), detail mastery gate dilipat. Pemilik meminta menu simpel, mudah diakses, tanpa deskripsi; pertahankan gaya ini untuk menu baru. RLS `review_logs` append-only masih dibatalkan alat Supabase (drop policy); opsi: pemilik jalankan di SQL Editor atau `revoke update, delete`.

- **2026-10-15 (Claude Sonnet 5.5):** F4: 8 pelajaran nahwu-sharaf baru (tasrif, isim isyarah, maushul, jumlah ismiyah/fi'liyah, idhafah, na't, i'rab dasar; seq 400-2500; sudah diterapkan ke DB beserta `items`). F3: `/akar/[root]` (lema sebaran satu akar, ditaut dari pembaca) dan `/pola` (kuis pola kata dari fitur PERF/IMPF/IMPV/ACT_PCPL/PASS_PCPL/VN; latihan bebas, skor TIDAK disimpan dan tidak memengaruhi gerbang). Batasan: tidak ada wazan isim di data, jadi kuis wazan isim belum ada. Isi pelajaran draf AI, perlu ditinjau pemilik/ustaz.

- **2026-10-15 (Claude Sonnet 5.5):** F5 pembaca interlinear: `/baca` (daftar surah) dan `/baca/[surah]?hal=N` (10 ayat/halaman; query dibatasi per rentang ayat karena batas 1000 baris PostgREST). Kata diwarnai menurut level lemma pengguna, toggle sembunyikan arti/terjemah, ketuk kata → lemma, akar, ciri morfologi (`lib/morph-labels.ts`), tombol "Tambah ke review" (`app/baca/actions.ts`, idempoten, `priority=true`). Jebakan: tipe `PageProps<"/baca/[surah]">` baru ada setelah `npx next typegen`/build.

- **2026-10-15 (Claude Sonnet 5.5):** menambah draf arti Indonesia lemma peringkat 321-700 (380 lemma, dicocokkan per `freq_rank` dan diperiksa terhadap daftar lemma), diterapkan ke DB (lemmas + words), cakupan token berarti ≈85,4%. Semua `reviewed=false`.

- **2026-10-15 (sesi eksekusi TASKS, Claude Sonnet 5.5):** P1 selesai: migrasi 0006 (target, `data_source`, snapshot harian di `daily_stats` + `pg_cron`, cakupan berbasis R≥0,9), gerbang dengan batas review 7 hari, `lib/engine/projection.ts`, dashboard `/dashboard`, ambang lulus pelajaran 80%. Keputusan 1-3 dan 7 diambil (bagian 9). RLS `review_logs` append-only dibatalkan sistem saat diterapkan: menunggu persetujuan pemilik (`supabase/pending/`). Lanjut P2-P3 (gloss 700, interlinear, akar, nahwu).
- **2026-10-15 (sesi spesifikasi, Claude Opus 5.5):** menulis ulang bagian "Urutan implementasi" di `docs/SPEC_FASE1.md` sebagai teks (diagram asli tidak terekspor), menyelaraskannya dengan kondisi repo, menambah tabel pemetaan nama spec ke repo dan paket kerja P1–P5. Hanya dokumen; tidak ada perubahan kode. Keputusan terbuka tetap di bagian 9.
- **2026-10-15 (sesi pembangunan awal, Claude Sonnet 5.5):** membangun M0-M2 (skema, impor korpus, engine, sesi belajar), deploy Vercel oleh pemilik, auth email/sandi + Google + register, tombol salin ayat, daftar kosakata + kuis dinamis, review spesifikasi fase 1, membuat dokumen ini. Kondisi akhir: `main` terdeploy, semua tes lulus (51). Keputusan terbuka: bagian 9.
