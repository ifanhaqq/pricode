import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Code2, BookOpen, Sparkles, LogOut, ShieldAlert, ArrowRight, CheckCircle2 } from 'lucide-react'

export default function StudentDashboardPage() {
  const { user, studentProfile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const displayName = studentProfile?.name || 'Siswa'
  const displayUsername = studentProfile?.username || user?.email?.split('@')[0] || ''

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-bold">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <span className="font-bold text-white tracking-tight text-base">PRICODE</span>
              <span className="ml-2 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded bg-sky-500/10 text-sky-400 border border-sky-500/20">
                Siswa
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-lg">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>{displayName}</span>
              <span className="text-slate-500 font-mono">(@{displayUsername})</span>
            </div>

            <button
              onClick={handleLogout}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-300 hover:bg-rose-500/10 border border-slate-800 hover:border-rose-500/20 transition"
              title="Keluar dari akun siswa"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Welcome Hero */}
        <div className="bg-gradient-to-br from-sky-900/30 via-slate-900 to-slate-900 border border-sky-500/20 rounded-2xl p-6 sm:p-8 relative overflow-hidden shadow-lg">
          <div className="relative z-10 space-y-3 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              Petualangan Coding Dimulai
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Halo, {displayName}! 👋
            </h1>
            <p className="text-sm text-slate-300 leading-relaxed">
              Kamu telah berhasil masuk dengan akun siswa <code className="bg-slate-950 px-2 py-0.5 rounded text-sky-300 font-mono font-bold">@{displayUsername}</code>. Semua materi dan aktivitas coding kamu siap dimulai!
            </p>
          </div>
        </div>

        {/* Course Card Preview */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center">
                <BookOpen className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white">Logika Pemrograman</h2>
                <p className="text-xs text-slate-400">Dasar logika coding untuk siswa SD</p>
              </div>
            </div>
            <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Terdaftar
            </span>
          </div>

          <div className="bg-slate-950/60 rounded-xl p-4 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <p className="text-xs text-slate-400 font-medium">Sub-Materi Pertama:</p>
              <p className="text-sm font-semibold text-white">Variabel & Menyimpan Nilai</p>
            </div>
            <span className="text-xs text-slate-500 italic">
              (Modul kurikulum akan dibuka pada fase berikutnya)
            </span>
          </div>
        </div>

        {/* Route Guard Security Test Section */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-6 space-y-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center shrink-0">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-white">Uji Keamanan Route Guarding</h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Sebagai siswa, kamu tidak diperbolehkan membuka atau memuat halaman Admin. Klik tombol di bawah untuk membuktikan bahwa perlindungan rute langsung mencegat dan menampilkan blokir akses (403):
              </p>
            </div>
          </div>

          <div className="pt-2">
            <Link
              to="/admin/students"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition"
            >
              Coba Buka /admin/students (Uji Blokir Rute)
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
