-- Jawaban kuis pola kata (F3), dipakai untuk skor tata bahasa di beranda. Append-only (select + insert).
create table if not exists pola_attempts (
  id bigserial primary key,
  user_id uuid not null references auth.users on delete cascade,
  category text not null,
  correct boolean not null,
  answered_at timestamptz not null default now()
);
create index if not exists pola_attempts_user_time_idx on pola_attempts (user_id, answered_at);
alter table pola_attempts enable row level security;
create policy pola_select on pola_attempts for select to authenticated using (user_id = auth.uid());
create policy pola_insert on pola_attempts for insert to authenticated with check (user_id = auth.uid());
