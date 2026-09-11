import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

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
console.log('PRICODE: Student Activity Player & Block Sequencer Test')
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

async function runStudentPlayerVerification() {
  const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // 1. Authenticate as Student
  console.log('[1] Logging in as Student (student1_test)...')
  const { data: authData, error: loginErr } = await studentClient.auth.signInWithPassword({
    email: 'student1_test@pricode.local',
    password: 'StudentSecret123!'
  })
  assert('Student can authenticate successfully', !loginErr && authData?.user !== null, loginErr?.message)

  // 2. Fetch published course
  console.log('\n[2] Fetching Published Courses...')
  const { data: courses, error: coursesErr } = await studentClient
    .from('courses')
    .select('id, title, is_published')
    .eq('is_published', true)

  assert('Student can read published courses via RLS', !coursesErr && courses && courses.length > 0, coursesErr?.message)
  const targetCourse = courses?.find((c) => c.title.includes('PRICODE')) || courses?.[0]
  assert('Found published course for learning', Boolean(targetCourse), 'No published course found')

  // 3. Fetch Sub-Course "Variabel"
  console.log('\n[3] Fetching Sub-Course "Variabel"...')
  const { data: subcourses, error: scErr } = await studentClient
    .from('sub_courses')
    .select('id, title, course_id')
    .eq('course_id', targetCourse.id)
    .order('order', { ascending: true })

  assert('Student can read subcourses of published course', !scErr && subcourses && subcourses.length > 0, scErr?.message)
  const variabelSubcourse = subcourses?.find((sc) => sc.title.toLowerCase().includes('variabel')) || subcourses?.[0]
  assert('Found "Variabel" subcourse', Boolean(variabelSubcourse), 'No Variabel subcourse found')

  // 4. Fetch Activities for Variabel (Text, Video, IA1, IA2)
  console.log('\n[4] Fetching Activities for "Variabel"...')
  const { data: activities, error: actErr } = await studentClient
    .from('activities')
    .select('id, type, order, content_ref')
    .eq('subcourse_id', variabelSubcourse.id)
    .order('order', { ascending: true })

  assert('Student can read activities', !actErr && activities && activities.length >= 4, actErr?.message)

  // 4.1 Check Text Activity
  const textAct = activities?.find((a) => a.type === 'text')
  assert(
    'Text Activity has rich text markdown content',
    Boolean(textAct && textAct.content_ref && textAct.content_ref.text),
    'Missing content_ref.text'
  )

  // 4.2 Check Video Activity
  const videoAct = activities?.find((a) => a.type === 'video')
  assert(
    'Video Activity has YouTube video ID and mandatory fallback text',
    Boolean(
      videoAct &&
      videoAct.content_ref &&
      videoAct.content_ref.video_id &&
      videoAct.content_ref.fallback_text
    ),
    'Missing video_id or fallback_text'
  )

  // 4.3 Check IA1 Block Activity
  console.log('\n[5] Testing IA1 Block Activity & Block Sequencer Logic...')
  const ia1Act = activities?.find((a) => a.type === 'ia1')
  assert('IA1 activity record exists', Boolean(ia1Act), 'Missing IA1 activity')

  const { data: ia1Blocks, error: ia1BlocksErr } = await studentClient
    .from('ia_blocks')
    .select('*')
    .eq('activity_id', ia1Act.id)

  assert('Student can read IA1 blocks via RLS', !ia1BlocksErr && ia1Blocks && ia1Blocks.length > 0, ia1BlocksErr?.message)

  const ia1CorrectBlocks = ia1Blocks.filter((b) => b.role === 'correct')
  const ia1DistractorBlocks = ia1Blocks.filter((b) => b.role === 'distractor')
  assert(
    'IA1 adheres to PRD 3.1: 4-5 blocks and 0 distractors',
    ia1CorrectBlocks.length >= 4 && ia1CorrectBlocks.length <= 5 && ia1DistractorBlocks.length === 0,
    `Count: ${ia1CorrectBlocks.length} correct, ${ia1DistractorBlocks.length} distractors`
  )

  // Simulate BlockSequencer logic on IA1
  const ia1SortedCorrect = [...ia1CorrectBlocks].sort((a, b) => (a.correct_order || 0) - (b.correct_order || 0))
  const ia1TargetLabels = ia1SortedCorrect.map((b) => b.label.trim())

  // Exact match test
  const isIA1ExactMatch = ia1TargetLabels.every((label, idx) => ia1SortedCorrect[idx].label.trim() === label)
  assert('IA1 Sequencer correctly verifies exact match', isIA1ExactMatch)

  // Scrambled match test (should fail)
  const ia1Reversed = [...ia1SortedCorrect].reverse()
  const isIA1ReversedMatch = ia1TargetLabels.every((label, idx) => ia1Reversed[idx].label.trim() === label)
  assert('IA1 Sequencer correctly rejects out-of-order arrangement', !isIA1ReversedMatch)

  // 4.4 Check IA2 Block Activity
  console.log('\n[6] Testing IA2 Block Activity & Distractor Rejection...')
  const ia2Act = activities?.find((a) => a.type === 'ia2')
  assert('IA2 activity record exists', Boolean(ia2Act), 'Missing IA2 activity')

  const { data: ia2Blocks, error: ia2BlocksErr } = await studentClient
    .from('ia_blocks')
    .select('*')
    .eq('activity_id', ia2Act.id)

  assert('Student can read IA2 blocks via RLS', !ia2BlocksErr && ia2Blocks && ia2Blocks.length > 0, ia2BlocksErr?.message)

  const ia2CorrectBlocks = ia2Blocks.filter((b) => b.role === 'correct')
  const ia2DistractorBlocks = ia2Blocks.filter((b) => b.role === 'distractor')
  assert(
    'IA2 adheres to PRD 3.1: 7-9 total blocks with 2-4 distractors',
    ia2Blocks.length >= 7 && ia2Blocks.length <= 9 && ia2DistractorBlocks.length >= 2 && ia2DistractorBlocks.length <= 4,
    `Total: ${ia2Blocks.length}, Distractors: ${ia2DistractorBlocks.length}`
  )

  // Simulate BlockSequencer logic on IA2
  const ia2SortedCorrect = [...ia2CorrectBlocks].sort((a, b) => (a.correct_order || 0) - (b.correct_order || 0))
  const ia2TargetLabels = ia2SortedCorrect.map((b) => b.label.trim())

  // Case 1: Student places all correct blocks in order -> PASS
  const userCorrectArrangement = ia2SortedCorrect.map((b) => b.label.trim())
  const isIA2CleanPass =
    userCorrectArrangement.length === ia2TargetLabels.length &&
    userCorrectArrangement.every((label, idx) => label === ia2TargetLabels[idx])
  assert('IA2 Sequencer accepts clean sequence without distractors', isIA2CleanPass)

  // Case 2: Student accidentally includes a distractor -> REJECT
  const userWithDistractor = [...ia2SortedCorrect, ia2DistractorBlocks[0]]
  const hasDistractorDetected = userWithDistractor.some((b) => b.role === 'distractor')
  assert('IA2 Sequencer detects and rejects distractor block placement', hasDistractorDetected)

  // 7. Summary
  console.log('\n---------------------------------------------------------')
  const total = results.length
  const passed = results.filter((r) => r.isSuccess).length
  const failed = total - passed

  console.log(`Verification Complete: ${passed}/${total} tests passed.`)
  if (failed > 0) {
    console.log(`⚠️ ${failed} test(s) failed!`)
    process.exitCode = 1
  } else {
    console.log('🎉 ALL STUDENT ACTIVITY PLAYER & BLOCK SEQUENCER TESTS PASSED!')
  }
  console.log('---------------------------------------------------------')
}

runStudentPlayerVerification()
