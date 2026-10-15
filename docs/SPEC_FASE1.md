> **Status dokumen:** spesifikasi pembaruan (diunggah pemilik 15 Okt 2026). Belum seluruhnya disetujui: lihat bagian "Keputusan terbuka" di `docs/PROJECT_CONTEXT.md` (rumus gerbang F2, definisi dikuasai, nama tabel). Bagian "Urutan implementasi" aslinya embed dan tidak ikut terekspor.

# Spesifikasi Fitur Fase 1 — Belajar Bahasa Al-Qur'an

Oct 15, 2026 · @The One And Only

## Ringkasan dan definisi selesai Fase 1

Fase 1 dinyatakan selesai jika empat ukuran di bawah tercapai bersamaan, dalam 2 tahun sejak mulai. Semua angka dihitung dari data retensi (FSRS), bukan dari jumlah materi yang pernah dibuka.

| Ukuran | Target | Cara ukur |
| --- | --- | --- |
| Cakupan token Al-Qur'an | ≥ 85% (bisa diatur) | Jumlah kemunculan kata yang lemma-nya berstatus "dikuasai" dibagi total token Al-Qur'an |
| Lemma dikuasai | Ditentukan setelah data kurikulum dimuat | Lemma dengan retrievability FSRS ≥ 0,9 dan stabilitas ≥ 21 hari |
| Akar kata dikuasai | Ditentukan setelah data kurikulum dimuat | Akar dengan ≥ 1 lemma dikuasai dan lolos kuis pola turunan |
| Akurasi tes ayat acak | ≥ 80% rata-rata 4 minggu terakhir | Skor AI atas terjemahan mandiri ayat yang belum pernah dilatih |
| Kurikulum nahwu-sharaf | 100% unit lulus | Setiap unit lulus kuis dengan skor ≥ 80% |

Angka target disimpan di tabel konfigurasi, bukan di kode, supaya bisa disetel ulang tanpa deploy.

Prinsip desain:

- **Retensi di atas aktivitas.** Streak dan menit belajar tetap ada, tapi bukan ukuran kemajuan.
- **Gerbang materi.** Materi baru hanya terbuka jika review hari ini tuntas dan beban review terkendali.
- **Frekuensi dulu.** Urutan belajar mengikuti frekuensi kemunculan di Al-Qur'an, dengan akar kata sebagai pengikat.
- **Konteks ayat.** Setiap kata dan kaidah selalu ditautkan ke ayat nyata.

## Sumber data

Semua data Al-Qur'an diimpor sekali lewat skrip seed ke Supabase, lalu dianggap read-only oleh aplikasi. Lisensi tiap sumber wajib dicek sebelum impor; status di bawah berdasarkan pengetahuan umum dan belum diverifikasi.

