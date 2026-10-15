# DECISIONS

Keputusan dan asumsi selama implementasi. Format: tanggal, keputusan, alasan.

## 2026-10-15

**Sumber korpus dari mirror GitHub, bukan situs asli.** Lingkungan build hanya dapat menjangkau registry paket dan GitHub; `corpus.quran.com`, `tanzil.net`, dan API quran.com diblokir. Dipakai:
- Morfologi QAC (aksara Arab): `mustafa0x/quran-morphology` (`quran-morphology.txt`)
- Teks Utsmani Hafs dan terjemah Kemenag (Indonesia): `fawazahmed0/quran-api`, edisi `ara-quranuthmanihaf` dan `ind-indonesianislam`

Teks ayat berasal dari edisi Hafs di atas, bukan berkas Tanzil. **Lisensi masing-masing sumber belum diverifikasi**; cek sebelum aplikasi dipublikasikan (QAC berlisensi GPL).

**Kunci lemma = (`lemma_ar`, `pos`).** Berkas morfologi memakai aksara Arab dengan harakat, bukan Buckwalter, sehingga `lemma_bw` dikosongkan dan `lemmas` unik pada (`lemma_ar`, `pos`). `pos` aplikasi: `V`, `PRON`, `PN`, `N`, `P`.

**Kata ganti tanpa LEM** (mis. هُمْ، هُم، هُمُ) disatukan memakai bentuk tanpa harakat sebagai lemma.

**Stem utama kata** = segmen non-klitik; bila ada beberapa (mis. مِمَّا = مِن + مَا), pilih yang berkategori N/V, selain itu yang terakhir.

**Partikel berdiri sendiri** (مِن، فِي، لا, dll.) tetap menjadi item lemma karena sangat sering muncul; prefiks dan sufiks klitik tidak.

