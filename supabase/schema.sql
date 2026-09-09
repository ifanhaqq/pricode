-- ==============================================================================
-- PRICODE: Supabase Relational Database Schema & Row Level Security (RLS)
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- ─── 0. EXTENSIONS ─────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ─── 1. CORE TABLES ───────────────────────────────────────────────────────────

-- User Roles Table (Admin vs Student distinction)
create table if not exists public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null check (role in ('admin', 'student')),
  created_at timestamptz not null default now()
);

-- Course Table
create table if not exists public.courses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  "order" integer not null default 0,
  description text,
  created_at timestamptz not null default now()
);

-- SubCourse Table
create table if not exists public.sub_courses (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  "order" integer not null default 0,
  created_at timestamptz not null default now()
);

-- Activity Table
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  subcourse_id uuid not null references public.sub_courses(id) on delete cascade,
  type text not null check (type in ('text', 'video', 'ia1', 'ia2', 'quiz')),
  "order" integer not null default 0,
  content_ref jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- IA Blocks Table (for Interactive Activities drag-and-drop sequencing)
create table if not exists public.ia_blocks (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities(id) on delete cascade,
  label text not null,
  role text not null check (role in ('correct', 'distractor')),
  correct_order integer,
  created_at timestamptz not null default now(),
  constraint check_ia_block_order check (
    (role = 'correct' and correct_order is not null) or 
    (role = 'distractor' and correct_order is null)
  )
);

-- SubCourse Quiz Table
create table if not exists public.sub_course_quizzes (
  id uuid primary key default gen_random_uuid(),
  subcourse_id uuid not null unique references public.sub_courses(id) on delete cascade,
  title text not null default 'Sub Course Quiz',
  created_at timestamptz not null default now()
);

-- Final Quiz Table (Course-level quiz)
create table if not exists public.final_quizzes (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null unique references public.courses(id) on delete cascade,
  title text not null default 'Final Quiz',
  created_at timestamptz not null default now()
);

-- Question Table (supports both SubCourse Quiz and Final Quiz)
create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  sub_course_quiz_id uuid references public.sub_course_quizzes(id) on delete cascade,
  final_quiz_id uuid references public.final_quizzes(id) on delete cascade,
  prompt text not null,
  options jsonb not null default '[]'::jsonb,
  correct_answer text not null,
  subcourse_id_tag uuid references public.sub_courses(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint check_question_quiz_target check (
    (sub_course_quiz_id is not null and final_quiz_id is null) or
    (sub_course_quiz_id is null and final_quiz_id is not null)
  )
);

-- Student Table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  auth_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Progress Table
create table if not exists public.progress (
  student_id uuid not null references public.students(id) on delete cascade,
  subcourse_id uuid not null references public.sub_courses(id) on delete cascade,
  status text not null default 'locked' check (status in ('locked', 'in_progress', 'completed')),
  quiz_score numeric(5,2) check (quiz_score is null or (quiz_score >= 0 and quiz_score <= 100)),
  attempts integer not null default 0 check (attempts >= 0),
  cooldown_until timestamptz,
  updated_at timestamptz not null default now(),
  primary key (student_id, subcourse_id)
);

-- Indexes for optimal lookup performance
create index if not exists idx_sub_courses_course on public.sub_courses(course_id);
create index if not exists idx_activities_subcourse on public.activities(subcourse_id);
create index if not exists idx_ia_blocks_activity on public.ia_blocks(activity_id);
create index if not exists idx_questions_sub_quiz on public.questions(sub_course_quiz_id);
create index if not exists idx_questions_final_quiz on public.questions(final_quiz_id);
create index if not exists idx_progress_student on public.progress(student_id);
create index if not exists idx_students_auth on public.students(auth_id);


-- ─── 2. HELPER FUNCTIONS (SECURITY DEFINER) ───────────────────────────────────

-- Helper: Check if current auth user is admin
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

-- Helper: Check if current auth user is student
create or replace function public.is_student()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'student'
  );
$$;

-- Helper: Get current student's student.id
create or replace function public.get_current_student_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select id from public.students
  where auth_id = auth.uid()
  limit 1;
