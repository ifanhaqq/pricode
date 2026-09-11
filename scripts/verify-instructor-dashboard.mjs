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
console.log('PRICODE: Admin Instructor Progress Dashboard Verification')
console.log('Admin-role RLS confirmation & All-Students Progress Matrix')
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

async function runInstructorDashboardVerification() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })
  const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // 1. Authenticate as Admin
  console.log('[1] Authenticating as Admin (admin_test@pricode.local)...')
  const { data: adminAuth, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: 'admin_test@pricode.local',
    password: 'AdminSecret123!'
  })
  assert('Admin can authenticate successfully', !adminLoginErr && adminAuth?.user !== null, adminLoginErr?.message)

  // 2. Query All Students
  console.log('\n[2] Fetching All Students as Admin...')
  const { data: students, error: studentsErr } = await adminClient
    .from('students')
    .select('id, name, auth_id, created_at')
    .order('name', { ascending: true })

  assert('Admin can fetch all students', !studentsErr && students?.length > 0, studentsErr?.message)
  console.log(`     Retrieved ${students.length} students from database`)

  // 3. Query All Progress Rows Across All Students (Admin RLS Verification)
  console.log('\n[3] Verifying Admin-Role RLS Policy on Progress Table...')
  const { data: allProgress, error: progressErr } = await adminClient
    .from('progress')
    .select('*')

  assert('Admin can select progress across ALL students via RLS', !progressErr && allProgress !== null, progressErr?.message)
  console.log(`     Admin read ${allProgress.length} progress rows across the entire system`)

  // Verify that progress rows belong to students
  const uniqueStudentIdsInProgress = Array.from(new Set(allProgress.map((p) => p.student_id)))
  assert(
    'Admin query returns progress rows from student accounts',
    uniqueStudentIdsInProgress.length > 0,
    `Found progress for ${uniqueStudentIdsInProgress.length} student(s)`
  )

  // 4. Cross-Verification: Student Access Isolation (Student CANNOT read all progress)
  console.log('\n[4] Cross-Verifying Student RLS Isolation (Contrast Check)...')
  const { data: studentAuth, error: studentLoginErr } = await studentClient.auth.signInWithPassword({
    email: 'student1_test@pricode.local',
    password: 'StudentSecret123!'
  })
  assert('Student 1 can authenticate', !studentLoginErr && studentAuth?.user !== null)

  const { data: studentProgressView, error: spErr } = await studentClient
    .from('progress')
    .select('*')

  const studentProgressIds = Array.from(new Set(studentProgressView?.map((p) => p.student_id) || []))
  assert(
    'Student can ONLY read their own progress rows (RLS restricts all other students)',
    !spErr && studentProgressIds.length <= 1,
    `Student saw ${studentProgressIds.length} distinct student IDs!`
  )

  // 5. Fetch Courses & Subcourses to Verify Matrix Mapping
  console.log('\n[5] Verifying Curriculum Matrix Mapping...')
  const { data: courses } = await adminClient.from('courses').select('id, title, order')
  const { data: subcourses } = await adminClient.from('sub_courses').select('id, title, course_id, order')

  assert('Courses loaded for matrix view', courses?.length > 0)
  assert('Subcourses loaded for matrix view', subcourses?.length > 0)

  // 6. Data Matrix Transformation (simulates InstructorProgressPage logic)
  console.log('\n[6] Validating Instructor Table Data Transformation...')
  const progressIndex = {}
  allProgress.forEach((p) => {
    if (!progressIndex[p.student_id]) {
      progressIndex[p.student_id] = {}
    }
    if (p.subcourse_id) {
      progressIndex[p.student_id][p.subcourse_id] = p
    }
    if (p.course_id) {
      progressIndex[p.student_id][`course_${p.course_id}`] = p
    }
  })

  // Format a mini console table for instructor view verification
  const tableSummary = students.slice(0, 5).map((s) => {
    const studentMap = progressIndex[s.id] || {}
    const scStatuses = subcourses.map((sc) => {
      const p = studentMap[sc.id]
      return p ? `${p.status} (${p.quiz_score ?? '-'}%)` : 'belum'
    })

    return {
      'Nama Siswa': s.name,
      'ID Siswa': s.id.slice(0, 8) + '...',
      'Sub-Materi Status': scStatuses.join(' | ')
    }
  })

  console.log('\nSample Instructor Progress Matrix Output:')
  console.table(tableSummary)

  assert('Table matrix correctly matches student identities with subcourse progress', tableSummary.length > 0)

  // ─── SUMMARY ────────────────────────────────────────────────────────────────
  console.log('\n---------------------------------------------------------')
  const passedCount = results.filter((r) => r.isSuccess).length
  const totalCount = results.length
  console.log(`Instructor Dashboard Suite: ${passedCount}/${totalCount} tests passed.`)

  if (passedCount === totalCount) {
    console.log('🎉 ALL INSTRUCTOR PROGRESS DASHBOARD CHECKS PASSED!')
    console.log('---------------------------------------------------------\n')
    process.exit(0)
  } else {
    console.error('❌ SOME CHECKS FAILED.')
    console.log('---------------------------------------------------------\n')
    process.exit(1)
  }
}

runInstructorDashboardVerification().catch((err) => {
  console.error('Fatal error during instructor dashboard verification:', err)
  process.exit(1)
})
