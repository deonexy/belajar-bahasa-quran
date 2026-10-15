-- M5/O1 fondasi lokal: dukungan sinkron untuk penyimpanan lokal di perangkat (lihat docs/DECISIONS.md).
-- Hanya menambah: satu kolom, dua fungsi baca. Tidak mengubah perilaku yang sudah ada.

-- 1. Jawaban pola kini ditulis lokal dulu lalu dikirim saat online: butuh kunci idempotensi
--    agar pengiriman ulang tidak menggandakan (sama seperti review_logs.client_id).
alter table pola_attempts add column if not exists client_id uuid unique;

-- 2. Versi konten per kelompok. Klien membandingkan dengan versi tersimpan dan memperbarui
--    otomatis (tanpa bertanya) bila berbeda. Hash berubah bila isi berubah, termasuk arti
--    yang diedit atau ditandai `gloss_reviewed`.
create or replace function content_versions()
returns table (key text, version text)
language sql stable security invoker set search_path = public as $$
  select 'lemmas'::text,
         md5(coalesce(string_agg(
           id::text || ':' || lemma_ar || ':' || pos || ':' || gloss_id || ':' || gloss_reviewed::text
             || ':' || coalesce(root_id::text, '') || ':' || freq::text || ':' || coalesce(freq_rank::text, ''),
           '|' order by id), ''))
  from lemmas where gloss_id is not null
  union all
  select 'roots'::text,
         md5(coalesce(string_agg(id::text || ':' || root_ar, '|' order by id), ''))
  from roots
  union all
  select 'lessons'::text,
         md5(coalesce(string_agg(
           id::text || ':' || code || ':' || title || ':' || md5(body_md) || ':' || md5(exercises::text),
           '|' order by id), ''))
  from lessons;
$$;

-- 3. Contoh ayat terpendek per lemma, beserta kata-katanya (untuk kartu belajar offline).
--    Dipanggil hanya untuk lemma yang sudah dibuka pengguna, dalam potongan kecil.
create or replace function lemma_examples(p_lemma_ids bigint[])
returns table (lemma_id int, surah smallint, ayah smallint, translation_id text, words jsonb)
language sql stable security invoker set search_path = public as $$
  with best as (
    select distinct on (w.lemma_id) w.lemma_id, a.surah, a.ayah, a.translation_id
    from words w
    join ayahs a on a.surah = w.surah and a.ayah = w.ayah
    where w.lemma_id = any (p_lemma_ids)
    order by w.lemma_id, length(a.text_ar), a.surah, a.ayah
  )
  select b.lemma_id, b.surah, b.ayah, b.translation_id,
         (select jsonb_agg(jsonb_build_object('t', x.text_ar, 'g', x.gloss_id, 'l', x.lemma_id)
                           order by x.position)
            from words x where x.surah = b.surah and x.ayah = b.ayah) as words
  from best b;
$$;