$$;


-- ─── 3. ROW LEVEL SECURITY (RLS) POLICIES ─────────────────────────────────────

-- Enable RLS on all tables
alter table public.user_roles enable row level security;
alter table public.courses enable row level security;
alter table public.sub_courses enable row level security;
alter table public.activities enable row level security;
alter table public.ia_blocks enable row level security;
alter table public.sub_course_quizzes enable row level security;
alter table public.final_quizzes enable row level security;
alter table public.questions enable row level security;
alter table public.students enable row level security;
alter table public.progress enable row level security;

-- Drop existing policies if re-running to avoid conflicts
drop policy if exists "Select user_roles" on public.user_roles;
drop policy if exists "Admin insert user_roles" on public.user_roles;
drop policy if exists "Admin update user_roles" on public.user_roles;
drop policy if exists "Admin delete user_roles" on public.user_roles;

drop policy if exists "Select courses" on public.courses;
drop policy if exists "Admin insert courses" on public.courses;
drop policy if exists "Admin update courses" on public.courses;
drop policy if exists "Admin delete courses" on public.courses;

drop policy if exists "Select sub_courses" on public.sub_courses;
drop policy if exists "Admin insert sub_courses" on public.sub_courses;
drop policy if exists "Admin update sub_courses" on public.sub_courses;
drop policy if exists "Admin delete sub_courses" on public.sub_courses;

drop policy if exists "Select activities" on public.activities;
drop policy if exists "Admin insert activities" on public.activities;
drop policy if exists "Admin update activities" on public.activities;
drop policy if exists "Admin delete activities" on public.activities;

drop policy if exists "Select ia_blocks" on public.ia_blocks;
drop policy if exists "Admin insert ia_blocks" on public.ia_blocks;
drop policy if exists "Admin update ia_blocks" on public.ia_blocks;
drop policy if exists "Admin delete ia_blocks" on public.ia_blocks;

drop policy if exists "Select sub_course_quizzes" on public.sub_course_quizzes;
drop policy if exists "Admin insert sub_course_quizzes" on public.sub_course_quizzes;
drop policy if exists "Admin update sub_course_quizzes" on public.sub_course_quizzes;
drop policy if exists "Admin delete sub_course_quizzes" on public.sub_course_quizzes;

drop policy if exists "Select final_quizzes" on public.final_quizzes;
drop policy if exists "Admin insert final_quizzes" on public.final_quizzes;
drop policy if exists "Admin update final_quizzes" on public.final_quizzes;
drop policy if exists "Admin delete final_quizzes" on public.final_quizzes;

drop policy if exists "Select questions" on public.questions;
drop policy if exists "Admin insert questions" on public.questions;
drop policy if exists "Admin update questions" on public.questions;
drop policy if exists "Admin delete questions" on public.questions;

drop policy if exists "Select students" on public.students;
drop policy if exists "Admin insert students" on public.students;
drop policy if exists "Admin update students" on public.students;
drop policy if exists "Admin delete students" on public.students;

drop policy if exists "Select progress" on public.progress;
drop policy if exists "Insert progress" on public.progress;
drop policy if exists "Update progress" on public.progress;
drop policy if exists "Admin delete progress" on public.progress;

-- Policies for: user_roles
create policy "Select user_roles" on public.user_roles
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy "Admin insert user_roles" on public.user_roles
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update user_roles" on public.user_roles
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete user_roles" on public.user_roles
  for delete to authenticated
  using (public.is_admin());

-- Policies for: courses
create policy "Select courses" on public.courses
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert courses" on public.courses
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update courses" on public.courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete courses" on public.courses
  for delete to authenticated
  using (public.is_admin());

-- Policies for: sub_courses
create policy "Select sub_courses" on public.sub_courses
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert sub_courses" on public.sub_courses
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update sub_courses" on public.sub_courses
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete sub_courses" on public.sub_courses
  for delete to authenticated
  using (public.is_admin());

-- Policies for: activities
create policy "Select activities" on public.activities
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert activities" on public.activities
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update activities" on public.activities
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete activities" on public.activities
  for delete to authenticated
  using (public.is_admin());

