-- M3: penyelarasan dengan docs/SPEC_FASE1.md (lihat docs/PROJECT_CONTEXT.md bagian 9).
-- Catatan: RLS review_logs append-only ada di supabase/pending/ (menunggu persetujuan pemilik).

-- 1. Target dan batas per pengguna (disimpan di data, bukan di kode).
alter table user_settings
  add column target_token_coverage numeric not null default 0.85,
  add column target_test_accuracy numeric not null default 0.80,
  add column daily_review_limit int not null default 150,
  add column phase1_deadline date;

-- 2. Daftar sumber data untuk audit lisensi.
create table data_source (
  name text primary key,
  version text,
  url text,
  license text,
  note text,
  imported_at timestamptz not null default now()
);
alter table data_source enable row level security;
create policy read_content on data_source for select to authenticated using (true);
insert into data_source (name, version, url, license, note) values
  ('quran-morphology (QAC)', 'master, mirror mustafa0x', 'https://github.com/mustafa0x/quran-morphology',
   'GPL (belum diverifikasi)', 'Morfologi per kata: lemma, akar, POS, fitur. Cek dampak lisensi sebelum repo publik.'),
  ('teks Utsmani Hafs', 'mirror fawazahmed0/quran-api (ara-quranuthmanihaf)', 'https://github.com/fawazahmed0/quran-api',
   'belum diverifikasi', 'Teks ayat. Bukan langsung dari Tanzil; atribusi perlu dilengkapi.'),
  ('terjemah Indonesia (Kemenag)', 'mirror fawazahmed0/quran-api (ind-indonesianislam)', 'https://github.com/fawazahmed0/quran-api',
   'belum diverifikasi', 'Terjemah per ayat.'),
  ('gloss lemma (draf)', 'draf Claude, belum ditinjau', 'content/glosses_id.tsv',
   'milik proyek', 'Arti Indonesia per lemma; kolom reviewed menandai yang sudah ditinjau pemilik.');

-- 3. daily_stats dipakai sebagai snapshot harian (spec: daily_snapshot).
alter table daily_stats
  add column roots_mastered int,
  add column test_accuracy_4w numeric;

-- 4. Dikuasai = level 3 + stabilitas >= 21 hari + tanpa lapse 30 hari (disimpan sebagai status)
--    DAN masih terjaga: retrievability >= 0,9. Pada retensi target 0,9, FSRS memberi R = 0,9
--    tepat saat t = S, jadi R >= 0,9 setara dengan (hari sejak review terakhir) <= S.
create or replace view v_user_coverage with (security_invoker = true) as
select
  ui.user_id,
  coalesce(sum(l.freq), 0)::numeric as mastered_freq,
  (select value from corpus_meta where key = 'quran_total_words') as total_words,
  case
    when coalesce((select value from corpus_meta where key = 'quran_total_words'), 0) = 0 then 0
    else coalesce(sum(l.freq), 0)::numeric
         / (select value from corpus_meta where key = 'quran_total_words') * 100
  end as coverage_pct,
  count(*)::int as lemmas_mastered
from user_items ui
join items i on i.id = ui.item_id and i.kind = 'lemma'
join lemmas l on l.id = i.ref_id
where ui.status = 'mastered'
  and (ui.fsrs->>'last_review') is not null
  and (ui.fsrs->>'last_review')::timestamptz
      + ((ui.fsrs->>'stability')::float8 * interval '1 day') >= now()
group by ui.user_id;

-- 5. Snapshot harian. p_date null = hari ini (zona waktu pengguna); cron mengirim kemarin.
create or replace function take_daily_snapshot(p_user uuid, p_date date default null)
returns void
language plpgsql security invoker set search_path = public as $$
declare
  v_tz text;
  v_date date;
  v_total numeric;
  v_mastered_freq numeric := 0;
  v_lemmas int := 0;
  v_roots int := 0;
  v_comp numeric;
  v_ayahs int;
  v_reviews int;
  v_correct int;
  v_new int;
