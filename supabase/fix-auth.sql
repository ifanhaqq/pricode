-- ==============================================================================
-- PRICODE: Fix Supabase Auth Schema & Identities for Test Users
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Fix NULL token columns on auth.users (GoTrue fails with 'Database error querying schema' when these are NULL)
update auth.users
set 
  confirmation_token = coalesce(confirmation_token, ''),
  recovery_token = coalesce(recovery_token, ''),
  email_change_token_new = coalesce(email_change_token_new, ''),
  email_change_token_current = coalesce(email_change_token_current, ''),
  email_change = coalesce(email_change, ''),
  phone_change = coalesce(phone_change, ''),
  phone_change_token = coalesce(phone_change_token, ''),
  reauthentication_token = coalesce(reauthentication_token, ''),
  is_sso_user = false
where email in ('admin_test@pricode.local', 'student1_test@pricode.local', 'student2_test@pricode.local');

-- 2. Ensure each test user has a corresponding row in auth.identities
-- (GoTrue requires this to authenticate email/password logins)
delete from auth.identities
where user_id in (
  select id from auth.users where email in ('admin_test@pricode.local', 'student1_test@pricode.local', 'student2_test@pricode.local')
);

insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  id,
  id,
  format('{"sub":"%s","email":"%s"}', id::text, email)::jsonb,
  'email',
  id::text,
  now(),
  now(),
  now()
from auth.users
where email in ('admin_test@pricode.local', 'student1_test@pricode.local', 'student2_test@pricode.local');