-- Policies for: ia_blocks
create policy "Select ia_blocks" on public.ia_blocks
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert ia_blocks" on public.ia_blocks
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update ia_blocks" on public.ia_blocks
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete ia_blocks" on public.ia_blocks
  for delete to authenticated
  using (public.is_admin());

-- Policies for: sub_course_quizzes
create policy "Select sub_course_quizzes" on public.sub_course_quizzes
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert sub_course_quizzes" on public.sub_course_quizzes
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update sub_course_quizzes" on public.sub_course_quizzes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete sub_course_quizzes" on public.sub_course_quizzes
  for delete to authenticated
  using (public.is_admin());

-- Policies for: final_quizzes
create policy "Select final_quizzes" on public.final_quizzes
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert final_quizzes" on public.final_quizzes
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update final_quizzes" on public.final_quizzes
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete final_quizzes" on public.final_quizzes
  for delete to authenticated
  using (public.is_admin());

-- Policies for: questions
create policy "Select questions" on public.questions
  for select to authenticated
  using (public.is_student() or public.is_admin());

create policy "Admin insert questions" on public.questions
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update questions" on public.questions
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete questions" on public.questions
  for delete to authenticated
  using (public.is_admin());

-- Policies for: students
create policy "Select students" on public.students
  for select to authenticated
  using (public.is_admin() or auth_id = auth.uid());

create policy "Admin insert students" on public.students
  for insert to authenticated
  with check (public.is_admin());

create policy "Admin update students" on public.students
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "Admin delete students" on public.students
  for delete to authenticated
  using (public.is_admin());

-- Policies for: progress
-- 1. Student can only select their own progress; Admin can select all students' progress
create policy "Select progress" on public.progress
  for select to authenticated
  using (public.is_admin() or student_id = public.get_current_student_id());

-- 2. Student can insert their own progress; Admin can insert progress
create policy "Insert progress" on public.progress
  for insert to authenticated
  with check (public.is_admin() or student_id = public.get_current_student_id());

-- 3. Student can update their own progress; Admin can update progress
create policy "Update progress" on public.progress
  for update to authenticated
  using (public.is_admin() or student_id = public.get_current_student_id())
  with check (public.is_admin() or student_id = public.get_current_student_id());

-- 4. Only Admin can delete progress
create policy "Admin delete progress" on public.progress
  for delete to authenticated
  using (public.is_admin());


-- ─── 4. SEED CONTENT (Initial Course & Subcourses for Testing) ─────────────────

do $$
declare
  v_course_id uuid;
  v_subcourse_id uuid;
  v_activity_id uuid;
  v_quiz_id uuid;
