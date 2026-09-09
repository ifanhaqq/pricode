import { useState, useEffect, useCallback } from 'react'
import { supabase, supabaseUrl, supabaseAnonKey, isSupabaseConfigured } from './lib/supabase'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Database, Server, Globe, Terminal, Copy, Check } from 'lucide-react'

interface TestRow {
  id?: number | string
  created_at?: string
  message?: string
  [key: string]: unknown
}

export default function App() {
  const [tableName, setTableName] = useState('test_connection')
  const [data, setData] = useState<TestRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)

  const testConnection = useCallback(async () => {
    if (!isSupabaseConfigured || !supabase) {
      setError('Supabase is not configured. Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY.')
      return
    }

    setLoading(true)
    setError(null)
    const startTime = performance.now()

    try {
      const { data: rows, error: queryError } = await supabase
        .from(tableName)
        .select('*')
        .limit(1)

      const endTime = performance.now()
      setLatency(Math.round(endTime - startTime))

      if (queryError) {
        throw queryError
      }

      if (rows && rows.length > 0) {
        setData(rows[0] as TestRow)
      } else {
        setData(null)
        setError(`Table "${tableName}" was reached successfully, but contains 0 rows. Please insert a test row to complete verification.`)
      }
    } catch (err: unknown) {
      const e = err as { message?: string; details?: string; hint?: string; code?: string }
      setError(e.message || 'Failed to query Supabase table.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tableName])

  useEffect(() => {
    testConnection()
  }, [testConnection])

  const copySql = () => {
    const sql = `-- Run this in Supabase SQL Editor:
create table if not exists test_connection (
  id bigint primary key generated always as identity,
  created_at timestamptz default now(),
  message text not null
);

alter table test_connection enable row level security;

create policy "Allow anonymous read" on test_connection
  for select to anon using (true);

insert into test_connection (message)
values ('Hello from Supabase! Connection verified successfully.');`
    navigator.clipboard.writeText(sql)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const maskedKey = supabaseAnonKey 
    ? `${supabaseAnonKey.slice(0, 15)}...${supabaseAnonKey.slice(-6)}` 
    : 'Not configured'

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Phase 0
              </span>
              <h1 className="text-2xl font-bold tracking-tight text-white">PRICODE</h1>
            </div>
            <p className="text-sm text-slate-400 mt-1">
              Infrastructure Verification (React + Vite + GitHub Pages + Supabase)
            </p>
          </div>

          <button
            onClick={testConnection}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50 shadow-sm"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Re-test Connection
          </button>
        </header>

        {/* Pipeline Checklist */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Globe className="w-5 h-5 text-sky-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Build & Host</p>
              <p className="text-sm font-medium text-white mt-1">Vite + GitHub Pages</p>
              <p className="text-xs text-slate-500 mt-0.5">Mode: {import.meta.env.MODE}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Server className="w-5 h-5 text-indigo-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Environment</p>
              <p className="text-sm font-medium text-white mt-1">
                {isSupabaseConfigured ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 inline" /> Keys Present
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4 inline" /> Missing Keys
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]" title={supabaseUrl}>
                {supabaseUrl || 'No URL'}
              </p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Database className="w-5 h-5 text-emerald-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Database Query</p>
              <p className="text-sm font-medium mt-1">
                {loading ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying...
                  </span>
                ) : data ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4 inline" /> Connected
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4 inline" /> Action Needed
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {latency !== null ? `${latency}ms response time` : 'Waiting for probe'}
              </p>
            </div>
          </div>
        </section>

        {/* Database Query Details */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-base font-semibold text-white">Live Query Verification</h2>
              <p className="text-xs text-slate-400">
                Fetching 1 row from Supabase via public anon client
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label htmlFor="tableName" className="text-xs text-slate-400">Table:</label>
              <input
                id="tableName"
                type="text"
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white focus:outline-none focus:border-sky-500 font-mono"
                placeholder="table_name"
              />
            </div>
          </div>

          {/* Result State */}
          {loading && (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400">
              <RefreshCw className="w-8 h-8 animate-spin text-sky-400 mb-3" />
              <p className="text-sm">Connecting to Supabase at {supabaseUrl}...</p>
            </div>
          )}

          {!loading && data && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-4 py-2.5 rounded-lg text-sm">
                <CheckCircle2 className="w-5 h-5 shrink-0" />
                <span>
                  <strong>Success!</strong> Supabase query returned 1 row from <code className="text-emerald-300 font-mono">{tableName}</code>.
                </span>
              </div>

              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto">
                <p className="text-slate-500 mb-2">// Row Content:</p>
                <pre className="text-slate-200">{JSON.stringify(data, null, 2)}</pre>
              </div>
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4">
              <div className="flex items-start gap-2.5 text-amber-300 bg-amber-500/10 border border-amber-500/20 px-4 py-3 rounded-lg text-sm">
                <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-amber-400" />
                <div className="space-y-1">
                  <p className="font-medium text-amber-200">Table Query Notice</p>
                  <p className="text-xs text-amber-300/90">{error}</p>
                </div>
              </div>

              {/* SQL Helper if table needs creation */}
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
                    <Terminal className="w-4 h-4 text-sky-400" />
                    <span>Run this in Supabase SQL Editor to create the test table:</span>
                  </div>
                  <button
                    onClick={copySql}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy SQL'}
                  </button>
                </div>

                <pre className="text-xs font-mono text-slate-400 overflow-x-auto p-3 bg-slate-900 rounded border border-slate-800">
{`create table if not exists test_connection (
  id bigint primary key generated always as identity,
  created_at timestamptz default now(),
  message text not null
);

alter table test_connection enable row level security;

create policy "Allow anonymous read" on test_connection
  for select to anon using (true);

insert into test_connection (message)
values ('Hello from Supabase! Connection verified successfully.');`}
                </pre>
              </div>
            </div>
          )}
        </section>

        {/* Configuration Inspector */}
        <section className="bg-slate-900/50 border border-slate-800/80 rounded-xl p-4 text-xs text-slate-400 space-y-2">
          <p className="font-semibold text-slate-300">Active Environment Parameters:</p>
          <ul className="space-y-1 font-mono">
            <li>• <span className="text-slate-500">VITE_SUPABASE_URL:</span> {supabaseUrl || '<empty>'}</li>
            <li>• <span className="text-slate-500">VITE_SUPABASE_ANON_KEY:</span> {maskedKey}</li>
          </ul>
        </section>
      </div>
    </div>
  )
}

