-- Tabel konten (read-only bagi aplikasi). SPEC bagian 5.

create table corpus_meta (
  key text primary key,
  value numeric not null
);

create table roots (
  id serial primary key,
  root_ar text unique not null,
  root_bw text,
  meaning_core text
);

create table lemmas (
  id serial primary key,
  lemma_ar text not null,
  lemma_bw text unique not null,
  root_id int references roots,
  pos text not null,
  wazan text,
  gloss_id text,
  source text not null default 'qac',
  freq int not null default 0,
  freq_rank int
);
create index lemmas_freq_rank_idx on lemmas (freq_rank);

create table ayahs (
  surah smallint not null,
  ayah smallint not null,
  text_ar text not null,
  translation_id text not null,
  audio_url text,
  primary key (surah, ayah)
);

create table words (
  id bigserial primary key,
  surah smallint not null,
  ayah smallint not null,
  position smallint not null,
  text_ar text not null,
  lemma_id int references lemmas,
  root_id int references roots,
  gloss_id text,
  morph jsonb not null,
  unique (surah, ayah, position),
  foreign key (surah, ayah) references ayahs
);
create index words_lemma_idx on words (lemma_id);

create table lessons (
  id serial primary key,
  code text unique not null,
  phase smallint not null default 1,
  kind text not null check (kind in ('nahwu','sharaf','partikel')),
  title text not null,
  body_md text not null,
  exercises jsonb not null default '[]'
);

create table items (
  id bigserial primary key,
  kind text not null check (kind in
    ('lemma','lesson','ayah','text_word','sentence','audio','dialog')),
  ref_id bigint not null,
  phase smallint not null default 1,
  seq int not null,
  prereq_item_ids bigint[] not null default '{}',
  unique (kind, ref_id)
);
create index items_phase_seq_idx on items (phase, seq);

-- RLS: konten boleh dibaca semua pengguna terautentikasi, tidak boleh ditulis dari klien.
alter table corpus_meta enable row level security;
alter table roots enable row level security;
alter table lemmas enable row level security;
alter table ayahs enable row level security;
alter table words enable row level security;
alter table lessons enable row level security;
alter table items enable row level security;

create policy read_content on corpus_meta for select to authenticated using (true);
create policy read_content on roots for select to authenticated using (true);
create policy read_content on lemmas for select to authenticated using (true);
create policy read_content on ayahs for select to authenticated using (true);
create policy read_content on words for select to authenticated using (true);
create policy read_content on lessons for select to authenticated using (true);
create policy read_content on items for select to authenticated using (true);
