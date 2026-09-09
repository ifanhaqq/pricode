# Project Requirements Document
##  PRICODE: Aplikasi Belajar Coding untuk Siswa SD (Kelas 4–6)

**Status:** Draft v0.1 — contains open questions that must be resolved before build starts
**Language of product:** Bahasa Indonesia (full)
**Platform:** Web application (browser)

---

## 1. Problem & Goal

**Problem statement (confirmed):** There is no structured coding curriculum for PRICODE — this app exists purely to give them a structured way to learn, with all materials authored by developer himself using the app's Course → Sub Course → Activity structure. It is not tied to any standardized curriculum (e.g. Kurikulum Merdeka) — the structure and content are developer's own design. Worth keeping in mind: since there's no external curriculum to validate against, sequencing and pacing decisions (what counts as "Variabel" content, what order topics go in) rest entirely on developer's judgment as instructor — there's no external reference to sanity-check against if something isn't landing with students, so watching for where students actually struggle in practice matters more than it would with an existing curriculum.

**Primary goal:** Let a grade 4–6 student progress through programming-logic courses independently, with mastery gated by quizzes.

**Scope note:** This is for developer's own coding club — a small, closed group, not a public product. This materially lowers the bar on several things that would otherwise need more engineering: expected concurrent users, abuse-resistance beyond basic RLS, and the self-registration/consent questions that would apply if strangers could sign themselves up. Accounts will be instructor-created (see Section 2), which sidesteps most minors'-data self-registration concerns.

**Non-goals (proposed — confirm):**
- Not multiplayer/social
- Not adaptive/AI-personalized in v1

**Confirmed v1 scope addition:** an instructor view showing all students' progress (completion per sub course, quiz scores) — decided as in-scope for v1, not deferred.

---

## 2. Target User

- Age: ~9–12 (grades 4–6, upper SD)
- Reading level: can read Indonesian instructional text independently, but instructions should stay short and concrete — this age range still drops off with dense paragraphs
- Assumed device: shared or personal laptop/desktop with browser access (confirm — if a meaningful share of users are on school computers with restricted internet, YouTube embeds may be blocked by school filters, which undercuts the video activity type)
- No prior coding experience assumed
- Closed group: your coding club students only, not public signups
- **Login:** per-student profile, via Supabase Auth. **Decided:** you assign username/password yourself for each student, no real email involved. **Synthetic email format decided:** `username@codingclub.scr`. Note: since `.scr` isn't a real, resolvable domain, Supabase's built-in "forgot password" email flow has nowhere to deliver to — password resets need to be a manual instructor action from the admin panel, not a self-service email link. Build that reset capability into the CMS from the start.

---

## 3. Content Model

```
Course
 └── Sub Course (ordered)
      └── Activities (fixed sequence per sub course)
           1. Text-based learning
           2. YouTube embedded video
           3. Interactive Activity 1 (IA1)
           4. Interactive Activity 2 (IA2 — harder variant of IA1's mechanic)
           5. Sub Course Quiz
 └── Final Quiz (course-level, required to unlock next Course)
```

**Example:**
- Course: *Logika Pemrograman*
  - Sub Course: *Variabel* → Text → Video → IA1 → IA2 → Quiz
  - Sub Course: *If Else* → Text → Video → IA1 → IA2 → Quiz
  - Sub Course: *(TBD)*
  - Sub Course: *(TBD)*
  - Final Quiz → unlocks next Course

### 3.1 Sequencing rules (proposed — confirm)
- Activities within a sub course: **strictly linear**, no skipping (matches "learning path" framing). If you want free navigation for review, that's a different, more complex nav model — say so if you want it.
- Sub courses within a course: **decided — linear only**, no jumping ahead to unlocked-but-not-yet-reached sub courses.
- Course-to-course: gated by Final Quiz, as stated.

