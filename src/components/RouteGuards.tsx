import { Navigate, Outlet, useLocation, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ShieldAlert, ArrowLeft } from 'lucide-react'

// Guard for Admin-only routes
export function AdminRoute() {
  const { user, role, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Memeriksa hak akses admin...</p>
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
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-slate-900 border border-rose-900/50 rounded-2xl p-6 text-center shadow-xl">
          <div className="w-14 h-14 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-bold text-white mb-2">Akses Ditolak (403)</h1>
          <p className="text-sm text-slate-400 mb-6">
            Halaman ini khusus untuk <strong>Guru / Admin</strong>. Akun kamu terdaftar sebagai <strong>Siswa</strong> dan tidak memiliki izin untuk melihat atau mengakses panel ini.
          </p>
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-medium text-sm transition"
          >
            <ArrowLeft className="w-4 h-4" />
            Kembali ke Dashboard Siswa
          </Link>
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center text-slate-400">
        <div className="w-8 h-8 border-4 border-sky-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Memuat profil...</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // If Admin attempts to access student dashboard, redirect to admin portal
  if (role === 'admin') {
    return <Navigate to="/admin/students" replace />
  }

  return <Outlet />
}

