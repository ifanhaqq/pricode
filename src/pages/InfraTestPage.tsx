import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseUrl, isSupabaseConfigured } from '../lib/supabase'
import { CheckCircle2, XCircle, AlertCircle, RefreshCw, Database, Server, Globe, ArrowLeft } from 'lucide-react'

interface TestRow {
  id?: number | string
  created_at?: string
  message?: string
  [key: string]: unknown
}

export default function InfraTestPage() {
  const [tableName, setTableName] = useState('courses')
  const [data, setData] = useState<TestRow | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [latency, setLatency] = useState<number | null>(null)

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

      if (queryError) throw queryError

      if (rows && rows.length > 0) {
        setData(rows[0] as TestRow)
      } else {
        setData(null)
        setError(`Table "${tableName}" was reached, but returned 0 rows.`)
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Failed to query Supabase table.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tableName])

  useEffect(() => {
    testConnection()
  }, [testConnection])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center p-4 md:p-8">
      <div className="w-full max-w-4xl space-y-6">
        <header className="border-b border-slate-800 pb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <Link to="/login" className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-white mb-2">
              <ArrowLeft className="w-3.5 h-3.5" /> Kembali ke Login
            </Link>
            <h1 className="text-2xl font-bold tracking-tight text-white">Uji Infrastruktur Database</h1>
            <p className="text-sm text-slate-400 mt-1">Status koneksi langsung ke Supabase</p>
          </div>

          <button
            onClick={testConnection}
            disabled={loading}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-sky-600 hover:bg-sky-500 text-white transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Uji Ulang
          </button>
        </header>

        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Globe className="w-5 h-5 text-sky-400 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Build & Host</p>
              <p className="text-sm font-medium text-white mt-1">Vite + GitHub Pages</p>
              <p className="text-xs text-slate-500 mt-0.5">Mode: {import.meta.env.MODE}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Server className="w-5 h-5 text-indigo-400 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Environment</p>
              <p className="text-sm font-medium text-white mt-1">
                {isSupabaseConfigured ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Terkonfigurasi
                  </span>
                ) : (
                  <span className="text-rose-400 flex items-center gap-1">
                    <XCircle className="w-4 h-4" /> Belum Ada Kunci
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5 truncate max-w-[200px]">{supabaseUrl}</p>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-start gap-3">
            <Database className="w-5 h-5 text-emerald-400 mt-0.5" />
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-400 font-semibold">Database Query</p>
              <p className="text-sm font-medium mt-1">
                {loading ? (
                  <span className="text-amber-400 flex items-center gap-1">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" /> Querying...
                  </span>
                ) : data ? (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" /> Terhubung
                  </span>
                ) : (
                  <span className="text-amber-400 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" /> Perlu Perhatian
                  </span>
                )}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">{latency !== null ? `${latency}ms` : '-'}</p>
            </div>
          </div>
        </section>

        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-sm font-semibold text-white">Target Tabel</h2>
            <input
              type="text"
              value={tableName}
              onChange={(e) => setTableName(e.target.value)}
              className="bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white font-mono"
            />
          </div>

          {data && (
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 font-mono text-xs overflow-x-auto">
              <pre className="text-slate-200">{JSON.stringify(data, null, 2)}</pre>
            </div>
          )}

          {error && (
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg text-xs text-amber-300">
              {error}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
