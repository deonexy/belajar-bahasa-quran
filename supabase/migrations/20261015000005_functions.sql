-- Fungsi bantu aplikasi (security invoker: RLS tetap berlaku).

-- Hari-hari (zona waktu pengguna) yang punya review, untuk streak.
create or replace function review_days(p_tz text default 'Asia/Jakarta')
returns setof date
language sql stable security invoker set search_path = public as $$
  select distinct d from (
    select (reviewed_at at time zone p_tz)::date as d
    from review_logs where user_id = auth.uid()
  ) x order by d desc limit 400;
$$;

-- Kandidat item baru: lemma yang sudah punya gloss, dan pelajaran, yang belum dibuka.
create or replace function new_item_candidates(p_limit int default 20)
returns table (id bigint, kind text, ref_id bigint, phase smallint, seq int, prereq_item_ids bigint[])
language sql stable security invoker set search_path = public as $$
  select i.id, i.kind, i.ref_id, i.phase, i.seq, i.prereq_item_ids
  from items i
  left join lemmas l on i.kind = 'lemma' and l.id = i.ref_id
  where i.kind in ('lemma', 'lesson')
    and (i.kind = 'lesson' or l.gloss_id is not null)
    and not exists (
      select 1 from user_items ui where ui.user_id = auth.uid() and ui.item_id = i.id)
  order by i.seq
  limit p_limit;
$$;

-- Ayat yang terbuka otomatis: >= 85% kata berlemma sudah mastered (SPEC 6.7).
create or replace function openable_ayah_items(p_limit int default 3)
returns table (item_id bigint)
language sql stable security invoker set search_path = public as $$
  select i.id
  from items i
  join ayahs a on i.kind = 'ayah' and i.ref_id = a.surah * 1000 + a.ayah
  cross join lateral (
    select count(*) as total,
           count(*) filter (where ul.status = 'mastered') as ok
    from words w
    join items li on li.kind = 'lemma' and li.ref_id = w.lemma_id
    left join user_items ul on ul.item_id = li.id and ul.user_id = auth.uid()
    where w.surah = a.surah and w.ayah = a.ayah and w.lemma_id is not null
  ) s
  where s.total > 0 and s.ok::numeric / s.total >= 0.85
    and not exists (
      select 1 from user_items ui where ui.user_id = auth.uid() and ui.item_id = i.id)
  order by i.seq
  limit p_limit;
$$;
