-- Tabel pengguna (RLS: user_id = auth.uid()). SPEC bagian 5.

create table user_settings (
  user_id uuid primary key references auth.users on delete cascade,
  timezone text not null default 'Asia/Jakarta',
  daily_new_max smallint not null default 5,
  target_retention numeric not null default 0.90,
  reminder_time time not null default '05:30',
  reminder_channels text[] not null default '{push,telegram}',
  telegram_chat_id text,
  phase smallint not null default 1,
  start_date date not null default current_date
);

create table user_items (
  user_id uuid not null references auth.users on delete cascade,
  item_id bigint not null references items,
  status text not null default 'learning'
    check (status in ('learning','review','mastered','suspended')),
  level smallint not null default 0,
  ever_reached_one boolean not null default false,
  fsrs jsonb not null,
  due_at timestamptz not null,
  priority boolean not null default false,
  unlocked_at timestamptz not null default now(),
  mastered_at timestamptz,
  primary key (user_id, item_id)
);
create index user_items_due_idx on user_items (user_id, due_at);

create table review_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  item_id bigint not null references items,
  exercise_type text not null check (exercise_type in
    ('recognize','recall','context','translate','listen','speak')),
  correct boolean not null,
  rating smallint not null check (rating between 1 and 4),
  response_ms int,
  level_before smallint,
  level_after smallint,
  fsrs_before jsonb,
  fsrs_after jsonb,
  reviewed_at timestamptz not null default now(),
  client_id uuid unique
);
create index review_logs_user_time_idx on review_logs (user_id, reviewed_at);

create table daily_plans (
  user_id uuid not null references auth.users on delete cascade,
  plan_date date not null,
  retention_7d numeric,
  backlog int,
  learning_pile int,
  new_quota smallint not null,
  reason text not null,
  session_done boolean not null default false,
  primary key (user_id, plan_date)
);

create table daily_stats (
  user_id uuid not null references auth.users on delete cascade,
  stat_date date not null,
  reviews int,
  new_items int,
  minutes int,
  retention numeric,
  lemmas_mastered int,
  coverage_pct numeric,
  comprehension numeric,
  ayahs_open int,
  streak int,
  primary key (user_id, stat_date)
);

create table push_subscriptions (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  endpoint text unique not null,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create table ai_usage (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  feature text not null,
  model text not null,
  input_tokens int,
  output_tokens int,
  cost_idr numeric,
  created_at timestamptz not null default now()
);

alter table user_settings enable row level security;
alter table user_items enable row level security;
alter table review_logs enable row level security;
alter table daily_plans enable row level security;
alter table daily_stats enable row level security;
alter table push_subscriptions enable row level security;
alter table ai_usage enable row level security;

create policy own_rows on user_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on user_items for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on review_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on daily_plans for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on daily_stats for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy own_rows on ai_usage for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Cakupan: bobot frekuensi lemma mastered / total kata Al-Qur'an (SPEC bagian 8).
create view v_user_coverage with (security_invoker = true) as
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
group by ui.user_id;
