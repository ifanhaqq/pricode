import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase, supabaseUrl, isSupabaseConfigured } from '../lib/supabase'
import { CheckCircle2, XCircle, RefreshCw, Database, Server, Globe, ArrowLeft, Zap } from 'lucide-react'

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
        setError(`Tabel "${tableName}" berhasil dijangkau, namun belum memiliki data (0 baris).`)
      }
    } catch (err: unknown) {
      const e = err as { message?: string }
      setError(e.message || 'Gagal melakukan query ke tabel Supabase.')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [tableName])

  useEffect(() => {
    testConnection()
  }, [testConnection])

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col items-center p-4 sm:p-6 md:p-8 font-sans">
      <div className="w-full max-w-4xl space-y-6 pb-12">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-5">
          <div className="space-y-1">
            <Link
              to="/login"
              className="btn-brutal-white text-xs py-1.5 px-3 inline-flex items-center gap-1.5 mb-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Kembali ke Login</span>
            </Link>
            <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black flex items-center gap-3">
              <Database className="w-8 h-8 text-retro-yellow" />
              Uji Infrastruktur Database
            </h1>
            <p className="text-xs text-neutral-700 font-medium">
              Verifikasi status koneksi real-time, latensi jaringan, dan pembacaan tabel Supabase.
            </p>
          </div>

          <button
            onClick={testConnection}
            disabled={loading}
            className="btn-brutal-yellow text-xs py-2.5 px-4 inline-flex items-center gap-2 self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Uji Ulang Koneksi</span>
          </button>
        </div>

        {/* Status Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card-brutal bg-white p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-retro-yellow border-2 border-black flex items-center justify-center flex-shrink-0 shadow-brutal-sm">
              <Globe className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-neutral-500 font-mono">
                Build & Host
              </p>
              <p className="text-sm font-black text-black mt-0.5">Vite + GitHub Pages</p>
              <p className="text-[11px] font-mono text-neutral-600">Mode: {import.meta.env.MODE}</p>
            </div>
          </div>

          <div className="card-brutal bg-white p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-retro-green border-2 border-black flex items-center justify-center flex-shrink-0 shadow-brutal-sm">
              <Server className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-neutral-500 font-mono">
                Status Supabase
              </p>
              <p className="text-sm font-black text-black mt-0.5">
                {isSupabaseConfigured ? (
                  <span className="text-black flex items-center gap-1 font-black">
                    <CheckCircle2 className="w-4 h-4 text-retro-green stroke-[3]" /> Terkonfigurasi
                  </span>
                ) : (
                  <span className="text-rose-600 flex items-center gap-1 font-black">
                    <XCircle className="w-4 h-4" /> Belum Konfigurasi
                  </span>
                )}
              </p>
              <p className="text-[11px] font-mono text-neutral-600 truncate max-w-[180px]">
                {supabaseUrl || 'URL Tidak Ditemukan'}
              </p>
            </div>
          </div>

          <div className="card-brutal bg-white p-5 flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-xl bg-retro-lavender border-2 border-black flex items-center justify-center flex-shrink-0 shadow-brutal-sm">
              <Zap className="w-5 h-5 text-black" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider font-black text-neutral-500 font-mono">
                Latensi Jaringan
              </p>
              <p className="text-sm font-black text-black mt-0.5 font-mono">
                {latency !== null ? `${latency} ms` : '-'}
              </p>
              <p className="text-[11px] text-neutral-600 font-medium">
                {latency !== null && latency < 300 ? '⚡ Sangat Cepat' : 'Koneksi Stabil'}
              </p>
            </div>
          </div>
        </div>

        {/* Table Selector & Query Panel */}
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
            <div>
              <h2 className="text-lg font-black text-black flex items-center gap-2">
                <span>Uji Query Tabel Database</span>
              </h2>
              <p className="text-xs text-neutral-600 mt-0.5">
                Pilih tabel untuk memverifikasi kebijakan Row Level Security dan struktur data.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-xs font-black uppercase text-neutral-700">Tabel:</label>
              <select
                value={tableName}
                onChange={(e) => setTableName(e.target.value)}
                className="input-brutal py-1.5 px-3 text-xs font-mono font-bold bg-retro-yellow/20"
              >
                <option value="courses">courses</option>
                <option value="sub_courses">sub_courses</option>
                <option value="activities">activities</option>
                <option value="ia_blocks">ia_blocks</option>
                <option value="sub_course_quizzes">sub_course_quizzes</option>
                <option value="final_quizzes">final_quizzes</option>
                <option value="questions">questions</option>
                <option value="students">students</option>
              </select>
            </div>
          </div>

          {/* Results Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-black font-mono">
                Respon Query (1 Baris Pertama):
              </span>
              {loading ? (
                <span className="badge-brutal bg-retro-yellow text-black text-[10px] animate-pulse">
                  Menghubungi Server...
                </span>
              ) : error ? (
                <span className="badge-brutal bg-retro-pink text-white text-[10px]">
                  Ada Masalah
                </span>
              ) : (
                <span className="badge-brutal bg-retro-green text-black text-[10px]">
                  Koneksi Berhasil (200 OK)
                </span>
              )}
            </div>

            {error && (
              <div className="card-brutal bg-retro-pink p-4 text-white text-xs font-bold flex items-start gap-2.5">
                <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {data && (
              <div className="p-4 rounded-xl border-2 border-black bg-black text-retro-green font-mono text-xs overflow-x-auto shadow-brutal-sm">
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </div>
            )}

            {!loading && !error && !data && (
              <div className="p-8 text-center text-xs font-bold text-neutral-500 border-2 border-dashed border-black/30 rounded-xl">
                Tidak ada data untuk ditampilkan.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
