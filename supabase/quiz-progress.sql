-- ============================================================================
-- PRICODE: Course-Level Progress & Final Quiz Schema Migration
-- ============================================================================

-- 1. Modify progress table to allow course-level tracking (Final Quiz)
-- In the initial schema, progress had primary key (student_id, subcourse_id)
-- where subcourse_id was NOT NULL.
-- For Final Quiz progress, we allow subcourse_id to be NULL and add course_id.

alter table public.progress drop constraint if exists progress_pkey;
alter table public.progress alter column subcourse_id drop not null;

-- Add course_id and weakest_subcourse_id if they don't exist yet
alter table public.progress add column if not exists course_id uuid references public.courses(id) on delete cascade;
alter table public.progress add column if not exists weakest_subcourse_id uuid references public.sub_courses(id) on delete set null;

-- Ensure uniqueness: either (student_id, subcourse_id) for subcourses, OR (student_id, course_id) for courses
create unique index if not exists idx_progress_student_subcourse on public.progress(student_id, subcourse_id) where subcourse_id is not null;
create unique index if not exists idx_progress_student_course on public.progress(student_id, course_id) where course_id is not null;

-- Index for querying course progress
create index if not exists idx_progress_course on public.progress(course_id);

