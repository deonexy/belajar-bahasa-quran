-- Sumber morfologi memakai aksara Arab (bukan Buckwalter): kunci lemma = (lemma_ar, pos).
alter table lemmas drop constraint lemmas_lemma_bw_key;
alter table lemmas alter column lemma_bw drop not null;
alter table lemmas add constraint lemmas_lemma_ar_pos_key unique (lemma_ar, pos);
alter table lemmas add column gloss_reviewed boolean not null default false;

-- Urutan pembukaan pelajaran (dipakai saat membangun items).
alter table lessons add column seq int not null default 0;

create index words_ayah_idx on words (surah, ayah);
