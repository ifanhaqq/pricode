import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ShieldAlert, ArrowLeft, Sparkles } from 'lucide-react'

// Guard for Admin-only routes
export function AdminRoute() {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex flex-col items-center justify-center p-6 text-black font-sans">
        <div className="card-brutal bg-white p-8 text-center space-y-4 shadow-brutal max-w-sm w-full">
          <Sparkles className="w-10 h-10 animate-spin mx-auto text-retro-yellow" />
          <h2 className="text-base font-black tracking-tight">Memeriksa Hak Akses Admin...</h2>
          <p className="text-xs text-neutral-600 font-medium">Mohon tunggu sebentar.</p>
        </div>
      </div>
    )
  }

  // Not logged in -> Redirect to login page
  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Logged in, but NOT an admin -> BLOCK COMPLETELY, do not mount admin UI
  if (role !== 'admin') {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex items-center justify-center p-4 font-sans">
        <div className="max-w-md w-full card-brutal bg-white p-6 sm:p-8 text-center space-y-5 shadow-brutal-xl border-3 border-black">
          <div className="w-16 h-16 bg-retro-pink text-white border-3 border-black rounded-2xl flex items-center justify-center mx-auto shadow-brutal-sm">
            <ShieldAlert className="w-9 h-9 stroke-[2.5]" />
          </div>

          <div className="space-y-2">
            <span className="badge-brutal text-xs bg-retro-pink text-white font-mono font-black">
              STATUS: 403 FORBIDDEN
            </span>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight font-heading">
              Akses Khusus Guru / Admin
            </h1>
            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              Halaman ini dikhususkan untuk <strong>Guru atau Administrator</strong>. Akun kamu saat ini terdaftar sebagai <strong>Siswa</strong> dan tidak diizinkan mengakses panel ini demi keamanan.
            </p>
          </div>

          <div className="pt-2">
            <Link
              to="/dashboard"
              className="btn-brutal-yellow w-full py-3 text-xs font-black inline-flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-4 h-4 stroke-[3]" />
              <span>Kembali ke Dashboard Siswa</span>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  // User is authenticated and role is admin -> Render admin pages
  return <Outlet />
}

// Guard for Student-only routes
export function StudentRoute() {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex flex-col items-center justify-center p-6 text-black font-sans">
        <div className="card-brutal bg-white p-8 text-center space-y-4 shadow-brutal max-w-sm w-full">
          <Sparkles className="w-10 h-10 animate-spin mx-auto text-retro-yellow" />
          <h2 className="text-base font-black tracking-tight">Memuat Profil Siswa...</h2>
          <p className="text-xs text-neutral-600 font-medium">Mohon tunggu sebentar.</p>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If Admin attempts to access student dashboard, redirect to admin portal
  if (role === 'admin') {
    return <Navigate to="/admin/courses" replace />
  }

  return <Outlet />
}