begin
  -- 1. Insert initial course if not present
  select id into v_course_id from public.courses where title = 'Logika Pemrograman' limit 1;
  if v_course_id is null then
    insert into public.courses (title, "order", description)
    values ('Logika Pemrograman', 1, 'Dasar pemrograman logika untuk siswa SD')
    returning id into v_course_id;
  end if;

  -- 2. Insert initial subcourse (Variabel)
  select id into v_subcourse_id from public.sub_courses where course_id = v_course_id and title = 'Variabel' limit 1;
  if v_subcourse_id is null then
    insert into public.sub_courses (course_id, title, "order")
    values (v_course_id, 'Variabel', 1)
    returning id into v_subcourse_id;
  end if;

  -- 3. Insert initial activity
  select id into v_activity_id from public.activities where subcourse_id = v_subcourse_id and type = 'text' limit 1;
  if v_activity_id is null then
    insert into public.activities (subcourse_id, type, "order", content_ref)
    values (v_subcourse_id, 'text', 1, '{"text": "Variabel adalah tempat menyimpan data atau informasi dalam program."}'::jsonb)
    returning id into v_activity_id;
  end if;

  -- 4. Insert interactive block activity & blocks
  if not exists (select 1 from public.activities where subcourse_id = v_subcourse_id and type = 'ia1') then
    insert into public.activities (subcourse_id, type, "order", content_ref)
    values (v_subcourse_id, 'ia1', 2, '{"title": "Urutkan pembuatan variabel"}'::jsonb)
    returning id into v_activity_id;

    insert into public.ia_blocks (activity_id, label, role, correct_order) values
      (v_activity_id, 'skor = 100', 'correct', 1),
      (v_activity_id, 'tampilkan(skor)', 'correct', 2),
      (v_activity_id, 'hapus_semua()', 'distractor', null);
  end if;

  -- 5. Insert SubCourse Quiz and Question
  select id into v_quiz_id from public.sub_course_quizzes where subcourse_id = v_subcourse_id limit 1;
  if v_quiz_id is null then
    insert into public.sub_course_quizzes (subcourse_id, title)
    values (v_subcourse_id, 'Kuis Variabel')
    returning id into v_quiz_id;

    insert into public.questions (sub_course_quiz_id, prompt, options, correct_answer, subcourse_id_tag)
    values (
      v_quiz_id,
      'Apa kegunaan dari sebuah variabel dalam coding?',
      '["Menghias tampilan layar", "Menyimpan nilai atau data", "Mematikan komputer", "Menghapus kode"]'::jsonb,
      'Menyimpan nilai atau data',
      v_subcourse_id
    );
  end if;

  -- 6. Insert Final Quiz
  if not exists (select 1 from public.final_quizzes where course_id = v_course_id) then
    insert into public.final_quizzes (course_id, title)
    values (v_course_id, 'Kuis Akhir Logika Pemrograman');
  end if;

end $$;


-- ─── 5. TEST ACCOUNTS PROVISIONING (Direct Postgres Seeding) ───────────────────
-- This helper safely provisions users in auth.users without hitting email SMTP rate limits.

create or replace function public.provision_test_user(
  p_email text,
  p_password text,
  p_role text,
  p_student_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_user_id uuid;
  v_encrypted_pw text;
begin
  v_encrypted_pw := crypt(p_password, gen_salt('bf'));

  select id into v_user_id from auth.users where email = p_email;

  if v_user_id is null then
    v_user_id := gen_random_uuid();
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
      p_email,
      v_encrypted_pw,
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('name', coalesce(p_student_name, p_email)),
      now(),
      now(),
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      '',
      false
    );
  else
    update auth.users
    set encrypted_password = v_encrypted_pw,
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now(),
        confirmation_token = coalesce(confirmation_token, ''),
        recovery_token = coalesce(recovery_token, ''),
        email_change_token_new = coalesce(email_change_token_new, ''),
        email_change_token_current = coalesce(email_change_token_current, ''),
        email_change = coalesce(email_change, ''),
        phone_change = coalesce(phone_change, ''),
        phone_change_token = coalesce(phone_change_token, ''),
        reauthentication_token = coalesce(reauthentication_token, ''),
        is_sso_user = false
    where id = v_user_id;
  end if;

  -- Create or update matching auth.identities row
  delete from auth.identities where user_id = v_user_id and provider = 'email';
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
    v_user_id::text,
    v_user_id,
    format('{"sub":"%s","email":"%s"}', v_user_id::text, p_email)::jsonb,
    'email',
    v_user_id::text,
    now(),
    now(),
    now()
  );

  -- Assign user role
  insert into public.user_roles (user_id, role)
  values (v_user_id, p_role)
  on conflict (user_id) do update set role = excluded.role;

  -- If student role, create student profile
  if p_role = 'student' and p_student_name is not null then
    insert into public.students (name, auth_id)
    values (p_student_name, v_user_id)
    on conflict (auth_id) do update set name = excluded.name;
  end if;

  return v_user_id;
end;
$$;

-- Provision the 3 standard test accounts
select public.provision_test_user('admin_test@pricode.local', 'AdminSecret123!', 'admin', 'Admin Instructor');
select public.provision_test_user('student1_test@pricode.local', 'StudentSecret123!', 'student', 'Budi Santoso');
select public.provision_test_user('student2_test@pricode.local', 'StudentSecret123!', 'student', 'Siti Rahma');