### 3.2 Final Quiz failure path — **decided: Option B**
Retry with a short cooldown, then a "review the weakest sub course" prompt.
- **Cooldown duration: 10 minutes** (decided)
- **Passing threshold: 70%** (decided) — reasonable given the drag-and-drop sequencing mechanic, where a single misordered block would otherwise fail an entire 100%-required attempt
- **"Weakest sub course" determination:** since the Final Quiz is a *separately authored* question set (see 4.4), it can't automatically map wrong answers back to a sub course unless each Final Quiz question is tagged with the sub course it draws material from. Recommend tagging each Final Quiz question with a `subcourse_id` at authoring time — then "weakest" = the sub course with the most missed tagged questions on that attempt.

---

## 4. Activity Type Specs

### 4.1 Text-based learning
- Static instructional content per sub course, authored via CMS
- Needs: rich text support (headings, code blocks, images) at minimum — plain text alone will be too limiting for coding topics involving syntax

### 4.2 YouTube embedded video
- Standard iframe embed of an existing YouTube video URL
- **Risk carried forward from your decision to accept it:** YouTube's related-video panel after playback is not fully controllable, and content availability isn't guaranteed (a video could go private/be taken down). Two mitigations worth considering even within "use YouTube": use `youtube-nocookie.com` embed domain to reduce tracking, and store the video ID + a fallback text description in the CMS so a broken link doesn't hard-block a sub course.

### 4.3 Interactive Activity 1 & 2 — **decided: drag-and-drop block sequencing**

Student is given a set of code/logic blocks out of order and arranges them into the correct sequence.

- **Why this mechanic:** it fits the actual subject matter (programming *logic*/sequencing) across topics rather than being a generic quiz format bolted on. *Variabel* → order of declare/assign/print. *If Else* → order of condition/branch/output. Future loop/function topics → order of init/condition/body/increment. One reusable component covers the curriculum without forcing bad-fit interactions per topic.
- **IA1 → IA2 difficulty rule (concrete):**
  - IA1: 4-5 blocks, no distractors
  - IA2: 7-9 blocks, includes 2-4 distractor blocks (plausible-looking blocks that don't belong in the sequence)
- **Data shape for CMS authoring:** each activity = `blocks[]`, each block tagged `correct` or `distractor`, plus the correct order index for the `correct` blocks. One authoring form, one reusable frontend component.
- **Known limitation:** this mechanic tests sequencing, which a student can partly pattern-match/trial-and-error through rather than reason through. If deeper comprehension-checking is needed later, that's better added at the quiz layer (multiple choice can ask "why" in ways drag-drop can't) rather than overloading this mechanic to do both jobs.

### 4.4 Sub Course Quiz vs Final Quiz
- Sub Course Quiz: tests the single sub course just completed. **Decided:** the 70% passing threshold applies here too — a student can't advance to the next sub course below 70%. **Decided:** retry is immediate, no cooldown (unlike the Final Quiz's 10-minute cooldown) — lighter-weight friction since these come up far more often.
- Final Quiz: **decided** — a separately authored question set (not auto-pulled from sub course quizzes), covering material across all sub courses in the course. Each question should carry a `subcourse_id` tag so the failure-path review (Section 3.2) can point to the right sub course.

---

## 5. Content Authoring (Admin/CMS)

Since you're authoring solo via CMS, the CMS needs at minimum:
- CRUD for Courses → Sub Courses → Activities
- Rich text editor for Text activities
- YouTube URL field with ID extraction/validation
- Quiz builder (question, options, correct answer, and — if you go with failure path B above — a tag linking the question back to its sub course)
- IA1/IA2 content authoring — this will look very different depending on which mechanic(s) you pick in 4.3 (e.g., authoring a drag-drop word bank vs. authoring a multiple-choice question are different editor UIs)
- Draft/publish state, so you can build a course without it being live

**Access control:** single-admin (you) is fine for v1 — no need to over-build a permissions system unless you plan to bring in co-authors soon.

