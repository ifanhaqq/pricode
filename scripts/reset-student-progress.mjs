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

// Parse arguments
const args = process.argv.slice(2)
let studentIdArg = null
for (const a of args) {
  if (a.startsWith('--student=')) {
    studentIdArg = a.split('=')[1].trim()
  } else if (a === '--student' && args[args.indexOf(a) + 1]) {
    studentIdArg = args[args.indexOf(a) + 1].trim()
  }
}

async function runReset() {
  console.log('---------------------------------------------------------')
  console.log('PRICODE: Student Progress Reset Tool (Admin)')
  console.log(`Endpoint: ${SUPABASE_URL}`)
  console.log(`Target  : ${studentIdArg ? `Student ID: ${studentIdArg}` : 'ALL STUDENTS (Global Reset)'}`)
  console.log('---------------------------------------------------------\n')

  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  })

  // 1. Authenticate as Admin
  console.log('Authenticating as Admin (admin_test@pricode.local)...')
  const { data: authData, error: authErr } = await client.auth.signInWithPassword({
    email: 'admin_test@pricode.local',
    password: 'AdminSecret123!'
  })

  if (authErr || !authData?.user) {
    console.error('❌ Failed to authenticate as admin:', authErr?.message)
    process.exit(1)
  }
  console.log('✅ Authenticated as Admin successfully.\n')

  // 2. Count before deletion
  let preQuery = client.from('progress').select('*', { count: 'exact' })
  if (studentIdArg) {
    preQuery = preQuery.eq('student_id', studentIdArg)
  }
  const { count: beforeCount, error: preErr } = await preQuery
  if (preErr) {
    console.error('❌ Failed to inspect progress table:', preErr.message)
    process.exit(1)
  }

  console.log(`Found ${beforeCount || 0} progress record(s) matching criteria before deletion.`)

  if ((beforeCount || 0) === 0) {
    console.log('ℹ️  No progress records found to delete. Progress is already at 0.')
    console.log('\n---------------------------------------------------------')
    console.log('Reset complete. 0 rows affected.')
    console.log('---------------------------------------------------------')
    return
  }

  // 3. Execute Delete
  let delQuery = client.from('progress').delete({ count: 'exact' })
  if (studentIdArg) {
    delQuery = delQuery.eq('student_id', studentIdArg)
  } else {
    delQuery = delQuery.neq('student_id', '00000000-0000-0000-0000-000000000000')
  }

  const { count: deletedCount, error: delErr } = await delQuery
  if (delErr) {
    console.error('❌ Error during deletion:', delErr.message)
    process.exit(1)
  }

  console.log(`✅ Successfully deleted ${deletedCount} progress record(s).`)

  // 4. Verify post-deletion state
  const { count: remainingCount } = await client
    .from('progress')
    .select('*', { count: 'exact' })

  console.log(`Remaining progress records in system: ${remainingCount || 0}`)
  console.log('\n---------------------------------------------------------')
  console.log('🎉 Student progress has been reset to 0 (clean state).')
  console.log('---------------------------------------------------------')
}

runReset().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
