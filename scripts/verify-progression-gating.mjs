import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'
import {
  canAccessActivity,
  canAccessSubcourse,
  canAccessFinalQuiz,
  canAccessCourse,
  ACTIVITY_SEQUENCE
} from '../src/lib/gating.ts'

function loadEnv() {
  const envPath = path.resolve(process.cwd(), '.env')
  if (!fs.existsSync(envPath)) {
    throw new Error('.env file not found in current directory!')
  }
  const content = fs.readFileSync(envPath, 'utf8')
  const env = {}
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const [key, ...values] = trimmed.split('=')
    if (key && values.length > 0) {
      env[key.trim()] = values.join('=').trim()
    }
  }
  return env
}

const env = loadEnv()
const SUPABASE_URL = env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = env.VITE_SUPABASE_ANON_KEY

console.log('---------------------------------------------------------')
console.log('PRICODE: Progression & Gating Enforcement Verification')
console.log('Activities (1-5) -> Subcourses (1-N) -> Courses (1-N)')
console.log(`Endpoint: ${SUPABASE_URL}`)
console.log('---------------------------------------------------------\n')

const results = []

function assert(description, isSuccess, details = '') {
  results.push({ description, isSuccess, details })
  const icon = isSuccess ? '✅ PASS' : '❌ FAIL'
  console.log(`${icon} : ${description}`)
  if (details && !isSuccess) {
    console.log(`     Details: ${details}`)
  }
}

