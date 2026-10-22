# Belajar Bahasa Al-Qur'an

Aplikasi web gratis untuk belajar memahami kata dan kalimat bahasa Arab Al-Qur'an secara bertahap. Materi baru hanya terbuka bila pemahaman materi sebelumnya terbukti (mastery gate), dilengkapi pengulangan berjarak (FSRS), streak, dan laporan perkembangan.

Setiap orang menjalankan **salinan sendiri** (Vercel + Supabase, paket gratis), dengan database dan akun sendiri. Data belajar tiap orang tidak tercampur.

> **Catatan konten.** Isi pelajaran nahwu-sharaf dan arti kata (Indonesia) adalah **draf yang ditulis AI dan belum ditinjau ustaz**. Gunakan sebagai alat bantu belajar, bukan rujukan final; cek ulang ke guru atau kitab. Peninjauan masih berjalan (lihat [`TASKS.md`](TASKS.md)).

## Fitur yang sudah berjalan

**Belajar**
- **Sesi belajar** (`/belajar`): review jatuh tempo, kartu kata baru, latihan bertingkat (kenali → ingat → konteks → acak), pelajaran dengan soal latihan, dan terjemah ayat dengan penilaian mandiri. Jadwal ulang memakai FSRS.
- **Mastery gate**: jumlah kata baru per hari menyesuaikan akurasi 7 hari, tumpukan review, dan kata yang belum kokoh. Ayat terbuka otomatis setelah hampir semua katanya dikuasai.
- **Pelajaran nahwu-sharaf** (`/pelajaran`): daftar semua pelajaran yang sudah dibuka beserta persen pemahaman, dan bisa dibaca ulang kapan saja. Saat ini 11 pelajaran (jenis kata, huruf yang menempel, dhamir, tasrif, isim isyarah, maushul, jumlah ismiyah/fi'liyah, idhafah, na't, i'rab dasar).
- **Kosakata** (`/kosakata`): semua kata yang sudah dipelajari dengan persen pemahaman, level, dan jadwal ulang; bisa dicari, difilter, dan diurutkan.
- **Kuis** (`/kuis`): 10 soal acak dari kata yang pernah dijawab; hasilnya memengaruhi level dan jadwal.
- **Kuis pola kata** (`/pola`): mengenali bentuk kata kerja, partisip, dan masdar. Jawaban tersimpan dan ikut dihitung di tingkat pemahaman.

**Membaca**
- **Pembaca ayat interlinear** (`/baca`): seluruh 114 surah, kata diwarnai menurut tingkat penguasaan (kata belum dipelajari berbingkai putus-putus), opsi menyembunyikan arti/terjemah, ketuk kata untuk lemma, akar, dan ciri morfologi, serta tombol tambah ke review.
- **Halaman akar** (`/akar/[akar]`): semua lema dari satu akar kata beserta jumlah kemunculannya.
- Tombol salin ayat dan arti pada contoh kata.

**Perkembangan**
- **Beranda**: kuota hari ini, streak (4 tingkat warna), penguasaan kata, jumlah kata dipelajari, persentase kata Al-Qur'an yang sudah dikenali, dan tingkat pemahaman gabungan (cakupan kata, kekuatan ingatan, retensi, tata bahasa, ayat).
- **Target** (`/dashboard`): kurva cakupan harian, proyeksi tercapainya target, dan jumlah unit pelajaran lulus. Snapshot harian dibuat otomatis oleh `pg_cron`.

**Lainnya**
- Login email + kata sandi, pendaftaran (`/register`), dan Google (opsional).
- **PWA**: bisa dipasang di layar utama ponsel, dengan halaman offline sederhana. Belajar penuh tanpa internet belum ada.
- Korpus: 77.429 kata, 4.815 lemma, 1.651 akar, 6.236 ayat; 700 lemma teratas sudah berarti (±85% kata Al-Qur'an).

**Belum ada** (rencana di [`TASKS.md`](TASKS.md)): pengingat (Web Push/Telegram), tes pemahaman ayat dengan AI, belajar penuh offline, audio murattal.

## Pasang aplikasimu sendiri (gratis)

Yang dibutuhkan: akun [GitHub](https://github.com), [Supabase](https://supabase.com), dan [Vercel](https://vercel.com) (semuanya paket gratis), serta [Node.js](https://nodejs.org) 22 di komputer (hanya untuk menjalankan Supabase CLI, tanpa perlu Docker).

### 1. Fork repo ini

Klik **Fork** di GitHub. Gunakan **fork**, jangan "Use this template" atau tombol clone dari Vercel: salinan semacam itu terputus dari repo asli, sehingga tidak bisa menerima pembaruan (lihat [Memperbarui](#memperbarui)).

Lalu clone fork-mu dan masuk ke foldernya:

```bash
git clone https://github.com/<username-kamu>/belajar-bahasa-quran.git
cd belajar-bahasa-quran
```

### 2. Buat proyek Supabase

1. Di [dashboard Supabase](https://supabase.com/dashboard) buat proyek baru (paket Free). Pilih region terdekat (mis. Singapore) dan simpan **Database Password**.
2. Catat tiga nilai dari **Project Settings → API / API Keys**: **Project URL**, kunci **anon / publishable**, dan **Project ref** (bagian awal URL: `https://<project-ref>.supabase.co`).

### 3. Buat tabel dan fungsi database

```bash
npx supabase login
npx supabase link --project-ref <project-ref>   # diminta Database Password
npx supabase db push                             # menerapkan semua file di supabase/migrations/
```

### 4. Isi pelajaran awal

Buka **SQL Editor** di dashboard Supabase, tempel isi berkas ini lalu **Run**:

- `supabase/seed/lessons.sql`

Urutan ini penting: impor korpus (langkah 5) membuat daftar item dari pelajaran yang sudah ada.

### 5. Impor korpus Al-Qur'an

Fungsi `import-corpus` mengunduh morfologi, teks Arab, dan terjemah dari sumber publik di GitHub langsung ke database-mu (data tidak disimpan di repo ini).

```bash
npx supabase functions deploy import-corpus --project-ref <project-ref> --no-verify-jwt
curl -X POST "https://<project-ref>.supabase.co/functions/v1/import-corpus"
```

Jawaban `{"started":true}` berarti impor berjalan di latar belakang (beberapa menit). Pantau di SQL Editor:

```sql
select at, msg from import_log order by id;
```

Selesai bila baris terakhir berbunyi `impor selesai`. Bila ada baris `GAGAL: ...`, jalankan ulang perintah `curl` (aman diulang; fungsi berhenti sendiri bila impor sudah lengkap). Setelah selesai, fungsi ini boleh dihapus: `npx supabase functions delete import-corpus --project-ref <project-ref>`.

### 6. Isi arti kata dan pelajaran nahwu-sharaf

Di **SQL Editor**, jalankan berkas-berkas ini **berurutan**:

1. `supabase/seed/gloss_backfill.sql`
2. `supabase/seed/glosses_321_700.sql`
3. `supabase/seed/lessons_nahwu_sharaf.sql`

Periksa hasilnya:

```sql
select
  (select count(*) from words)                       as kata,      -- 77429
  (select count(*) from lemmas)                      as lemma,     -- 4815
  (select count(*) from ayahs)                       as ayat,      -- 6236
  (select count(*) from lemmas where gloss_id is not null) as ber_arti,  -- 700
  (select count(*) from items where kind = 'lesson') as pelajaran; -- 11
```

### 7. Deploy ke Vercel

1. Di [vercel.com/new](https://vercel.com/new) pilih **Import Git Repository** dan pilih **fork-mu**. Framework terdeteksi otomatis (Next.js).
2. Isi **Environment Variables**:

   | Nama | Nilai |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL dari langkah 2 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | kunci anon / publishable dari langkah 2 |

3. Klik **Deploy**. Catat alamatnya (mis. `https://nama-proyek.vercel.app`).

Jangan pernah memasang `service_role` / secret key di Vercel atau di repo; aplikasi tidak membutuhkannya.

### 8. Atur login di Supabase

Di **Authentication → URL Configuration**:

- **Site URL**: alamat Vercel-mu.
- **Redirect URLs**: tambahkan `https://<alamat-vercel-mu>/auth/callback` (dan `http://localhost:3000/auth/callback` bila ingin mencoba lokal).

Di **Authentication → Sign In / Providers**:

- **Email**: bila email konfirmasi tidak terkirim (batas kirim paket gratis kecil), matikan *Confirm email* untuk pemakaian pribadi.
- **Google** (opsional): isi Client ID dan Secret dari Google Cloud Console, dengan redirect URI yang ditampilkan Supabase.
- Bila aplikasi hanya untukmu, matikan *Allow new users to sign up* setelah akunmu dibuat.

### 9. Mulai belajar

Buka alamat Vercel-mu, daftar di `/register`, lalu tekan **Mulai belajar**.

### Menjalankan lokal (opsional)

```bash
cp .env.example .env.local   # isi dua nilai Supabase dari langkah 2
npm install
npm run dev                  # http://localhost:3000
```

Pengecekan sebelum push: `npm run lint && npx tsc --noEmit && npm test && npm run build`. Catatan: `npx next typegen` perlu dijalankan sekali agar `tsc` mengenali tipe rute. Tes `supabase/functions/import-corpus/parse.test.ts` butuh berkas mentah korpus di `data/raw/` yang tidak disertakan di repo, jadi gagal di instalasi baru.

## Memperbarui

Pembaruan dari repo asli sampai ke aplikasimu lewat fork:

1. Di halaman fork-mu di GitHub, klik **Sync fork → Update branch** (atau `gh repo sync <username-kamu>/belajar-bahasa-quran`).
2. Vercel otomatis membangun dan men-deploy ulang setiap ada perubahan di `main` fork-mu. Tidak ada yang perlu dilakukan di Vercel.
3. Jalankan `npx supabase db push` untuk menerapkan migrasi baru, bila ada. Perintah ini hanya menerapkan file yang belum pernah diterapkan, jadi aman dijalankan setiap kali selesai sync.
4. Bila pembaruan menambah atau mengubah berkas di `supabase/seed/`, jalankan berkas itu di SQL Editor. Berkas pelajaran (`lessons*.sql`) idempoten: isinya diperbarui dan progres belajarmu tidak terhapus. Berkas arti kata hanya mengisi arti yang masih kosong, jadi revisi arti yang sudah terisi akan disertai petunjuk tersendiri.

Pembaruan **tidak** otomatis tanpa langkah 1: GitHub tidak menyamakan fork secara otomatis. Jangan mengubah kode di fork-mu bila ingin sync tanpa konflik; simpan kustomisasi di branch lain.

**Untuk pemilik repo asli:** agar semua fork tetap bisa diperbarui, jangan mengubah file migrasi yang sudah dirilis. Setiap perubahan skema harus berupa file baru di `supabase/migrations/` dengan nomor berurutan.

## Batas paket gratis

Berdasarkan kebijakan saat ini (cek halaman harga masing-masing, bisa berubah):

- **Supabase Free**: proyek dijeda bila tidak ada aktivitas sekitar seminggu (bisa dipulihkan dari dashboard, data tetap ada); database 500 MB (aplikasi ini memakai puluhan MB).
- **Vercel Hobby**: untuk pemakaian pribadi non-komersial.

## Dokumentasi pengembangan

- [`docs/PROJECT_CONTEXT.md`](docs/PROJECT_CONTEXT.md): konteks, arsitektur, jebakan, dan log sesi (baca ini dulu bila ingin ikut mengembangkan).
- [`docs/DECISIONS.md`](docs/DECISIONS.md): keputusan teknis. [`docs/SPEC_FASE1.md`](docs/SPEC_FASE1.md): spesifikasi fitur. [`TASKS.md`](TASKS.md): status pekerjaan.
- Stack: Next.js 16, React 19, Tailwind 4, Supabase (Postgres, Auth, Edge Functions), ts-fsrs, Vitest.

## Lisensi dan sumber data

Kode: [GNU GPL v3](LICENSE).

Data korpus diunduh saat impor dari mirror GitHub: morfologi Quranic Arabic Corpus (`mustafa0x/quran-morphology`) dan teks Utsmani Hafs serta terjemah Indonesia (`fawazahmed0/quran-api`). **Lisensi masing-masing sumber belum diverifikasi sepenuhnya**; cek sebelum membuka layanan ini untuk umum. Rincian di tabel `data_source` dan `docs/DECISIONS.md`.