**Critical requirement given the GitHub Pages + Supabase architecture (Section 8):** since there's no backend server, the CMS and all student-facing writes go through Supabase directly from the browser. This means Supabase Row Level Security (RLS) policies are not optional hardening — they're the *only* thing preventing a student from writing to tables they shouldn't (e.g., editing their own quiz score, or reaching course-content tables if the admin route isn't properly gated). This should be treated as a blocking requirement before any real student data goes into the system, not a later polish item.

---

## 6. Progress & Data Model (Supabase)

Login is confirmed, so progress lives server-side in Supabase (Postgres), not just the browser — this also gives you a students'-progress overview for free later if you want the instructor view flagged in Section 1.

```
Course (id, title, order, description)
SubCourse (id, course_id, title, order)
Activity (id, subcourse_id, type[text|video|ia1|ia2|quiz], order, content_ref)
IABlock (id, activity_id, label, role[correct|distractor], correct_order)
SubCourseQuiz (id, subcourse_id, questions[])
FinalQuiz (id, course_id, questions[])
Question (id, quiz_id[sub or final], prompt, options[], correct_answer, subcourse_id_tag)
Student (id, name, auth_id [Supabase Auth])
Progress (student_id, subcourse_id, status, quiz_score, attempts, cooldown_until)
```

`Question.subcourse_id_tag` is what makes the Section 3.2 "review weakest sub course" logic possible for Final Quiz questions.

---

## 7. Non-Functional Requirements (draft — confirm priorities)

- **Localization:** all UI copy, instructional text, and quiz content in Bahasa Indonesia — including error/empty states, not just main content
- **Performance:** should work reasonably on lower-end shared/school computers, not just your RTX 4060 dev machine — video embed and any drag-drop interactions should degrade gracefully on weak hardware/slow connections
- **Accessibility for the age group:** larger touch/click targets, minimal reliance on precise typing, clear visual feedback on correct/incorrect (this age group benefits from immediate, unambiguous feedback)
- **Content safety:** since YouTube embeds are in scope, decide now whether you'll manually vet every video before publishing (recommended, given you're the sole content author anyway)

---

## 8. Architecture — Decided

- **Frontend + CMS:** static site hosted on GitHub Pages
- **Auth + data:** Supabase (Auth for student login, Postgres for course content and progress)
- **No custom backend server** — all reads/writes go through the Supabase client SDK directly from the browser

**Implication to plan around:** with no server layer, *every* access-control rule lives in Supabase RLS policies, not in application code you fully control server-side. Practically, this means before launch you need at minimum:
- A `role` distinction (student vs. admin) enforced at the RLS level, not just hidden in the frontend UI
- Policies so a student can only `insert`/`update` their *own* `Progress` rows, and only `select` (never write) `Course`/`SubCourse`/`Activity`/`Question` content
- The admin/CMS routes checking the authenticated user's role before rendering, in addition to the RLS backstop

This is very buildable at your scale (small user count, you as sole admin) — just flagging it as a checklist item to actually get right, not skip because "it's just my club."

---

## 10. Suggested MVP Scope (proposed cut line — confirm)

**In for MVP:**
- One full Course with all its Sub Courses (e.g., *Logika Pemrograman*) end-to-end
- All 5 activity types working for that one course, including the drag-and-drop block-sequencing component for IA1/IA2
- Supabase Auth (instructor-created student accounts, username/password, no email) with RLS policies covering the student/admin split from day one — this is cheap to get right early and expensive to retrofit
- CMS sufficient to author that one course, including block-sequencing content and Final Quiz question authoring with sub-course tags
- Final Quiz with 10-minute retry cooldown, 70% pass threshold, and weakest-sub-course review prompt
- Instructor dashboard showing all students' progress (confirmed in-scope for v1)

**Out for MVP:**
- Multiple courses / course-to-course gating (can hardcode "only one course exists" initially, add gating logic once a second course exists)
- Any second IA mechanic beyond block-sequencing, if future topics turn out to need one