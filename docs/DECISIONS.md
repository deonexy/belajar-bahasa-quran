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
