import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { Code2, Users, Shield, LogOut, BookOpen, Activity } from 'lucide-react'

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col font-sans">
      {/* Top Navbar Neo-Brutalist */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-30 shadow-brutal-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            {/* Logo & Brand */}
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-retro-yellow text-black border-2 border-black shadow-brutal-sm flex items-center justify-center font-black">
                <Code2 className="w-6 h-6 stroke-[2.5]" />
              </div>
              <div className="flex items-center gap-2">
                <span className="font-black text-black tracking-tight text-xl font-heading">
                  PRICODE
                </span>
                <span className="badge-brutal text-[10px] bg-black text-retro-yellow font-mono">
                  ADMIN CMS
                </span>
              </div>
            </div>

            {/* Navigation Tabs */}
            <nav className="hidden md:flex items-center gap-2">
              <NavLink
                to="/admin/courses"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
                    isActive
                      ? 'bg-retro-yellow text-black border-2 border-black shadow-brutal-sm'
                      : 'text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-transparent'
                  }`
                }
              >
                <BookOpen className="w-4 h-4" />
                <span>Kelola Kursus</span>
              </NavLink>

              <NavLink
                to="/admin/students"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
                    isActive
                      ? 'bg-retro-yellow text-black border-2 border-black shadow-brutal-sm'
                      : 'text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-transparent'
                  }`
                }
              >
                <Users className="w-4 h-4" />
                <span>Kelola Siswa</span>
              </NavLink>

              <NavLink
                to="/infra-test"
                className={({ isActive }) =>
                  `flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-black transition ${
                    isActive
                      ? 'bg-retro-yellow text-black border-2 border-black shadow-brutal-sm'
                      : 'text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-transparent'
                  }`
                }
              >
                <Activity className="w-4 h-4" />
                <span>Uji Koneksi</span>
              </NavLink>
            </nav>
          </div>

          {/* Right Action & User Info */}
          <div className="flex items-center gap-3">
            <div className="hidden sm:flex items-center gap-2 text-xs font-mono font-bold text-neutral-800 bg-[#FAF7EE] border-2 border-black px-3 py-1.5 rounded-lg shadow-brutal-sm">
              <Shield className="w-3.5 h-3.5 text-retro-pink" />
              <span>{user?.email}</span>
            </div>

            <button
              onClick={handleLogout}
              className="btn-brutal-white text-xs py-1.5 px-3 inline-flex items-center gap-1.5 hover:bg-retro-pink hover:text-white transition"
              title="Keluar dari akun admin"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Keluar</span>
            </button>
          </div>
        </div>

        {/* Mobile Nav */}
        <div className="md:hidden flex items-center justify-around border-t-2 border-black py-2 bg-[#FAF7EE] px-2 gap-1">
          <NavLink
            to="/admin/courses"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black ${
                isActive ? 'bg-retro-yellow text-black border-2 border-black' : 'text-neutral-600'
              }`
            }
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Kursus</span>
          </NavLink>
          <NavLink
            to="/admin/students"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black ${
                isActive ? 'bg-retro-yellow text-black border-2 border-black' : 'text-neutral-600'
              }`
            }
          >
            <Users className="w-3.5 h-3.5" />
            <span>Siswa</span>
          </NavLink>
          <NavLink
            to="/infra-test"
            className={({ isActive }) =>
              `flex items-center gap-1.5 px-3 py-1 rounded text-xs font-black ${
                isActive ? 'bg-retro-yellow text-black border-2 border-black' : 'text-neutral-600'
              }`
            }
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Koneksi</span>
          </NavLink>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t-2 border-black bg-white py-4 px-6 text-center text-xs font-bold text-neutral-600">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>PRICODE CMS • Platform Belajar Pemrograman Siswa Sekolah Dasar</span>
          <span className="font-mono text-[11px] text-neutral-500">Neo-Brutalist Admin Edition</span>
        </div>
      </footer>
    </div>
  )
}