async function runGatingVerification() {
  // ─── SUITE 1: Activity-Level Gating & Direct-URL Protection (Fresh Student) ─────
  console.log('[1] Testing Activity-Level Gating on Fresh Student (0 Progress)...')
  {
    const freshActs = []

    // 1a. Direct URL to step 1 (text) -> Allowed
    const checkText = canAccessActivity(freshActs, 'text')
    assert('Fresh student CAN access Step 1 (Text)', checkText.allowed === true && checkText.redirectActivity === 'text')

    // 1b. Direct URL to step 2 (video) before completing text -> Blocked, redirected to text
    const checkVideo = canAccessActivity(freshActs, 'video')
    assert('Direct URL to Step 2 (Video) BLOCKED for fresh student', checkVideo.allowed === false && checkVideo.redirectActivity === 'text')

    // 1c. Direct URL to step 3 (ia1) before completing text/video -> Blocked, redirected to text
    const checkIa1 = canAccessActivity(freshActs, 'ia1')
    assert('Direct URL to Step 3 (IA1) BLOCKED for fresh student', checkIa1.allowed === false && checkIa1.redirectActivity === 'text')

    // 1d. Direct URL to step 4 (ia2) before completing preceding -> Blocked, redirected to text
    const checkIa2 = canAccessActivity(freshActs, 'ia2')
    assert('Direct URL to Step 4 (IA2) BLOCKED for fresh student', checkIa2.allowed === false && checkIa2.redirectActivity === 'text')

    // 1e. Direct URL to step 5 (quiz) before completing preceding -> Blocked, redirected to text
    const checkQuiz = canAccessActivity(freshActs, 'quiz')
    assert('Direct URL to Step 5 (Quiz) BLOCKED for fresh student', checkQuiz.allowed === false && checkQuiz.redirectActivity === 'text')
  }

  // ─── SUITE 2: Sequential Activity Unlocking Step-by-Step ─────────────────────
  console.log('\n[2] Testing Sequential Unlocking Step-by-Step...')
  {
    // 2a. Completed 'text'
    const afterText = ['text']
    const vCheck = canAccessActivity(afterText, 'video')
    assert('Completing Text UNLOCKS Step 2 (Video)', vCheck.allowed === true)

    const ia1Bypassed = canAccessActivity(afterText, 'ia1')
    assert('Attempting to jump to IA1 after only Text is BLOCKED (redirected to Video)', ia1Bypassed.allowed === false && ia1Bypassed.redirectActivity === 'video')

    const quizBypassed = canAccessActivity(afterText, 'quiz')
    assert('Attempting to jump to Quiz after only Text is BLOCKED (redirected to Video)', quizBypassed.allowed === false && quizBypassed.redirectActivity === 'video')

    // 2b. Completed 'video'
    const afterVideo = ['text', 'video']
    const ia1Check = canAccessActivity(afterVideo, 'ia1')
    assert('Completing Video UNLOCKS Step 3 (IA1)', ia1Check.allowed === true)

    const ia2Bypassed = canAccessActivity(afterVideo, 'ia2')
    assert('Attempting to jump to IA2 before solving IA1 is BLOCKED (redirected to IA1)', ia2Bypassed.allowed === false && ia2Bypassed.redirectActivity === 'ia1')

    // 2c. Completed 'ia1'
    const afterIa1 = ['text', 'video', 'ia1']
    const ia2Check = canAccessActivity(afterIa1, 'ia2')
    assert('Solving IA1 UNLOCKS Step 4 (IA2)', ia2Check.allowed === true)

    const quizBypassed2 = canAccessActivity(afterIa1, 'quiz')
    assert('Attempting to jump to Quiz before solving IA2 is BLOCKED (redirected to IA2)', quizBypassed2.allowed === false && quizBypassed2.redirectActivity === 'ia2')

    // 2d. Completed 'ia2'
    const afterIa2 = ['text', 'video', 'ia1', 'ia2']
    const quizCheck = canAccessActivity(afterIa2, 'quiz')
    assert('Solving IA2 UNLOCKS Step 5 (Sub Course Quiz)', quizCheck.allowed === true)

    // 2e. Subcourse Completed -> all unlocked for revision
    const allActivities = canAccessActivity(afterIa2, 'quiz', true)
    assert('Once Subcourse is Completed, ALL activities unlocked for revision', allActivities.allowed === true)
  }

  // ─── SUITE 3: SubCourse-to-SubCourse Gating (Within a Course) ─────────────────
  console.log('\n[3] Testing SubCourse-to-SubCourse Gating...')
  {
    const subcourses = [
      { id: 'sub-1', title: 'Variabel', order: 1, course_id: 'course-1' },
      { id: 'sub-2', title: 'Logika Percabangan (If/Else)', order: 2, course_id: 'course-1' },
      { id: 'sub-3', title: 'Perulangan (Loop)', order: 3, course_id: 'course-1' }
    ]

    // 3a. Fresh student (Sub-1 not completed)
    const freshProgMap = {
      'sub-1': { status: 'in_progress' }
    }

    // Attempt direct URL to Sub-1 -> Allowed
    const sc1Check = canAccessSubcourse(subcourses, freshProgMap, 'sub-1')
    assert('Student CAN access first SubCourse (Sub-1)', sc1Check.allowed === true)

    // Attempt direct URL to Sub-2 -> BLOCKED, redirected to Sub-1
    const sc2Direct = canAccessSubcourse(subcourses, freshProgMap, 'sub-2')
    assert('Direct URL to SubCourse 2 BLOCKED when Sub-1 not completed', sc2Direct.allowed === false && sc2Direct.redirectSubcourseId === 'sub-1')

    // Attempt direct URL to Sub-3 -> BLOCKED, redirected to Sub-1
    const sc3Direct = canAccessSubcourse(subcourses, freshProgMap, 'sub-3')
    assert('Direct URL to SubCourse 3 BLOCKED when Sub-1 not completed', sc3Direct.allowed === false && sc3Direct.redirectSubcourseId === 'sub-1')

    // 3b. Student completes Sub-1 (Passes SubCourse Quiz)
    const completedSub1ProgMap = {
      'sub-1': { status: 'completed' },
      'sub-2': { status: 'in_progress' }
    }

    const sc2Unlocked = canAccessSubcourse(subcourses, completedSub1ProgMap, 'sub-2')
    assert('Passing Sub-1 UNLOCKS SubCourse 2', sc2Unlocked.allowed === true)

    const sc3StillLocked = canAccessSubcourse(subcourses, completedSub1ProgMap, 'sub-3')
    assert('SubCourse 3 remains BLOCKED until Sub-2 is completed', sc3StillLocked.allowed === false && sc3StillLocked.redirectSubcourseId === 'sub-2')

    // 3c. Student completes Sub-2
    const completedSub2ProgMap = {
      'sub-1': { status: 'completed' },
      'sub-2': { status: 'completed' },
      'sub-3': { status: 'in_progress' }
    }

    const sc3Unlocked = canAccessSubcourse(subcourses, completedSub2ProgMap, 'sub-3')
    assert('Passing Sub-2 UNLOCKS SubCourse 3', sc3Unlocked.allowed === true)
  }

  // ─── SUITE 4: Final Quiz Prerequisite Gating ─────────────────────────────────
  console.log('\n[4] Testing Final Quiz Prerequisite Gating...')
  {
    const subcourses = [
      { id: 'sub-1', title: 'Variabel', order: 1, course_id: 'course-1' },
      { id: 'sub-2', title: 'Logika Percabangan', order: 2, course_id: 'course-1' }
    ]

    // 4a. Incomplete subcourses
    const incompleteProg = {
      'sub-1': { status: 'completed' },
      'sub-2': { status: 'in_progress' }
    }

    const fqLocked = canAccessFinalQuiz(subcourses, incompleteProg)
    assert('Final Quiz is LOCKED when any subcourse is not completed', fqLocked.allowed === false && fqLocked.redirectSubcourseId === 'sub-2')

    // 4b. All subcourses completed
    const allCompletedProg = {
      'sub-1': { status: 'completed' },
      'sub-2': { status: 'completed' }
    }

    const fqUnlocked = canAccessFinalQuiz(subcourses, allCompletedProg)
    assert('Final Quiz is UNLOCKED once all subcourses in course are completed', fqUnlocked.allowed === true)
  }

  // ─── SUITE 5: Course-to-Course Gating ───────────────────────────────────────
  console.log('\n[5] Testing Course-to-Course Gating...')
  {
    const courses = [
      { id: 'course-1', title: 'Dasar Pemrograman PRICODE (SD)', order: 1 },
      { id: 'course-2', title: 'Algoritma Lanjutan & Proyek Game', order: 2 }
    ]

    // 5a. Course 1 Final Quiz not passed
    const c1InProgressMap = {
      'course-1': { status: 'in_progress' }
    }

    const c1Check = canAccessCourse(courses, c1InProgressMap, 'course-1')
    assert('Course 1 is always ACCESSIBLE', c1Check.allowed === true)

    const c2Locked = canAccessCourse(courses, c1InProgressMap, 'course-2')
    assert('Course 2 is LOCKED until Course 1 Final Quiz is passed', c2Locked.allowed === false)

    // 5b. Course 1 Final Quiz passed
    const c1CompletedMap = {
      'course-1': { status: 'completed' }
    }

    const c2Unlocked = canAccessCourse(courses, c1CompletedMap, 'course-2')
    assert('Passing Course 1 Final Quiz UNLOCKS Course 2', c2Unlocked.allowed === true)
  }

  // ─── SUITE 6: Database Integration Test on Live Supabase ────────────────────
  console.log('\n[6] Testing Live Database Progress Integration with Student Account...')
  {
    const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false }
    })

    const { data: authData, error: loginErr } = await studentClient.auth.signInWithPassword({
      email: 'student1_test@pricode.local',
      password: 'StudentSecret123!'
    })

    assert('Student 1 can authenticate for live gating check', !loginErr && authData?.user !== null)

    const { data: studentRecord } = await studentClient
      .from('students')
      .select('id')
      .eq('auth_id', authData.user.id)
      .single()

    const { data: subcourses } = await studentClient
      .from('sub_courses')
      .select('id, title, course_id, order')
      .order('order', { ascending: true })

    assert('Found subcourse in database for live test', subcourses?.length > 0)
    const testSubcourse = subcourses[0]

    // Verify progress row can be queried via RLS
    const { data: progRow, error: progErr } = await studentClient
      .from('progress')
      .select('status, quiz_score, attempts')
      .eq('student_id', studentRecord.id)
      .eq('subcourse_id', testSubcourse.id)
      .maybeSingle()

    assert('Student progress can be retrieved from database', !progErr)
    console.log(`     Live DB State for "${testSubcourse.title}": status="${progRow?.status || 'none'}", score=${progRow?.quiz_score ?? 'null'}`)
  }

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n---------------------------------------------------------')
  const passedCount = results.filter((r) => r.isSuccess).length
  const totalCount = results.length
  console.log(`Progression Gating Suite Complete: ${passedCount}/${totalCount} tests passed.`)

  if (passedCount === totalCount) {
    console.log('🎉 ALL PROGRESSION & GATING ENFORCEMENT RULES VERIFIED!')
    console.log('---------------------------------------------------------\n')
    process.exit(0)
  } else {
    console.error('❌ SOME TESTS FAILED.')
    console.log('---------------------------------------------------------\n')
    process.exit(1)
  }
}

runGatingVerification().catch((err) => {
  console.error('Fatal error during gating verification:', err)
  process.exit(1)
})

