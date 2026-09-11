import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { Code2, Shield, User, Lock, ArrowRight, Eye, EyeOff, AlertCircle } from 'lucide-react'

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
        navigate('/admin/students', { replace: true })
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
        navigate('/admin/students', { replace: true })
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-sky-500/10 text-sky-400 border border-sky-500/20 shadow-lg shadow-sky-500/5">
            <Code2 className="w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-white">PRICODE</h1>
          <p className="text-sm text-slate-400">
            Aplikasi Belajar Coding untuk Siswa SD (Kelas 4–6)
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="bg-slate-900/80 p-1.5 rounded-xl border border-slate-800 grid grid-cols-2 gap-1">
          <button
            type="button"
            onClick={() => {
              setActiveTab('student')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
              activeTab === 'student'
                ? 'bg-sky-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <User className="w-4 h-4" />
            Siswa
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveTab('admin')
              setErrorMessage(null)
            }}
            className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg text-sm font-semibold transition ${
              activeTab === 'admin'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Shield className="w-4 h-4" />
            Guru / Admin
          </button>
        </div>

        {/* Form Container */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-6 sm:p-8 shadow-xl">
          {errorMessage && (
            <div className="mb-5 flex items-start gap-2.5 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-sm">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          {activeTab === 'student' ? (
            /* Student Login Form */
            <form onSubmit={handleStudentSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Username Siswa
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <User className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={studentUsername}
                    onChange={(e) => setStudentUsername(e.target.value)}
                    placeholder="misal: budi_santoso"
                    autoCapitalize="none"
                    autoCorrect="off"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={studentPassword}
                    onChange={(e) => setStudentPassword(e.target.value)}
                    placeholder="Masukkan password kamu"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-semibold text-sm transition shadow-md shadow-sky-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Masuk...' : 'Masuk Belajar'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <p className="text-xs text-center text-slate-500 pt-2">
                Lupa password? Minta tolong Guru atau Instruktur untuk mereset akunmu.
              </p>
            </form>
          ) : (
            /* Admin Login Form */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Email atau Username Admin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Shield className="w-4 h-4" />
                  </div>
                  <input
                    type="text"
                    required
                    value={adminIdentifier}
                    onChange={(e) => setAdminIdentifier(e.target.value)}
                    placeholder="admin_test@pricode.local"
                    autoCapitalize="none"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-1.5">
                  Password Admin
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Lock className="w-4 h-4" />
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    placeholder="Password admin"
                    className="w-full bg-slate-950 border border-slate-700/80 rounded-xl pl-10 pr-11 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-200"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full mt-2 py-3 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm transition shadow-md shadow-indigo-600/20 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isSubmitting ? 'Memeriksa...' : 'Masuk Portal Admin'}
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800/80 text-[11px] text-slate-500 space-y-1">
                <p className="font-semibold text-slate-400">Akun Admin Uji Coba:</p>
                <p>Email: <code className="text-slate-300">admin_test@pricode.local</code></p>
                <p>Password: <code className="text-slate-300">AdminSecret123!</code></p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

