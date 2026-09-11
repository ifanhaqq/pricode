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
console.log('PRICODE: Student Progress Reset Verification Suite')
console.log('Validating Global Reset, Single Reset, and RLS Protection')
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

async function runResetVerification() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })
  const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // 1. Authenticate Admin
  console.log('[1] Authenticating as Admin (admin_test@pricode.local)...')
  const { data: adminAuth, error: adminAuthErr } = await adminClient.auth.signInWithPassword({
    email: 'admin_test@pricode.local',
    password: 'AdminSecret123!'
  })
  assert('Admin authenticated successfully', !adminAuthErr && adminAuth?.user !== null, adminAuthErr?.message)

  // 2. Authenticate Student 1
  console.log('\n[2] Authenticating as Student (student1_test@pricode.local)...')
  const { data: studentAuth, error: studentAuthErr } = await studentClient.auth.signInWithPassword({
    email: 'student1_test@pricode.local',
    password: 'StudentSecret123!'
  })
  assert('Student 1 authenticated successfully', !studentAuthErr && studentAuth?.user !== null, studentAuthErr?.message)

  // Fetch Student 1 profile
  const { data: studentProfile } = await studentClient
    .from('students')
    .select('id, name')
    .eq('auth_id', studentAuth.user.id)
    .single()
  assert('Student 1 profile retrieved', studentProfile?.id !== undefined)
  const student1Id = studentProfile.id

  // Fetch a valid subcourse
  const { data: subcourses } = await adminClient
    .from('sub_courses')
    .select('id, title, course_id')
    .order('order', { ascending: true })
    .limit(2)
  assert('Curriculum subcourses available for test', subcourses?.length >= 1)
  const subcourse1 = subcourses[0]
  const subcourse2 = subcourses[1] || subcourses[0]

  // 3. Seed mock progress for Student 1
  console.log('\n[3] Seeding test progress for Student 1...')
  const { error: seedErr } = await adminClient.from('progress').upsert([
    {
      student_id: student1Id,
      subcourse_id: subcourse1.id,
      status: 'completed',
      quiz_score: 95,
      attempts: 2,
      completed_activities: ['text', 'video', 'ia1', 'ia2', 'quiz'],
      updated_at: new Date().toISOString()
    }
  ])
  assert('Test progress record seeded', !seedErr, seedErr?.message)

  // Verify progress exists
  const { data: beforeDel } = await adminClient
    .from('progress')
    .select('*')
    .eq('student_id', student1Id)
  assert('Test progress record confirmed in database', beforeDel?.length >= 1)

  // 4. Test RLS Security: Student CANNOT delete progress
  console.log('\n[4] Verifying RLS Enforcement: Student CANNOT delete progress...')
  const { count: studentDelCount, error: studentDelErr } = await studentClient
    .from('progress')
    .delete({ count: 'exact' })
    .eq('student_id', student1Id)

  assert(
    'Student delete attempt is blocked / affects 0 rows by RLS',
    studentDelCount === 0 || studentDelErr !== null,
    `Affected rows: ${studentDelCount}`
  )

  // 5. Test Admin Per-Student Reset
  console.log('\n[5] Verifying Admin Per-Student Reset...')
  const { count: adminSingleDelCount, error: adminSingleDelErr } = await adminClient
    .from('progress')
    .delete({ count: 'exact' })
    .eq('student_id', student1Id)

  assert(
    'Admin successfully deleted progress for target student',
    !adminSingleDelErr && (adminSingleDelCount || 0) >= 1,
    adminSingleDelErr?.message
  )

  const { data: studentProgAfterSingle } = await adminClient
    .from('progress')
    .select('*')
    .eq('student_id', student1Id)
  assert('Target student progress is confirmed 0 in database', studentProgAfterSingle?.length === 0)

  // 6. Test Global Reset
  console.log('\n[6] Verifying Admin Global Reset (All Students)...')
  // Seed multiple records
  await adminClient.from('progress').upsert([
    {
      student_id: student1Id,
      subcourse_id: subcourse1.id,
      status: 'in_progress',
      quiz_score: 50,
      attempts: 1,
      completed_activities: ['text'],
      updated_at: new Date().toISOString()
    },
    {
      student_id: student1Id,
      subcourse_id: subcourse2.id,
      status: 'locked',
      attempts: 0,
      completed_activities: [],
      updated_at: new Date().toISOString()
    }
  ])

  // Execute global reset
  const { count: globalDelCount, error: globalDelErr } = await adminClient
    .from('progress')
    .delete({ count: 'exact' })
    .neq('student_id', '00000000-0000-0000-0000-000000000000')

  assert('Admin successfully executed global reset', !globalDelErr && (globalDelCount || 0) >= 2, globalDelErr?.message)

  const { count: remainingCount } = await adminClient
    .from('progress')
    .select('*', { count: 'exact' })
  assert('Entire database progress count is exactly 0 after global reset', remainingCount === 0)

  // 7. Verify Gating Behavior Post-Reset
  console.log('\n[7] Verifying Post-Reset Gating Behavior for Student...')
  const { data: freshProg } = await studentClient
    .from('progress')
    .select('*')
    .eq('student_id', student1Id)
  assert('Student sees exactly 0 progress records', freshProg?.length === 0)

  console.log('\n---------------------------------------------------------')
  const passed = results.filter((r) => r.isSuccess).length
  const total = results.length
  console.log(`Reset Progress Suite: ${passed}/${total} tests passed.`)

  if (passed === total) {
    console.log('🎉 ALL PROGRESS RESET CHECKS PASSED!')
    console.log('---------------------------------------------------------\n')
    process.exit(0)
  } else {
    console.error('❌ SOME CHECKS FAILED!')
    console.log('---------------------------------------------------------\n')
    process.exit(1)
  }
}

runResetVerification().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