begin
  if auth.uid() is not null and auth.uid() <> p_user then
    raise exception 'tidak boleh membuat snapshot pengguna lain';
  end if;

  select coalesce((select timezone from user_settings where user_id = p_user), 'Asia/Jakarta') into v_tz;
  v_date := coalesce(p_date, (now() at time zone v_tz)::date);
  select value into v_total from corpus_meta where key = 'quran_total_words';

  select coalesce(sum(l.freq), 0), count(*), count(distinct l.root_id)
    into v_mastered_freq, v_lemmas, v_roots
  from user_items ui
  join items i on i.id = ui.item_id and i.kind = 'lemma'
  join lemmas l on l.id = i.ref_id
  where ui.user_id = p_user and ui.status = 'mastered'
    and (ui.fsrs->>'last_review') is not null
    and (ui.fsrs->>'last_review')::timestamptz
        + ((ui.fsrs->>'stability')::float8 * interval '1 day') >= now();

  select case when sum(l.freq) > 0 then
           sum(l.freq * (ui.level / 3.0) * least(1, (ui.fsrs->>'stability')::float8 / 21)) / sum(l.freq) * 100
         end
    into v_comp
  from user_items ui
  join items i on i.id = ui.item_id and i.kind = 'lemma'
  join lemmas l on l.id = i.ref_id
  where ui.user_id = p_user;

  select count(*) into v_ayahs
  from user_items ui join items i on i.id = ui.item_id and i.kind = 'ayah'
  where ui.user_id = p_user;

  select count(*), count(*) filter (where correct) into v_reviews, v_correct
  from review_logs
  where user_id = p_user and (reviewed_at at time zone v_tz)::date = v_date;

  select count(*) into v_new
  from user_items where user_id = p_user and (unlocked_at at time zone v_tz)::date = v_date;

  insert into daily_stats (user_id, stat_date, reviews, new_items, retention,
                           lemmas_mastered, coverage_pct, comprehension, ayahs_open, roots_mastered)
  values (p_user, v_date, v_reviews, v_new,
          case when v_reviews > 0 then v_correct::numeric / v_reviews end,
          v_lemmas,
          case when coalesce(v_total, 0) > 0 then v_mastered_freq / v_total * 100 else 0 end,
          v_comp, v_ayahs, v_roots)
  on conflict (user_id, stat_date) do update set
    reviews = excluded.reviews, new_items = excluded.new_items, retention = excluded.retention,
    lemmas_mastered = excluded.lemmas_mastered, coverage_pct = excluded.coverage_pct,
    comprehension = excluded.comprehension, ayahs_open = excluded.ayahs_open,
    roots_mastered = excluded.roots_mastered;
end;
$$;

-- Hanya cron (postgres) yang boleh memanggil untuk semua pengguna; pengguna hanya untuk dirinya.
revoke all on function take_daily_snapshot(uuid, date) from public, anon;
grant execute on function take_daily_snapshot(uuid, date) to authenticated;

-- 6. Berapa lemma lagi (urut frekuensi) agar cakupan mencapai target.
create or replace function lemmas_needed_for_target(p_target numeric)
returns int
language sql stable security invoker set search_path = public as $$
  with total as (select value as t from corpus_meta where key = 'quran_total_words'),
  cur as (
    select coalesce(sum(l.freq), 0) as mf
    from user_items ui
    join items i on i.id = ui.item_id and i.kind = 'lemma'
    join lemmas l on l.id = i.ref_id
    where ui.user_id = auth.uid() and ui.status = 'mastered'
      and (ui.fsrs->>'last_review') is not null
      and (ui.fsrs->>'last_review')::timestamptz
          + ((ui.fsrs->>'stability')::float8 * interval '1 day') >= now()
  ),
  rest as (
    select l.freq,
           sum(l.freq) over (order by l.freq desc, l.freq_rank) as cum
    from lemmas l
    where not exists (
      select 1 from items i
      join user_items ui on ui.item_id = i.id and ui.user_id = auth.uid() and ui.status = 'mastered'
      where i.kind = 'lemma' and i.ref_id = l.id)
  )
  select count(*)::int
  from rest, cur, total
  where cur.mf + (rest.cum - rest.freq) < p_target * total.t;
$$;

-- 7. Perkiraan review 7 hari ke depan (untuk gerbang).
create or replace function reviews_due_within(p_days int)
returns int
language sql stable security invoker set search_path = public as $$
  select count(*)::int from user_items
  where user_id = auth.uid() and status <> 'suspended'
    and due_at <= now() + make_interval(days => p_days);
$$;

-- 8. Cron harian 00.05 WIB (17.05 UTC): snapshot penutup hari kemarin untuk semua pengguna.
create extension if not exists pg_cron;
select cron.schedule(
  'daily-snapshot',
  '5 17 * * *',
  $cron$
  select take_daily_snapshot(u.user_id, ((now() at time zone coalesce(s.timezone, 'Asia/Jakarta'))::date - 1))
  from (select distinct user_id from user_items) u
  left join user_settings s on s.user_id = u.user_id;
  $cron$
);
