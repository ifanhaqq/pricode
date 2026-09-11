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
console.log('PRICODE: Authentication & Student Management Verification')
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

async function runVerification() {
  const adminClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // ─── STEP 1: Admin Login ─────────────────────────────────────────────────────
  console.log('[1] Logging in as Admin...')
  const { data: adminAuth, error: adminLoginErr } = await adminClient.auth.signInWithPassword({
    email: 'admin_test@pricode.local',
    password: 'AdminSecret123!'
  })

  assert('Admin can log in successfully', !adminLoginErr && adminAuth?.user !== null, adminLoginErr?.message)

  if (!adminAuth?.user) {
    console.error('Fatal: Admin login failed. Cannot proceed with admin tests.')
    process.exitCode = 1
    return
  }

  // ─── STEP 2: Admin Creates New Student via RPC ───────────────────────────────
  console.log('\n[2] Admin creates new student account (no email verification)...')
  const testUsername = `budi_${Date.now() % 10000}`
  const initialPassword = 'BudiPassword123!'
  const updatedPassword = 'BudiBaru456!'

  let createdStudentId = null

  const { data: createData, error: createErr } = await adminClient.rpc('admin_create_student', {
    p_username: testUsername,
    p_name: 'Budi Test Siswa',
    p_password: initialPassword
  })

  assert(
    `Admin can create student "${testUsername}" via RPC`,
    !createErr && createData?.success === true,
    createErr?.message
  )

  createdStudentId = createData?.student_id

  if (!createdStudentId) {
    console.error('Fatal: Student creation failed.')
    console.error('\n👉 Did you execute `supabase/auth-functions.sql` in Supabase SQL Editor?')
    process.exitCode = 1
    return
  }

  // ─── STEP 3: Student Logs In With Synthetic Email ────────────────────────────
  console.log(`\n[3] Student logs in using username "${testUsername}"...`)
  const studentClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // Map username to synthetic email: username@codingclub.scr
  const syntheticEmail = `${testUsername}@codingclub.scr`

  const { data: studentAuth, error: studentLoginErr } = await studentClient.auth.signInWithPassword({
    email: syntheticEmail,
    password: initialPassword
  })

  assert(
    `Student can log in using synthetic email (${syntheticEmail})`,
    !studentLoginErr && studentAuth?.user !== null,
    studentLoginErr?.message
  )

  // ─── STEP 4: Student Role & Route Isolation ──────────────────────────────────
  console.log('\n[4] Verifying Student Role & Security Boundaries...')
  const { data: roleData } = await studentClient
    .from('user_roles')
    .select('role')
    .eq('user_id', studentAuth.user.id)
    .single()

  assert(
    'User role is correctly identified as "student"',
    roleData?.role === 'student',
    `Detected role: ${roleData?.role}`
  )

  // Student attempts to call admin_create_student RPC (must be rejected!)
  const { error: rogueCreateErr } = await studentClient.rpc('admin_create_student', {
    p_username: 'rogue_student',
    p_name: 'Hacked',
    p_password: 'Password123!'
  })

  assert(
    'Student CANNOT call admin_create_student (Akses ditolak)',
    rogueCreateErr !== null,
    rogueCreateErr ? `Rejected with: ${rogueCreateErr.message}` : 'Unexpectedly allowed!'
  )

  // Student attempts to call admin_reset_student_password RPC (must be rejected!)
  const { error: rogueResetErr } = await studentClient.rpc('admin_reset_student_password', {
    p_student_id: createdStudentId,
    p_new_password: 'HackedPassword!'
  })

  assert(
    'Student CANNOT call admin_reset_student_password (Akses ditolak)',
    rogueResetErr !== null,
    rogueResetErr ? `Rejected with: ${rogueResetErr.message}` : 'Unexpectedly allowed!'
  )

  // ─── STEP 5: Admin Resets Student Password ────────────────────────────────────
  console.log('\n[5] Admin resets student password directly...')
  const { data: resetData, error: resetErr } = await adminClient.rpc('admin_reset_student_password', {
    p_student_id: createdStudentId,
    p_new_password: updatedPassword
  })

  assert(
    'Admin can reset student password via RPC',
    !resetErr && resetData?.success === true,
    resetErr?.message
  )

  // ─── STEP 6: Verify New Password Works & Old Password Fails ──────────────────
  console.log('\n[6] Verifying updated password login...')
  const testNewLoginClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // Old password must fail
  const { error: oldPwErr } = await testNewLoginClient.auth.signInWithPassword({
    email: syntheticEmail,
    password: initialPassword
  })
  assert('Old password is now INVALID', oldPwErr !== null, 'Old password still worked!')

  // New password must succeed
  const { data: newLoginData, error: newPwErr } = await testNewLoginClient.auth.signInWithPassword({
    email: syntheticEmail,
    password: updatedPassword
  })
  assert('New password logs in successfully', !newPwErr && newLoginData?.user !== null, newPwErr?.message)

  // ─── FINAL SUMMARY ───────────────────────────────────────────────────────────
  console.log('\n=========================================================')
  console.log('AUTHENTICATION TEST SUMMARY')
  console.log('=========================================================')
  const total = results.length
  const passed = results.filter(r => r.isSuccess).length
  const failed = total - passed

  console.log(`Total Tests Run: ${total}`)
  console.log(`Passed:         ${passed}`)
  console.log(`Failed:         ${failed}`)

  if (failed === 0) {
    console.log('\n🎉 ALL AUTHENTICATION FLOWS VERIFIED SUCCESSFULLY! 🎉')
  } else {
    console.error(`\n⚠️  ${failed} test(s) failed. Please check the logs above.`)
    process.exitCode = 1
  }
}

runVerification().catch(err => {
  console.error('Fatal execution error in test script:', err)
  process.exitCode = 1
})

