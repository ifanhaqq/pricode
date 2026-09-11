import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Code2, BookOpen, LogOut, ShieldAlert, ArrowRight, CheckCircle2, User } from 'lucide-react'

export default function StudentDashboardPage() {
  const { user, studentProfile, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const displayName = studentProfile?.name || 'Siswa Hebat'
  const displayUsername = studentProfile?.username || user?.email?.split('@')[0] || ''

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-30 shadow-brutal-sm">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-retro-yellow text-black border-2 border-black shadow-brutal-sm flex items-center justify-center font-black">
              <Code2 className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-black text-black tracking-tight text-xl font-heading">
                PRICODE
              </span>
              <span className="badge-brutal text-[10px] bg-retro-green text-black font-mono">
                PORTAL SISWA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-bold text-black bg-[#FAF7EE] border-2 border-black px-3 py-1.5 rounded-lg shadow-brutal-sm font-mono">
              <User className="w-3.5 h-3.5 text-retro-pink" />
              <span>{displayName}</span>
              <span className="text-neutral-500 font-normal">(@{displayUsername})</span>
            </div>

            <button
              onClick={handleLogout}
              className="btn-brutal-white text-xs py-1.5 px-3 inline-flex items-center gap-1.5 hover:bg-retro-pink hover:text-white transition"
              title="Keluar dari akun siswa"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 pb-12">
        {/* Welcome Hero */}
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-4 shadow-brutal-lg relative overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            <span className="badge-brutal bg-retro-yellow text-black font-black">
              KELAS 4–6 SD
            </span>
            <span className="badge-brutal bg-black text-white font-mono">
              @{displayUsername}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-3xl sm:text-4xl font-black text-black tracking-tight flex items-center gap-3">
              Halo, {displayName}! 👋
            </h1>
            <p className="text-sm text-neutral-700 font-medium leading-relaxed max-w-2xl">
              Selamat datang di petualangan coding PRICODE! Di sini kamu akan belajar membuat game, animasi, dan memecahkan tantangan logika langkah demi langkah.
            </p>
          </div>
        </div>

        {/* Enrolled Course Card */}
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-xl bg-retro-lavender border-2 border-black flex items-center justify-center shadow-brutal-sm flex-shrink-0">
                <BookOpen className="w-6 h-6 text-black stroke-[2.5]" />
              </div>
              <div>
                <span className="badge-brutal text-[10px] bg-retro-green text-black mb-1 inline-block">
                  KURSUS UTAMA
                </span>
                <h2 className="text-xl font-black text-black tracking-tight">
                  Dasar Pemrograman PRICODE
                </h2>
                <p className="text-xs text-neutral-600 font-medium">
                  Pengenalan konsep variabel, kondisi, perulangan, dan logika algoritma.
                </p>
              </div>
            </div>

            <span className="badge-brutal bg-retro-green text-black text-xs py-1.5 px-3 self-start sm:self-auto flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 stroke-[3]" />
              <span>TERDAFTAR</span>
            </span>
          </div>

          <div className="bg-[#FAF7EE] border-2 border-black rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-black uppercase text-neutral-500 font-mono">
                  Materi Pertama:
                </p>
                <p className="text-base font-black text-black">
                  Sub-Materi: Variabel
                </p>
              </div>
              <span className="badge-brutal bg-retro-yellow text-black text-[11px]">
                5 Aktivitas Siap
              </span>
            </div>
            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              Pelajari konsep kotak penyimpanan ajaib (variabel), tonton video penjelasan, selesaikan tantangan blok interaktif IA1 & IA2, serta kerjakan kuis evaluasi.
            </p>
          </div>
        </div>

        {/* Route Guard Security Test Section */}
        <div className="card-brutal bg-[#FAF7EE] border-2 border-black p-6 space-y-3">
          <div className="flex items-center gap-2.5 text-black">
            <ShieldAlert className="w-5 h-5 text-retro-pink" />
            <h3 className="text-sm font-black uppercase tracking-wider">
              Uji Keamanan Hak Akses (Route Guard Testing)
            </h3>
          </div>
          <p className="text-xs text-neutral-700 leading-relaxed font-medium">
            Sebagai siswa, kamu tidak memiliki izin mengakses panel guru ataupun CMS kursus. Klik tombol di bawah untuk menguji sistem pencegahan akses:
          </p>
          <div className="pt-1">
            <Link
              to="/admin/courses"
              className="btn-brutal-white text-xs py-2 px-3.5 inline-flex items-center gap-2 hover:bg-retro-pink hover:text-white transition"
            >
              <span>Uji Coba Buka Halaman /admin/courses (Blokir Rute)</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
