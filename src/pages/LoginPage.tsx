import React, { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Code2, Shield, User, Lock, ArrowRight, Eye, EyeOff, AlertCircle, Sparkles, Activity } from 'lucide-react'

export default function LoginPage() {
  const { user, role, loginStudent, loginAdmin, loading } = useAuth()
  const navigate = useNavigate()

  const [activeTab, setActiveTab] = useState<'student' | 'admin'>('student')

  // Student form state
  const [studentUsername, setStudentUsername] = useState('')
  const [studentPassword, setStudentPassword] = useState('')

  // Admin form state
  const [adminIdentifier, setAdminIdentifier] = useState('')
  const [adminPassword, setAdminPassword] = useState('')

  // UI state
  const [showPassword, setShowPassword] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Redirect if already authenticated
  useEffect(() => {
    if (!loading && user && role) {
      if (role === 'admin') {
        navigate('/admin/courses', { replace: true })
      } else if (role === 'student') {
        navigate('/dashboard', { replace: true })
      }
    }
  }, [user, role, loading, navigate])

  const handleStudentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const result = await loginStudent(studentUsername, studentPassword)
      if (!result.success) {
        setErrorMessage(result.error || 'Username atau password salah.')
      } else {
        navigate('/dashboard', { replace: true })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrorMessage(null)
    setIsSubmitting(true)

    try {
      const result = await loginAdmin(adminIdentifier, adminPassword)
      if (!result.success) {
        setErrorMessage(result.error || 'Email/Username atau password admin salah.')
      } else {
        navigate('/admin/courses', { replace: true })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col justify-center items-center p-4 sm:p-6 font-sans">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-retro-yellow text-black border-3 border-black shadow-brutal mx-auto">
            <Code2 className="w-9 h-9 stroke-[2.5]" />
          </div>
          <div className="space-y-1">
            <h1 className="text-4xl font-black tracking-tight text-black font-heading flex items-center justify-center gap-2">
              PRICODE
              <span className="badge-brutal text-xs bg-retro-pink text-white font-mono">
                v2.0
              </span>
            </h1>
            <p className="text-xs font-bold text-neutral-700">
              Platform Belajar Pemrograman Siswa SD (Kelas 4–6)
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="card-brutal bg-white p-1.5 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition ${
              activeTab === 'student'
                ? 'bg-retro-yellow text-black border-2 border-black shadow-brutal-sm'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100 border-2 border-transparent'
            }`}
          >
            <User className="w-4 h-4 stroke-[2.5]" />
            <span>Masuk Siswa</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('admin')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl text-xs font-black transition ${
              activeTab === 'admin'
                ? 'bg-retro-lavender text-black border-2 border-black shadow-brutal-sm'
                : 'text-neutral-600 hover:text-black hover:bg-neutral-100 border-2 border-transparent'
            }`}
          >
            <Shield className="w-4 h-4 stroke-[2.5]" />
            <span>Guru / Admin</span>
          </button>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="card-brutal bg-retro-pink p-4 text-white text-xs font-bold flex items-start gap-3 shadow-brutal animate-fade-in">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-white" />
            <div className="flex-1 leading-relaxed">
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {/* Form Container Card */}
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-6 shadow-brutal-lg">
          {activeTab === 'student' ? (
            /* Student Login Form */
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-black/10">
                <Sparkles className="w-4 h-4 text-retro-yellow" />
                <h2 className="text-sm font-black uppercase tracking-wider text-black">
                  Login Akun Siswa
                </h2>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Nama Pengguna (Username) *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={studentUsername}
                    onChange={(e) => setStudentUsername(e.target.value.toLowerCase())}
                    placeholder="misal: budi_santoso"
                    className="input-brutal font-mono text-xs pr-10"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <User className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                </div>
                <p className="text-[11px] text-neutral-600 font-medium mt-1">
                  Masukkan username yang diberikan oleh Bapak/Ibu Guru.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Kata Sandi (Password) *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Ketik kata sandi kamu"
                    className="input-brutal font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black p-0.5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-brutal-yellow w-full py-3 text-sm font-black inline-flex items-center justify-center gap-2 mt-2"
              >
                {isSubmitting ? (
                  <span>Memeriksa Akun...</span>
                ) : (
                  <>
                    <span>Mulai Belajar Sekarang</span>
                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Admin Login Form */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b-2 border-black/10">
                <Shield className="w-4 h-4 text-retro-pink" />
                <h2 className="text-sm font-black uppercase tracking-wider text-black">
                  Login Panel Guru / Admin
                </h2>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Email atau Username Admin *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    placeholder="admin@pricode.local"
                    className="input-brutal font-mono text-xs pr-10"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                  <User className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Kata Sandi Admin *
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="input-brutal font-mono text-xs pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-black p-0.5"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="btn-brutal-black text-white w-full py-3 text-sm font-black inline-flex items-center justify-center gap-2 mt-2 hover:bg-neutral-900"
              >
                {isSubmitting ? (
                  <span>Memverifikasi Admin...</span>
                ) : (
                  <>
                    <Lock className="w-4 h-4 text-retro-yellow" />
                    <span>Masuk ke Panel Admin</span>
                  </>
                )}
              </button>
            </form>
          )}
        </div>

        {/* Footer & Diagnostic Link */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-bold text-neutral-600 px-2">
          <span>PRICODE • Coding Education</span>
          <Link
            to="/infra-test"
            className="inline-flex items-center gap-1.5 text-neutral-700 hover:text-black hover:underline"
          >
            <Activity className="w-3.5 h-3.5 text-retro-green" />
            <span>Uji Koneksi Database</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
