-- ==============================================================================
-- PRICODE: Admin Student Management Database Functions
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- ─── 1. FUNCTION: admin_create_student ─────────────────────────────────────────
-- Allows an authenticated Admin to create a student account directly
-- with username + password (using synthetic email username@codingclub.scr)

create or replace function public.admin_create_student(
  p_username text,
  p_name text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_synthetic_email text;
  v_user_id uuid;
  v_student_id uuid;
  v_clean_username text;
  v_encrypted_pw text;
begin
  -- 1. Security Check: Only Admin can execute this function
  if not public.is_admin() then
    raise exception 'Akses ditolak: Hanya Admin yang dapat mendaftarkan siswa.';
  end if;

  -- 2. Validate input
  v_clean_username := lower(trim(p_username));
  if length(v_clean_username) < 3 then
    raise exception 'Username minimal 3 karakter.';
  end if;

  if trim(p_name) = '' then
    raise exception 'Nama siswa tidak boleh kosong.';
  end if;

  if length(p_password) < 6 then
    raise exception 'Password minimal 6 karakter.';
  end if;

  v_synthetic_email := v_clean_username || '@codingclub.scr';

  -- 3. Check if username or email is already taken
  if exists (select 1 from auth.users where email = v_synthetic_email) then
    raise exception 'Username "%" sudah terdaftar. Silakan pilih username lain.', v_clean_username;
  end if;

  v_encrypted_pw := crypt(p_password, gen_salt('bf'));
  v_user_id := gen_random_uuid();

  -- 4. Create user in auth.users with empty string tokens (avoids GoTrue scan errors)
  insert into auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change_token_current,
    email_change,
    phone_change,
    phone_change_token,
    reauthentication_token,
    is_sso_user
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_synthetic_email,
    v_encrypted_pw,
    now(),
    '{"provider":"email","providers":["email"]}',
    jsonb_build_object('name', p_name, 'username', v_clean_username),
    now(),
    now(),
    '', '', '', '', '', '', '', '', false
  );

  -- 5. Insert matching identity in auth.identities
  insert into auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) values (
    v_user_id,
    v_user_id,
    format('{"sub":"%s","email":"%s"}', v_user_id::text, v_synthetic_email)::jsonb,
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- 6. Assign student role in public.user_roles
  insert into public.user_roles (user_id, role)
  values (v_user_id, 'student')
  on conflict (user_id) do update set role = 'student';

  -- 7. Create profile row in public.students
  insert into public.students (name, auth_id)
  values (trim(p_name), v_user_id)
  returning id into v_student_id;

  return jsonb_build_object(
    'success', true,
    'student_id', v_student_id,
    'username', v_clean_username,
    'name', trim(p_name)
  );
end;
$$;


-- ─── 2. FUNCTION: admin_reset_student_password ─────────────────────────────────
-- Allows an authenticated Admin to reset any student's password directly

create or replace function public.admin_reset_student_password(
  p_student_id uuid,
  p_new_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_auth_id uuid;
  v_encrypted_pw text;
begin
  -- 1. Security Check: Only Admin can execute this function
  if not public.is_admin() then
    raise exception 'Akses ditolak: Hanya Admin yang dapat mereset password siswa.';
  end if;

  -- 2. Validate password
  if length(p_new_password) < 6 then
    raise exception 'Password baru minimal 6 karakter.';
  end if;

  -- 3. Lookup student's auth_id
  select auth_id into v_auth_id
  from public.students
  where id = p_student_id;

  if v_auth_id is null then
    raise exception 'Siswa tidak ditemukan.';
  end if;

  -- 4. Update password in auth.users
  v_encrypted_pw := crypt(p_new_password, gen_salt('bf'));

  update auth.users
  set encrypted_password = v_encrypted_pw,
      updated_at = now()
  where id = v_auth_id;

  return jsonb_build_object(
    'success', true,
    'message', 'Password berhasil diperbarui.'
  );
end;
$$;

-- Grant execution to authenticated users (internal is_admin() checks prevent unauthorized execution)
grant execute on function public.admin_create_student(text, text, text) to authenticated;
grant execute on function public.admin_reset_student_password(uuid, text) to authenticated;
