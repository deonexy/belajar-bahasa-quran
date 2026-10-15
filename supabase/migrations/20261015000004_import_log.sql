-- Log impor korpus (hanya diakses service role; RLS aktif tanpa policy).
create table import_log (
  id bigserial primary key,
  at timestamptz not null default now(),
  msg text not null
);
alter table import_log enable row level security;

create extension if not exists pg_net with schema extensions;
