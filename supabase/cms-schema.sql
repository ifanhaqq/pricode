-- ==============================================================================
-- PRICODE: CMS Schema & RLS Enhancement (Course Publish Status)
-- Run this in your Supabase project's SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- ==============================================================================

-- 1. Add is_published column to public.courses
alter table public.courses add column if not exists is_published boolean not null default false;

-- 2. Update courses RLS policy: Students can ONLY select published courses; Admins can select all
drop policy if exists "Select courses" on public.courses;
create policy "Select courses" on public.courses
  for select to authenticated
  using (
    public.is_admin() or 
    (public.is_student() and is_published = true)
  );

-- 3. Update sub_courses RLS policy: Students only see subcourses of published courses
drop policy if exists "Select sub_courses" on public.sub_courses;
create policy "Select sub_courses" on public.sub_courses
  for select to authenticated
  using (
    public.is_admin() or 
    (public.is_student() and exists (
      select 1 from public.courses c
      where c.id = sub_courses.course_id and c.is_published = true
    ))
  );

-- 4. Update activities RLS policy: Students only see activities of published courses
drop policy if exists "Select activities" on public.activities;
create policy "Select activities" on public.activities
  for select to authenticated
  using (
    public.is_admin() or 
    (public.is_student() and exists (
      select 1 from public.sub_courses sc
      join public.courses c on c.id = sc.course_id
      where sc.id = activities.subcourse_id and c.is_published = true
    ))
  );

-- 5. Update ia_blocks RLS policy: Students only see blocks of published courses
drop policy if exists "Select ia_blocks" on public.ia_blocks;
create policy "Select ia_blocks" on public.ia_blocks
  for select to authenticated
  using (
    public.is_admin() or 
    (public.is_student() and exists (
      select 1 from public.activities a
      join public.sub_courses sc on sc.id = a.subcourse_id
      join public.courses c on c.id = sc.course_id
      where a.id = ia_blocks.activity_id and c.is_published = true
    ))
  );

-- 6. Update questions RLS policy: Students only see questions of published courses
drop policy if exists "Select questions" on public.questions;
create policy "Select questions" on public.questions
  for select to authenticated
  using (
    public.is_admin() or 
    (public.is_student() and (
      exists (
        select 1 from public.sub_course_quizzes sq
        join public.sub_courses sc on sc.id = sq.subcourse_id
        join public.courses c on c.id = sc.course_id
        where sq.id = questions.sub_course_quiz_id and c.is_published = true
      ) or
      exists (
        select 1 from public.final_quizzes fq
        join public.courses c on c.id = fq.course_id
        where fq.id = questions.final_quiz_id and c.is_published = true
      )
    ))
  );

-- 7. Ensure any existing course is set to published for immediate visibility
update public.courses set is_published = true where is_published = false;
