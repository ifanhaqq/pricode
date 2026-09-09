import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

// Read .env file to extract Supabase credentials
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

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Error: Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env')
  process.exit(1)
}

console.log('---------------------------------------------------------')
console.log('PRICODE: Supabase Schema & RLS Verification Suite')
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

async function createAuthClient(email, password) {
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })
  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    throw new Error(`Authentication failed for ${email}: ${error.message}`)
  }
  return { client, user: data.user }
}

async function runVerification() {
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // ─── SUITE 0: Authenticate Test Accounts ─────────────────────────────────────
  console.log('\n[0] Authenticating test accounts...')
  let student1, student2, admin
  try {
    student1 = await createAuthClient('student1_test@pricode.local', 'StudentSecret123!')
    console.log('  Authenticated: student1_test@pricode.local (Student 1)')
  } catch (err) {
    console.error(`  Failed to login as student1: ${err.message}`)
    console.error('\n👉 Please run `supabase/schema.sql` in your Supabase SQL Editor first!')
    process.exitCode = 1
    return
  }

  try {
    student2 = await createAuthClient('student2_test@pricode.local', 'StudentSecret123!')
    console.log('  Authenticated: student2_test@pricode.local (Student 2)')
  } catch (err) {
    console.error(`  Failed to login as student2: ${err.message}`)
    process.exitCode = 1
    return
  }

  try {
    admin = await createAuthClient('admin_test@pricode.local', 'AdminSecret123!')
    console.log('  Authenticated: admin_test@pricode.local (Admin)')
  } catch (err) {
    console.error(`  Failed to login as admin: ${err.message}`)
    process.exitCode = 1
    return
  }

  // Retrieve student profile IDs
  const { data: s1Data } = await student1.client.from('students').select('id').single()
  const { data: s2Data } = await student2.client.from('students').select('id').single()
  const student1Id = s1Data?.id
  const student2Id = s2Data?.id

  // Retrieve a subcourse ID to test with
  const { data: subcourses } = await student1.client.from('sub_courses').select('id, course_id').limit(1)
  const testSubcourseId = subcourses?.[0]?.id
  const testCourseId = subcourses?.[0]?.course_id

  if (!testSubcourseId || !student1Id || !student2Id) {
    console.error('Error: Seed data missing. Ensure `supabase/schema.sql` was executed completely.')
    process.exit(1)
  }

  // ─── SUITE 1: Anonymous (Unauthenticated) Access ─────────────────────────────
  console.log('\n[1] Testing Anonymous Access (Should be blocked by RLS)...')
  {
    const { data, error } = await anonClient.from('courses').select('*')
    assert('Anon CANNOT read courses', data?.length === 0 || error !== null, error?.message || `Got ${data?.length} rows`)
  }
  {
    const { data, error } = await anonClient.from('progress').select('*')
    assert('Anon CANNOT read progress', data?.length === 0 || error !== null, error?.message || `Got ${data?.length} rows`)
  }
  {
    const { error } = await anonClient.from('courses').insert({ title: 'Anon Course', order: 99 })
    assert('Anon CANNOT insert courses', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }

  // ─── SUITE 2: Student Allowed Reads ──────────────────────────────────────────
  console.log('\n[2] Testing Student 1 Read Permissions (Should succeed)...')
  {
    const { data, error } = await student1.client.from('courses').select('*')
    assert('Student CAN read courses', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('sub_courses').select('*')
    assert('Student CAN read sub_courses', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('activities').select('*')
    assert('Student CAN read activities', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('ia_blocks').select('*')
    assert('Student CAN read ia_blocks', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('sub_course_quizzes').select('*')
    assert('Student CAN read sub_course_quizzes', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('final_quizzes').select('*')
    assert('Student CAN read final_quizzes', !error && data?.length > 0, error?.message)
  }
  {
    const { data, error } = await student1.client.from('questions').select('*')
    assert('Student CAN read questions', !error && data?.length > 0, error?.message)
  }

  // ─── SUITE 3: Student Forbidden Mutations on Curriculum ──────────────────────
  console.log('\n[3] Testing Student 1 Forbidden Curriculum Writes (Should be rejected)...')
  {
    const { error } = await student1.client.from('courses').insert({ title: 'Student Rogue Course', order: 99 })
    assert('Student CANNOT insert course', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }
  {
    const { error, count } = await student1.client
      .from('courses')
      .update({ title: 'Student Defaced Course' })
      .eq('id', testCourseId)
      .select()
    assert('Student CANNOT update course', error !== null || count === 0, error ? `Blocked: ${error.message}` : `Modified ${count} rows`)
  }
  {
    const { error, count } = await student1.client
      .from('courses')
      .delete()
      .eq('id', testCourseId)
      .select()
    assert('Student CANNOT delete course', error !== null || count === 0, error ? `Blocked: ${error.message}` : `Deleted ${count} rows`)
  }
  {
    const { error } = await student1.client.from('activities').insert({
      subcourse_id: testSubcourseId,
      type: 'text',
      order: 10,
      content_ref: { text: 'Forbidden' }
    })
    assert('Student CANNOT insert activity', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }
  {
    const { error } = await student1.client.from('questions').insert({
      sub_course_quiz_id: testSubcourseId,
      prompt: 'Forbidden prompt?',
      options: ['a'],
      correct_answer: 'a'
    })
    assert('Student CANNOT insert question', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }
  {
    const { error } = await student1.client.from('students').insert({
      name: 'Rogue Student',
      auth_id: student1.user.id
    })
    assert('Student CANNOT insert student record', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }

  // ─── SUITE 4: Progress Isolation & Student Self-Progress ─────────────────────
  console.log('\n[4] Testing Progress Isolation & Student Permissions...')
  // Cleanup any old test progress rows first
  await admin.client.from('progress').delete().eq('subcourse_id', testSubcourseId)

  // 4a. Student 1 inserts own progress
  {
    const { data, error } = await student1.client.from('progress').insert({
      student_id: student1Id,
      subcourse_id: testSubcourseId,
      status: 'in_progress',
      quiz_score: 85,
      attempts: 1
    }).select()
    assert('Student 1 CAN insert own progress', !error && data?.length > 0, error?.message)
  }

  // 4b. Student 1 updates own progress
  {
    const { data, error } = await student1.client.from('progress').update({
      quiz_score: 95,
      status: 'completed'
    }).eq('student_id', student1Id).eq('subcourse_id', testSubcourseId).select()
    assert('Student 1 CAN update own progress', !error && data?.length > 0, error?.message)
  }

  // 4c. Student 1 reads own progress
  {
    const { data, error } = await student1.client.from('progress').select('*').eq('student_id', student1Id)
    assert('Student 1 CAN read own progress', !error && data?.length === 1, error?.message)
  }

  // 4d. Student 2 inserts own progress
  {
    const { error } = await student2.client.from('progress').insert({
      student_id: student2Id,
      subcourse_id: testSubcourseId,
      status: 'in_progress',
      quiz_score: 60,
      attempts: 1
    })
    assert('Student 2 CAN insert own progress', !error, error?.message)
  }

  // 4e. Cross-student Read Protection: Student 1 attempts to read Student 2's progress
  {
    const { data, error } = await student1.client.from('progress').select('*').eq('student_id', student2Id)
    assert('Student 1 CANNOT read Student 2 progress', !error && (data === null || data.length === 0), `Found ${data?.length} rows!`)
  }

  // 4f. Cross-student Write Protection: Student 1 attempts to insert progress for Student 2
  {
    const { error } = await student1.client.from('progress').insert({
      student_id: student2Id,
      subcourse_id: testSubcourseId,
      status: 'completed',
      quiz_score: 100
    })
    assert('Student 1 CANNOT insert progress for Student 2', error !== null, error ? `Blocked: ${error.message}` : 'Unexpectedly allowed!')
  }

  // 4g. Cross-student Update Protection: Student 1 attempts to alter Student 2's score
  {
    const { error, data } = await student1.client.from('progress').update({
      quiz_score: 0
    }).eq('student_id', student2Id).select()
    assert('Student 1 CANNOT update Student 2 progress', error !== null || data?.length === 0, `Tampered ${data?.length} rows!`)
  }

  // 4h. Student delete protection: Student 1 cannot delete progress
  {
    const { error, data } = await student1.client.from('progress').delete().eq('student_id', student1Id).select()
    assert('Student CANNOT delete progress rows', error !== null || data?.length === 0, error ? `Blocked: ${error.message}` : `Deleted ${data?.length} rows!`)
  }

  // ─── SUITE 5: Admin Full Access ──────────────────────────────────────────────
  console.log('\n[5] Testing Admin Privileges (Should succeed on all)...')
  let createdCourseId
  {
    const { data, error } = await admin.client.from('courses').insert({
      title: 'Admin Test Course',
      order: 999,
      description: 'Temporary course to verify admin write permissions'
    }).select().single()
    createdCourseId = data?.id
    assert('Admin CAN insert course', !error && createdCourseId !== undefined, error?.message)
  }

  {
    const { data, error } = await admin.client.from('courses').update({
      description: 'Updated by Admin'
    }).eq('id', createdCourseId).select().single()
    assert('Admin CAN update course', !error && data?.description === 'Updated by Admin', error?.message)
  }

  {
    const { error } = await admin.client.from('courses').delete().eq('id', createdCourseId)
    assert('Admin CAN delete course', !error, error?.message)
  }

  {
    const { data, error } = await admin.client.from('progress').select('*')
    assert('Admin CAN select all students progress (Dashboard overview)', !error && data?.length >= 2, error?.message || `Got ${data?.length} rows`)
  }

  // ─── FINAL SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n=========================================================')
  console.log('TEST SUMMARY')
  console.log('=========================================================')
  const total = results.length
  const passed = results.filter(r => r.isSuccess).length
  const failed = total - passed

  console.log(`Total Tests Run: ${total}`)
  console.log(`Passed:         ${passed}`)
  console.log(`Failed:         ${failed}`)

  if (failed === 0) {
    console.log('\n🎉 ALL SECURITY POLICIES VERIFIED SUCCESSFULLY! 🎉')
    console.log('Database schema and Row Level Security are completely locked down.')
  } else {
    console.error(`\n⚠️  ${failed} test(s) failed. Please check the logs above.`)
    process.exitCode = 1
  }
}

runVerification().catch(err => {
  console.error('Fatal execution error in test script:', err)
  process.exitCode = 1
})