| Data | Sumber kandidat | Dipakai untuk | Catatan lisensi (verifikasi) |
| --- | --- | --- | --- |
| Teks Utsmani per ayat | Tanzil | Tampilan ayat | Bebas dipakai, teks tidak boleh diubah, wajib atribusi |
| Morfologi per kata (akar, lemma, wazan, POS, i'rab) | Quranic Arabic Corpus | Kartu kata, akar, kuis pola, mode interlinear | GPL; cek dampaknya bila repo publik |
| Terjemahan per kata (Indonesia) | API Quran.com | Arti kata di kartu dan interlinear | Cek syarat penggunaan API |
| Terjemahan ayat (Indonesia) | Terjemahan Kemenag via API Quran.com | Rujukan penilaian tes ayat | Cek izin terjemahan |
| Audio per kata dan per ayat | API Quran.com | Pengucapan kata, mode dengar | Streaming dari CDN mereka, tidak disimpan ulang |

Aturan impor:

- Setiap token disimpan dengan kunci `surah:ayat:urutan_kata`, supaya bisa di-join ke morfologi, terjemahan, dan audio.
- Frekuensi lemma dan akar dihitung saat seed, lalu disimpan sebagai kolom.
- Simpan versi dan tanggal sumber di tabel `data_source` untuk audit.

## Fitur wajib

Tujuh fitur ini menentukan apakah target Fase 1 benar-benar tercapai. Masing-masing punya kriteria penerimaan yang bisa diuji oleh coder AI.

### F1. Spaced repetition (FSRS) per lemma

Setiap lemma yang sudah dibuka punya jadwal review sendiri, dihitung dengan algoritma FSRS (pustaka `ts-fsrs`).

- Kartu menampilkan kata Arab, audio, dan contoh ayat. Pengguna menilai diri: Lupa, Sulit, Bisa, Mudah.
- Ada dua arah kartu: Arab ke arti (wajib) dan arti ke Arab (opsional, untuk lemma frekuensi tinggi).
- Kriteria penerimaan:
  - [ ] Setelah dinilai, `due_at`, `stability`, `difficulty` tersimpan dan sesuai keluaran `ts-fsrs`.
  - [ ] Antrean review hari ini hanya berisi kartu dengan `due_at` ≤ akhir hari (zona Asia/Jakarta).
  - [ ] Setiap penilaian tercatat di `review_log` dan tidak pernah dihapus.

### F2. Gerbang materi baru

Materi baru (lemma, unit nahwu) hanya terbuka bila pengguna terbukti siap.

- Syarat buka: review hari ini selesai, perkiraan beban review 7 hari ke depan di bawah batas, dan akurasi review 7 hari ≥ 85%.
- Jumlah lemma baru per hari bisa diatur (default 10) dan otomatis turun jika akurasi turun.
- Kriteria penerimaan:
  - [ ] Tombol "Materi baru" terkunci dengan alasan yang jelas bila syarat belum terpenuhi.
  - [ ] Kuota harian turun 50% otomatis saat akurasi 7 hari < 80%.

### F3. Kurikulum frekuensi berbasis akar kata

Urutan lemma mengikuti frekuensi kemunculan di Al-Qur'an. Saat sebuah lemma dibuka, aplikasi menampilkan akar dan saudara sekarnya.

- Halaman akar: daftar turunan, wazan, arti, dan jumlah kemunculan.
- Kuis pola: diberi akar + wazan, tebak artinya (contoh: pola fa'il = pelaku).
- Kriteria penerimaan:
  - [ ] Lemma baru diambil dari urutan frekuensi tertinggi yang belum dibuka.
  - [ ] Dari kartu mana pun, satu ketukan membuka halaman akarnya.

### F4. Jalur nahwu-sharaf

Kurikulum tata bahasa dalam unit pendek: isim, fi'il, harf, tasrif, dhamir, isim isyarah/maushul, i'rab dasar, jumlah ismiyah/fi'liyah, idhafah, na't.

- Tiap unit: penjelasan singkat, contoh dari ayat, lalu kuis.
- Unit dibuka berurutan dan ikut aturan gerbang F2.
- Kriteria penerimaan:
  - [ ] Unit lulus bila skor kuis ≥ 80%; unit gagal bisa diulang dengan soal acak berbeda.
  - [ ] Konsep yang sudah lulus masuk antrean review FSRS sebagai kartu konsep.

### F5. Mode baca ayat interlinear

Ayat tampil kata per kata, dengan terjemahan per kata di bawahnya.

- Tombol "sembunyikan arti" untuk melatih membaca tanpa contekan. Kata yang belum dikuasai bisa diberi warna.
- Ketuk kata: akar, lemma, wazan, kedudukan i'rab, audio, dan tombol "tambah ke review".
- Kriteria penerimaan:
  - [ ] Semua 114 surah bisa dibuka dan dinavigasi per ayat.
  - [ ] Warna kata mengikuti status penguasaan pengguna secara real time.

### F6. Tes pemahaman ayat acak

Tes mingguan berisi 5 ayat acak yang belum pernah dilatih di mode baca. Ayat dipilih yang mayoritas katanya sudah dikuasai.

- Pengguna menulis terjemahan sendiri. AI (lewat Supabase Edge Function) menilai terhadap terjemahan rujukan dan memberi skor 0–100 + catatan kata yang salah.
- Kata yang salah otomatis dinilai "Lupa" di FSRS.
- Kriteria penerimaan:
  - [ ] Kunci API AI hanya ada di Edge Function, tidak pernah di klien.
  - [ ] Skor, jawaban, dan umpan balik tersimpan di `comprehension_test`.

### F7. Dashboard target dan proyeksi

Satu layar yang menjawab "apakah saya on track untuk Fase 1?".

- Menampilkan lima ukuran dari bagian Ringkasan, masing-masing dengan target dan nilai saat ini.
- Proyeksi tanggal selesai berdasarkan laju 4 minggu terakhir, dibandingkan tenggat 2 tahun.
- Streak, pengingat, dan riwayat sesi tetap ada sebagai pendukung.
- Kriteria penerimaan:
  - [ ] Status "on track" atau "tertinggal X minggu" tampil di bagian atas.
  - [ ] Grafik cakupan token per minggu sejak hari pertama.

## Fitur nice to have

Fitur-fitur ini dikerjakan setelah F1–F7 stabil, urut dari dampak terbesar.

| Kode | Fitur | Inti | Bergantung pada |
| --- | --- | --- | --- |
| N1 | Heatmap mushaf | Grid 114 surah / 6.236 ayat, warna sesuai % kata yang dikuasai per ayat | F1, F5 |
| N2 | Prioritas surah pilihan | Pengguna menandai surah yang sering dibaca (Juz 30, bacaan shalat); lemmanya naik di antrean | F3 |
| N3 | Mode dengar | Putar ayat lalu tebak arti kata yang disorot, tanpa teks | F5 |
| N4 | Deteksi leech | Kartu dengan ≥ 6 kali "Lupa" ditandai; latihan khusus dan pasangan kata yang mirip | F1 |
| N5 | Jurnal tadabbur | Catatan bebas per ayat, bisa dicari | F5 |
| N6 | PWA offline + push notification | Review tetap jalan tanpa internet, sinkron saat online; pengingat via Web Push | F1 |
| N7 | Ekspor dan backup | Unduh progres dan log review sebagai JSON/CSV | Semua |

## Skema database Supabase

> Skema di bawah adalah contoh rancangan. Repo memakai nama tabel lain; lihat "Pemetaan nama: spec ke repo" di bagian Urutan implementasi.

Skema dibagi dua. Tabel korpus bersifat read-only dan dapat dibaca semua pengguna yang login. Tabel pengguna dilindungi RLS berdasarkan `user_id = auth.uid()`.

```sql
-- ===== KORPUS (read-only) =====
create table root (
  id serial primary key,
  letters text not null unique,        -- contoh: 'ك ت ب'
  meaning_id text,
  freq int not null default 0           -- total token turunan akar ini
);

create table lemma (
  id serial primary key,
  arabic text not null,
  root_id int references root(id),
  pos text not null,                    -- noun | verb | particle | ...
  wazan text,
  meaning_id text not null,
  freq int not null,
  freq_rank int not null unique         -- urutan kurikulum F3
);

create table verse (
  id serial primary key,
  surah smallint not null,
  ayah smallint not null,
  text_uthmani text not null,
  translation_id text not null,
  audio_url text,
  unique (surah, ayah)
);

create table token (
  id serial primary key,
  verse_id int not null references verse(id),
  position smallint not null,
  arabic text not null,
  lemma_id int references lemma(id),
  morphology jsonb,                     -- POS, i'rab, fitur gramatikal
  gloss_id text,
  audio_url text,
  unique (verse_id, position)
);
create index on token (lemma_id);

create table grammar_unit (
  id serial primary key,
  seq int not null unique,
  title text not null,
  body_md text not null,
  example_verse_ids int[] not null default '{}'
);

create table quiz_item (
  id serial primary key,
  grammar_unit_id int references grammar_unit(id),
  root_id int references root(id),      -- untuk kuis pola (F3)
  prompt jsonb not null,
  answer jsonb not null
);

create table data_source (
  name text primary key, version text, imported_at timestamptz default now(), license text
);

-- ===== PENGGUNA (RLS) =====
create table app_config (
  user_id uuid primary key references auth.users,
  target_token_coverage numeric not null default 0.85,
  target_test_accuracy numeric not null default 0.80,
  daily_new_limit int not null default 10,
  phase1_start date not null,
  phase1_deadline date not null,
  priority_surahs smallint[] not null default '{}' -- N2
);

create table card (
  id bigserial primary key,
  user_id uuid not null references auth.users,
  kind text not null,                   -- lemma_ar2id | lemma_id2ar | concept
  lemma_id int references lemma(id),
  grammar_unit_id int references grammar_unit(id),
  state smallint not null,              -- FSRS: new, learning, review, relearning
  stability double precision,
  difficulty double precision,
  due_at timestamptz not null,
  last_review_at timestamptz,
  reps int not null default 0,
  lapses int not null default 0,        -- N4: leech bila >= 6
  unique (user_id, kind, lemma_id, grammar_unit_id)
);
create index on card (user_id, due_at);

create table review_log (
  id bigserial primary key,
  user_id uuid not null references auth.users,
  card_id bigint not null references card(id),
  rating smallint not null,             -- 1 Lupa, 2 Sulit, 3 Bisa, 4 Mudah
  reviewed_at timestamptz not null default now(),
  elapsed_days double precision,
  scheduled_days double precision,
  source text not null default 'review' -- review | test_ayat
);

create table grammar_progress (
  user_id uuid references auth.users,
  grammar_unit_id int references grammar_unit(id),
  best_score numeric,
  passed_at timestamptz,
  primary key (user_id, grammar_unit_id)
);

create table comprehension_test (
  id bigserial primary key,
  user_id uuid not null references auth.users,
  verse_id int not null references verse(id),
  answer text not null,
  score smallint,
  feedback jsonb,                       -- token yang salah + catatan
  taken_at timestamptz not null default now()
);

create table daily_snapshot (
  user_id uuid references auth.users,
  day date,
  token_coverage numeric,
  lemmas_mastered int,
  roots_mastered int,
  test_accuracy_4w numeric,
  minutes_studied int,
  primary key (user_id, day)
);

create table tadabbur_note (             -- N5
  id bigserial primary key,
  user_id uuid not null references auth.users,
  verse_id int not null references verse(id),
  body text not null,
  updated_at timestamptz not null default now()
);
```

Aturan RLS:

- Tabel korpus: `select` untuk peran `authenticated`; tidak ada `insert/update/delete` dari klien.
- Tabel pengguna: semua operasi dengan kebijakan `user_id = auth.uid()`.
- `review_log`: hanya `insert` dan `select`, tanpa `update/delete`, agar riwayat tidak bisa diubah.
- `comprehension_test.score` dan `feedback` hanya ditulis oleh Edge Function dengan service role.

## Logika inti

Empat perhitungan berikut adalah jantung aplikasi. Taruh di satu modul `lib/progress` yang bisa diuji unit, tanpa ketergantungan pada UI.

### Status "dikuasai"

Sebuah lemma dikuasai bila kartu `lemma_ar2id`-nya memenuhi dua syarat sekaligus:

```latex
R(t) \ge 0{,}9 \quad \text{dan} \quad S \ge 21\ \text{hari}
```

R(t) adalah retrievability FSRS pada saat dihitung, dan S adalah stabilitas kartu. Syarat stabilitas mencegah kata yang baru dihafal kemarin langsung terhitung.

### Cakupan token

```latex
\text{cakupan} = \frac{\sum_{\ell \in \text{dikuasai}} \text{freq}(\ell)}{\text{jumlah seluruh token berlemma}}
```

- Hitung lewat SQL view atau RPC `get_coverage(user_id)`, join `card` ke `lemma.freq`.
- Partikel tanpa lemma (jika ada di data) dikeluarkan dari pembilang dan penyebut.
- Simpan hasil harian ke `daily_snapshot` lewat cron Supabase (`pg_cron`) pukul 00.05 WIB.

### Gerbang materi baru (F2)

```
boleh_tambah = review_due_hari_ini == 0
           AND akurasi_7_hari >= 0.85
           AND perkiraan_review_7_hari <= 7 * batas_review_harian
kuota = daily_new_limit * (akurasi_7_hari < 0.80 ? 0.5 : 1)
```

Akurasi 7 hari = proporsi rating ≥ 3 di `review_log` 7 hari terakhir. Perkiraan review 7 hari = jumlah kartu dengan `due_at` dalam 7 hari ke depan. Batas review harian default 150 dan disimpan di `app_config`.

### Proyeksi tanggal selesai (F7)

- Laju = kenaikan cakupan token per minggu, regresi linear atas `daily_snapshot` 28 hari terakhir.
- Tanggal proyeksi = hari ini + (target − cakupan sekarang) / laju.
- Status: "on track" bila tanggal proyeksi ≤ `phase1_deadline`; selain itu "tertinggal X minggu".
- Catatan: kurva cakupan berbasis frekuensi naik cepat di awal lalu melambat. Proyeksi linear akan terlalu optimistis di bulan-bulan awal, jadi tampilkan juga sisa lemma yang dibutuhkan untuk mencapai target.

## Urutan implementasi

Diagram asli bagian ini (enam milestone M0–M5) tidak ikut terekspor, jadi ditulis ulang di sini sebagai teks. Urutan sudah disesuaikan dengan kondisi repo per 15 Okt 2026 dan memakai penomoran `TASKS.md`. Status terkini selalu ada di `docs/PROJECT_CONTEXT.md` bagian 6 dan `TASKS.md`.

### Milestone spec dan statusnya di repo

| Milestone spec | Isi | Status di repo (15 Okt 2026) |
| --- | --- | --- |
| M0 Fondasi data | Skema + RLS, impor korpus, hitung `freq` dan peringkat | Selesai (TASKS M0–M1), kecuali tabel `data_source` |
| M1 FSRS + gerbang | F1 kartu + log review, F2 gerbang materi baru, uji unit `lib/engine` | Sebagian (TASKS M2). Belum: `review_logs` append-only, rumus gerbang final |
| M2 Akar + nahwu | F3 halaman akar + kuis pola, F4 unit nahwu-sharaf | Belum |
| M3 Baca ayat | F5 interlinear 114 surah, warna penguasaan, ketuk kata | Belum; butuh arti per kata lebih lengkap |
| M4 Tes ayat + dashboard | F6 penilai AI di Edge Function, F7 snapshot harian + proyeksi | Belum; F6 butuh secret API LLM dari pemilik |
| M5 Nice to have | N1–N7 sesuai urutan tabel | Belum |

Belajar harian sudah bisa dipakai sejak M1 (sesi `/belajar` sudah jalan). Milestone berikutnya dibangun sambil aplikasi dipakai.

### Pemetaan nama: spec ke repo

Skema contoh di atas memakai nama generik. Repo memakai nama lain dan **tidak diganti** (keputusan di `PROJECT_CONTEXT.md` bagian 4). Selalu pakai nama repo.

| Spec | Repo |
| --- | --- |
| `root`, `lemma`, `verse`, `token` | `roots`, `lemmas`, `ayahs`, `words` |
| `card` | `user_items` (status FSRS di kolom `fsrs` jsonb, level 0–3) |
| `review_log` | `review_logs` |
| `app_config` | `user_settings` (tambah kolom target) |
| `grammar_unit`, `quiz_item` | `lessons` dan `items` untuk pelajaran yang sudah ada; tabel baru hanya bila tidak cukup |
| `comprehension_test`, `daily_snapshot`, `data_source`, `tadabbur_note`, `grammar_progress` | Belum ada; buat dengan nama jamak (`comprehension_tests`, `daily_snapshots`, ...) |

### Paket kerja berikutnya (berurutan)

1. **P1 Penyelarasan (TASKS M3).** Prasyarat: keputusan 1–4 di `PROJECT_CONTEXT.md` bagian 9 sudah dijawab pemilik.
    - Migrasi baru: ganti policy `own_rows` di `review_logs` menjadi `select` + `insert` saja.
    - Migrasi baru: tabel `data_source`, `daily_snapshots`; kolom target di `user_settings` (`target_token_coverage`, `target_test_accuracy`, `daily_review_limit`, `phase1_start`, `phase1_deadline`).
    - Job `pg_cron` pukul 00.05 WIB (17.05 UTC) menulis snapshot harian.
    - `lib/engine/projection.ts` + uji unit, lalu kartu dashboard di beranda (F7 awal).
2. **P2 Arti kata + pembaca ayat (F5).** Perluas `content/glosses_id.tsv` sampai 700 lemma (≈85% token) dan minta pemilik meninjau kolom `reviewed`. Lalu halaman baca per surah dengan warna penguasaan dan panel ketuk kata.
3. **P3 Akar + nahwu (F3, F4).** Halaman akar dan kuis pola. Data sumber tidak punya wazan isim dan peran sintaksis; kuis pola memakai bentuk fi'il (VF 1–10), partisip aktif/pasif, dan masdar. Unit nahwu memakai `lessons`/`items` yang ada.
4. **P4 Tes ayat (F6) + dashboard lengkap (F7).** Edge Function penilai dengan secret API LLM (diisi pemilik di dashboard), tabel `comprehension_tests`, kata yang salah dicatat sebagai rating 1 di `review_logs`. Dashboard menampilkan lima ukuran, proyeksi, dan sisa lemma.
5. **P5 Nice to have (N1–N7).** Untuk pengingat, utamakan Telegram (lihat jebakan Web Push di `PROJECT_CONTEXT.md` bagian 7).

### Instruksi untuk coder AI

- Baca `CLAUDE.md` dan `docs/PROJECT_CONTEXT.md` sebelum mulai. Bila spec ini bertentangan dengan keputusan di PROJECT_CONTEXT atau `docs/DECISIONS.md`, keputusan tersebut yang berlaku.
- Satu paket kerja = satu atau beberapa PR kecil (branch → PR lewat `gh api` → squash merge ke `main`).
- Perubahan skema = file baru bernomor di `supabase/migrations/`, lalu diterapkan ke proyek (cara penerapan: lihat jebakan Supabase di PROJECT_CONTEXT bagian 7). Jangan ubah skema di dashboard.
- Logika di bagian "Logika inti" wajib punya uji unit di `lib/engine/__tests__` sebelum UI-nya dibuat.
- PR dianggap selesai bila kriteria penerimaan fitur terkait tercentang dan `npm run lint && npx tsc --noEmit && npm test && npm run build` lulus.
- Di PR yang sama, perbarui `TASKS.md` dan `docs/PROJECT_CONTEXT.md` (status, keputusan, jebakan, log sesi).
