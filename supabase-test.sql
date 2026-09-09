-- PRICODE: Supabase Infrastructure Verification Table
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)

-- 1. Create minimal test table
create table if not exists test_connection (
  id bigint primary key generated always as identity,
  created_at timestamptz default now(),
  message text not null
);

-- 2. Enable Row Level Security (RLS)
alter table test_connection enable row level security;

-- 3. Allow anonymous public read access so the test page can query without auth
create policy "Allow anonymous read" on test_connection
  for select to anon using (true);

-- 4. Insert an initial test row
insert into test_connection (message)
values ('Hello from Supabase! Connection verified successfully.');