**Arti Indonesia per lemma** tidak tersedia dari sumber terjangkau. Draf 320 lemma teratas (menutup sekitar 75% kata Al-Qur'an) ditulis manual di `content/glosses_id.tsv` dan **belum ditinjau pemilik** (`reviewed=false`). Hanya lemma ber-gloss yang dibuka sebagai item baru. Perluas gloss untuk melanjutkan kurikulum melewati lemma ke-320.

**Impor lewat Edge Function** agar 77 ribu baris tidak melewati sesi pengembangan. Fungsi menolak berjalan bila `corpus_meta` sudah terisi.

**Target cakupan 80%** tercapai jauh lebih awal dari 2.000 lemma: 300 lemma teratas ≈ 74%, 700 ≈ 85%, 2.000 ≈ 95% (dihitung dari data). Pertimbangkan menaikkan target kualitas (mis. kemampuan menerjemahkan ayat), bukan hanya cakupan.

**Auth:** pendaftaran publik Supabase harus dimatikan di dashboard (Authentication > Sign In / Providers) setelah akun pemilik dibuat.

## Keputusan M2
- Ayat terbuka otomatis bila >= 85% kata berlemma sudah mastered (fungsi `openable_ayah_items`), maksimal 3 per hari; tidak memakan kuota.
- Hanya lemma yang punya `gloss_id` menjadi kandidat item baru (`new_item_candidates`). Backfill gloss: `supabase/seed/gloss_backfill.sql` (32 lemma bertasydid gagal cocok karena urutan Unicode; dicocokkan lewat peringkat).
- Pelajaran: latihan dinilai benar bila >= 75% tepat; dijadwalkan FSRS seperti item lain.
- Login hanya magic link, `shouldCreateUser: false`; akun pemilik dibuat manual di dashboard Supabase.
- Next 16: `proxy.ts` (bukan middleware), `cacheComponents` aktif sehingga halaman dinamis dibungkus `<Suspense>`.

## Autentikasi
- Login diganti ke email + kata sandi dan Google OAuth; ada halaman `/register`. Tautan magic link dihapus karena memerlukan akun yang dibuat manual.
- Pendaftaran terbuka; data tiap pengguna terisolasi oleh RLS (`user_id = auth.uid()`). Untuk menutup pendaftaran, matikan *Allow new users to sign up* di dashboard Supabase.
- Google OAuth perlu diaktifkan di dashboard Supabase (Authentication → Providers → Google) dengan Client ID/Secret dari Google Cloud Console.

## Kosakata dan kuis
- Persen pemahaman per kata = (level/3) x min(1, stabilitas/21 hari) x 100 (`understanding()` di engine, dipakai juga oleh tingkat pemahaman global).
- `/kosakata`: daftar lemma yang sudah dibuka beserta persen, level, status, dan jadwal ulang; bisa dicari, difilter, dan diurutkan.
- `/kuis`: 10 soal dibangun ulang tiap dibuka dari kata yang sudah pernah dijawab. Pemilihan acak berbobot: pemahaman rendah dan jatuh tempo lebih sering muncul. Jawaban memakai `submitReview` yang sama dengan sesi belajar, sehingga level dan jadwal FSRS ikut naik/turun; ringkasan menampilkan perubahan persen per kata.

## M3 dan dashboard
- Dikuasai = kriteria tersimpan + R >= 0,9. Pada retensi target 0,9, FSRS memberi R = 0,9 tepat saat hari-sejak-review = stabilitas, sehingga R >= 0,9 dihitung sebagai `elapsed <= S` (SQL dan `isRetained`). Bila `target_retention` diubah dari 0,9 hitungan ini menjadi aproksimasi.
- `daily_stats` dipakai sebagai snapshot harian (tidak membuat tabel `daily_snapshot` terpisah). Cron mengambil snapshot penutup hari kemarin; halaman dashboard memperbarui titik hari ini.
- Proyeksi: regresi linear cakupan 28 hari terakhir; ditampilkan bersama sisa lemma yang dibutuhkan karena kurva cakupan melambat.
- Target "lemma dikuasai" ditampilkan sebagai perkiraan (dikuasai + sisa lemma untuk target cakupan); target "akar dikuasai" menunggu data kurikulum.

## Penyimpanan lokal dan audio (2026-10-16, disetujui pemilik)
- **Dua tingkat penyimpanan lokal.** Tingkat 1: data esensial dan kecil (status belajar pengguna, rencana harian, item jatuh tempo 7 hari, pengaturan, outbox, lemma ber-gloss, akar, pelajaran, ayat contoh) disimpan otomatis tanpa bertanya. Tingkat 2: data besar (teks per surah/juz/seluruh Al-Qur'an, audio) hanya diunduh atas pilihan pengguna, dengan penjelasan ukuran dan manfaat (lebih cepat, bisa offline).
- **Server tetap master** untuk data pengguna. Lokal = salinan + outbox. Pembukaan item baru (mastery gate), snapshot harian/dashboard, tes AI F6, `ai_usage`, langganan push tetap di server.
- **Sinkron antar perangkat:** arah yang dituju adalah `user_items` dihitung ulang dari `review_logs` berurutan waktu. Ini menambah alasan keputusan `review_logs` append-only (masih PENDING).
- **Privasi:** service worker tetap tidak meng-cache halaman pribadi. Data pengguna di IndexedDB dihapus saat logout.
- **Audio tidak disimpan di server.** Perangkat mengunduh langsung dari CDN Islamic Network (alquran.cloud), dengan pilihan qori. Syarat sumber: gratis untuk distribusi non-komersial dan penggunaan pribadi/pendidikan; hak cipta milik qori. CORS belum diverifikasi.

## O1 fondasi lokal (2026-10-16)
- **Arsitektur:** server tetap master. Lokal (IndexedDB/Dexie, `lib/local/`) = salinan + `outbox`. Sinkron dibuat terhadap antarmuka `Remote` (`lib/local/remote.ts`) sehingga logika sinkron/outbox diuji tanpa jaringan; adaptor Supabase tipis.
- **Satu aturan penilaian:** `applyReview` (`lib/engine/review.ts`) dipakai server (`submitReview`) dan klien. Pembuat kartu (`lib/session-cards.ts`) juga dipakai bersama. Penilaian offline identik dengan online.
- **Urutan alur `/belajar` (online):** server action `ensureToday` (mastery gate membuka item baru) -> sinkron -> sesi dibangun dari data lokal. Offline: langsung dari lokal. Item baru tidak bisa dibuka offline (sengaja).
- **Penyimpangan dari rencana:** tabel `dueItems` tidak dibuat; `userItems` memuat semua item dengan indeks `dueAt` sehingga "jatuh tempo 7 hari" cukup kueri (tidak ada salinan kedua yang bisa tidak sinkron). Tabel tambahan: `ayahs` (teks ayat untuk item ayat terbuka), `reviewDays` (streak dan retensi 7 hari), `meta` (userId, total korpus, hitungan pola).
- **Contoh ayat** dimuat hanya untuk lemma yang sudah dibuka lewat RPC baru `lemma_examples` (ayat terpendek per lemma). Konten lemma ber-gloss + akar + pelajaran sekitar 0,3 MB (diuji < 2 MB).
- **Versi konten:** RPC `content_versions()` (hash md5 per kelompok: lemmas termasuk `gloss_reviewed`, roots, lessons). Berubah -> diperbarui otomatis tanpa bertanya. Bila RPC tidak ada, konten dimuat ulang paling cepat tiap 24 jam; contoh ayat dilewati (kartu tanpa contoh).
- **Outbox:** satu entri = satu jawaban (log + keadaan item sesudahnya). `reviewed_at` dikirim dari waktu jawab, bukan waktu kirim (penting untuk streak/retensi). Kirim memakai `upsert ... on conflict (client_id) do nothing`. Server tidak terjangkau = berhenti tanpa menambah hitungan percobaan; ditolak server 8 kali = dibuang ke `meta.deadLetters` agar antrean tidak macet.
- **Konflik:** asumsi satu perangkat aktif; last-write-wins per item. Selama antrean belum kosong, data pengguna lokal TIDAK ditimpa tarikan server. Arah jangka panjang tetap menghitung ulang `user_items` dari `review_logs` berurutan waktu (butuh RLS append-only yang masih PENDING).
- **`pola_attempts.client_id`** ditambah (migrasi 0009) agar pengiriman ulang idempoten. Adaptor punya cadangan bila kolom belum ada.
- **Privasi/offline:** service worker v2 hanya menambah cache cangkang `/belajar` dan `/kuis` (statis, tanpa data pribadi, bukan hasil redirect ke `/login`). Cangkang dihangatkan setelah sinkron pertama (header `x-warm`). Halaman pribadi lain tetap tidak di-cache. Logout: kirim antrean dulu (konfirmasi bila masih ada yang tertunda), lalu hapus data pengguna lokal.
- **Cadangan:** bila IndexedDB tidak tersedia, `/belajar` dan `/kuis` memakai jalur server lama (`loadServerCards`, `submitReview`).
- **Perbaikan CI di luar lingkup O1:** `npm run typecheck` kini menjalankan `next typegen` dulu (tipe `PageProps`/`LayoutProps` tidak ada di checkout bersih; CI `main` gagal di langkah ini sejak sebelum O1), dan `parse.test.ts` membaca data mentah di `beforeAll` (isi `describe.skipIf` tetap dieksekusi sehingga berkas gagal bila `data/raw` tidak ada).

