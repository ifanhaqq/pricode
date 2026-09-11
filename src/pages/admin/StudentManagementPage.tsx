import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import {
  Users,
  UserPlus,
  KeyRound,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  X,
  Copy,
  Check
} from 'lucide-react'

interface StudentItem {
  id: string
  name: string
  auth_id: string
  created_at: string
}

export default function StudentManagementPage() {
  const [students, setStudents] = useState<StudentItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false)
  const [selectedStudent, setSelectedStudent] = useState<StudentItem | null>(null)

  // Create form state
  const [createName, setCreateName] = useState('')
  const [createUsername, setCreateUsername] = useState('')
  const [createPassword, setCreatePassword] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Reset form state
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isResetting, setIsResetting] = useState(false)

  // Copy helper
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchStudents = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setErrorMessage(null)

    try {
      const { data, error } = await supabase
        .from('students')
        .select('*')
        .order('created_at', { ascending: false })

      if (error) throw error

      setStudents(data || [])
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal mengambil data siswa.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchStudents()
  }, [fetchStudents])

  const handleCreateStudent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return

    const sanitizedUsername = createUsername.trim().toLowerCase()
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(sanitizedUsername)) {
      setErrorMessage(
        'Username hanya boleh berisi huruf, angka, atau garis bawah (_) tanpa spasi (3-20 karakter).'
      )
      return
    }

    if (createPassword.length < 6) {
      setErrorMessage('Password minimal harus 6 karakter.')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsCreating(true)

    try {
      const { error } = await supabase.rpc('admin_create_student', {
        p_name: createName.trim(),
        p_username: sanitizedUsername,
        p_password: createPassword
      })

      if (error) throw error

      setSuccessMessage(`Akun siswa "${createName}" berhasil dibuat dengan username: ${sanitizedUsername}`)
      setIsCreateModalOpen(false)
      setCreateName('')
      setCreateUsername('')
      setCreatePassword('')
      await fetchStudents()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal membuat akun siswa.')
    } finally {
      setIsCreating(false)
    }
  }

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !selectedStudent) return

    if (newPassword.length < 6) {
      setErrorMessage('Password baru minimal harus 6 karakter.')
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Konfirmasi password baru tidak cocok.')
      return
    }

    setErrorMessage(null)
    setSuccessMessage(null)
    setIsResetting(true)

    try {
      const { error } = await supabase.rpc('admin_reset_student_password', {
        p_student_id: selectedStudent.id,
        p_new_password: newPassword
      })

      if (error) throw error

      setSuccessMessage(`Password untuk "${selectedStudent.name}" berhasil diperbarui!`)
      setIsResetModalOpen(false)
      setSelectedStudent(null)
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal mereset password siswa.')
    } finally {
      setIsResetting(false)
    }
  }

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const filteredStudents = students.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-5">
        <div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black flex items-center gap-2.5">
            <Users className="w-8 h-8 text-retro-yellow" />
            Manajemen Akun Siswa
          </h1>
          <p className="text-xs text-neutral-700 font-medium mt-1">
            Buat akun siswa langsung dan reset password secara instan tanpa perlu verifikasi email publik.
          </p>
        </div>

        <button
          onClick={() => {
            setErrorMessage(null)
            setIsCreateModalOpen(true)
          }}
          className="btn-brutal-yellow text-xs py-2.5 px-4 inline-flex items-center gap-2 self-start sm:self-auto"
        >
          <UserPlus className="w-4 h-4" />
          <span>Tambah Siswa Baru</span>
        </button>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="card-brutal bg-retro-green p-4 flex items-center justify-between gap-3 text-black font-semibold text-sm">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-black/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="card-brutal bg-retro-pink p-4 flex items-center justify-between gap-3 text-white font-semibold text-sm">
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-5 h-5 shrink-0 text-white" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Search & Refresh Bar */}
      <div className="card-brutal bg-white p-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full max-w-md">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Cari nama atau ID siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-brutal pl-9 text-xs py-2"
          />
        </div>

        <button
          onClick={fetchStudents}
          disabled={loading}
          className="btn-brutal-white text-xs py-2 px-3.5 inline-flex items-center gap-1.5 self-end sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {/* Students List Table */}
      <div className="card-brutal bg-white overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-neutral-600 flex flex-col items-center justify-center font-bold">
            <RefreshCw className="w-7 h-7 animate-spin text-retro-yellow mb-2" />
            <p className="text-xs">Memuat daftar siswa...</p>
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="py-16 text-center text-neutral-600 space-y-2">
            <Users className="w-10 h-10 mx-auto text-neutral-400" />
            <p className="text-sm font-black text-black">Belum ada siswa terdaftar</p>
            <p className="text-xs text-neutral-500">
              Klik tombol "Tambah Siswa Baru" untuk mendaftarkan akun siswa pertama.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#FAF7EE] text-black border-b-2 border-black uppercase text-[11px] tracking-wider font-black font-mono">
                <tr>
                  <th className="py-3.5 px-4">Nama Siswa</th>
                  <th className="py-3.5 px-4">ID Siswa</th>
                  <th className="py-3.5 px-4">Terdaftar</th>
                  <th className="py-3.5 px-4 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y-2 divide-black/10 font-sans">
                {filteredStudents.map((student) => (
                  <tr key={student.id} className="hover:bg-[#FAF7EE]/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-retro-yellow border-2 border-black flex items-center justify-center font-black text-xs shadow-brutal-sm">
                          {student.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-bold text-black text-sm">{student.name}</p>
                          <p className="text-neutral-500 text-[11px] font-mono">
                            Auth ID: {student.auth_id.slice(0, 8)}...
                          </p>
                        </div>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 font-mono text-neutral-700">
                      <div className="flex items-center gap-1.5">
                        <span className="bg-[#FAF7EE] border border-black/30 px-1.5 py-0.5 rounded text-[11px]">
                          {student.id.slice(0, 8)}...{student.id.slice(-4)}
                        </span>
                        <button
                          onClick={() => copyToClipboard(student.id, student.id)}
                          className="p-1 text-neutral-500 hover:text-black transition"
                          title="Salin ID Siswa"
                        >
                          {copiedId === student.id ? (
                            <Check className="w-3.5 h-3.5 text-retro-green stroke-[3]" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-neutral-700 font-medium">
                      {new Date(student.created_at).toLocaleDateString('id-ID', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric'
                      })}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setSelectedStudent(student)
                          setNewPassword('')
                          setConfirmPassword('')
                          setErrorMessage(null)
                          setIsResetModalOpen(true)
                        }}
                        className="btn-brutal-white text-[11px] py-1.5 px-2.5 inline-flex items-center gap-1.5 hover:bg-retro-yellow"
                      >
                        <KeyRound className="w-3 h-3" />
                        <span>Reset Password</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Tambah Siswa Baru */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-md w-full p-6 space-y-5 shadow-brutal-xl">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h2 className="text-lg font-black text-black flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-retro-yellow" />
                Tambah Akun Siswa Baru
              </h2>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1 border-2 border-black rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateStudent} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Nama Lengkap Siswa *
                </label>
                <input
                  type="text"
                  required
                  value={createName}
                  onChange={(e) => setCreateName(e.target.value)}
                  placeholder="misal: Budi Santoso"
                  className="input-brutal text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Username Akun *
                </label>
                <div className="relative">
                  <input
                    type="text"
                    required
                    value={createUsername}
                    onChange={(e) => setCreateUsername(e.target.value.toLowerCase())}
                    placeholder="misal: budi_sd01"
                    className="input-brutal font-mono text-xs pr-36"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-neutral-500 pointer-events-none">
                    @codingclub.scr
                  </span>
                </div>
                <p className="text-[11px] text-neutral-600 mt-1 font-medium">
                  Domain email sintetis ditambahkan otomatis oleh sistem. Siswa hanya perlu login dengan username ini.
                </p>
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Password Awal *
                </label>
                <input
                  type="text"
                  required
                  minLength={6}
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  placeholder="Minimal 6 karakter (misal: sandi123)"
                  className="input-brutal font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="btn-brutal-white text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isCreating}
                  className="btn-brutal-yellow text-xs"
                >
                  {isCreating ? 'Membuat Akun...' : 'Buat Akun Siswa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Reset Password Siswa */}
      {isResetModalOpen && selectedStudent && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-md w-full p-6 space-y-5 shadow-brutal-xl">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h2 className="text-lg font-black text-black flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-retro-pink" />
                Reset Password Siswa
              </h2>
              <button
                onClick={() => setIsResetModalOpen(false)}
                className="p-1 border-2 border-black rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-[#FAF7EE] border-2 border-black p-3.5 rounded-xl space-y-1">
              <p className="text-xs font-bold text-neutral-600">Siswa Target:</p>
              <p className="text-sm font-black text-black">{selectedStudent.name}</p>
              <p className="text-[11px] font-mono text-neutral-500">
                ID: {selectedStudent.id}
              </p>
            </div>

            <form onSubmit={handleResetPassword} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Password Baru *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 6 karakter"
                  className="input-brutal font-mono text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Ulangi Password Baru *
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ketik ulang password baru"
                  className="input-brutal font-mono text-xs"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsResetModalOpen(false)}
                  className="btn-brutal-white text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isResetting}
                  className="btn-brutal-pink text-xs"
                >
                  {isResetting ? 'Menyimpan...' : 'Perbarui Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
