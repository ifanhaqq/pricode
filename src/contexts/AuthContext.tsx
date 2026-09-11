import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export type UserRole = 'admin' | 'student' | null

export interface StudentProfile {
  id: string
  name: string
  username?: string
  auth_id: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  role: UserRole
  studentProfile: StudentProfile | null
  loading: boolean
  loginStudent: (username: string, password: string) => Promise<{ success: boolean; error?: string }>
  loginAdmin: (identifier: string, password: string) => Promise<{ success: boolean; error?: string }>
  logout: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<UserRole>(null)
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const resolveUserRoleAndProfile = useCallback(async (authUser: User | null) => {
    if (!authUser || !supabase) {
      setRole(null)
      setStudentProfile(null)
      return
    }

    try {
      // 1. Fetch user role
      const { data: roleRow, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', authUser.id)
        .maybeSingle()

      if (roleError) {
        console.error('Error fetching user role:', roleError)
      }

      const currentRole = (roleRow?.role as UserRole) || null
      setRole(currentRole)

      // 2. If student, fetch student profile
      if (currentRole === 'student') {
        const { data: studentRow, error: studentError } = await supabase
          .from('students')
          .select('id, name, auth_id')
          .eq('auth_id', authUser.id)
          .maybeSingle()

        if (!studentError && studentRow) {
          // Extract username from synthetic email or metadata
          const username = authUser.email?.split('@')[0] || authUser.user_metadata?.username || ''
          setStudentProfile({
            ...studentRow,
            username
          })
        }
      } else {
        setStudentProfile(null)
      }
    } catch (err) {
      console.error('Failed to resolve user role:', err)
      setRole(null)
      setStudentProfile(null)
    }
  }, [])

  useEffect(() => {
    if (!supabase) {
      setLoading(false)
      return
    }

    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        resolveUserRoleAndProfile(session.user).finally(() => setLoading(false))
      } else {
        setLoading(false)
      }
    })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session)
        setUser(session?.user ?? null)
        if (session?.user) {
          await resolveUserRoleAndProfile(session.user)
        } else {
          setRole(null)
          setStudentProfile(null)
        }
        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [resolveUserRoleAndProfile])

  const loginStudent = async (username: string, password: string) => {
    if (!supabase) return { success: false, error: 'Database belum terhubung.' }

    const cleanUsername = username.trim().toLowerCase()
    if (!cleanUsername) return { success: false, error: 'Masukkan username.' }
    if (!password) return { success: false, error: 'Masukkan password.' }

    // Map username to synthetic email
    const syntheticEmail = `${cleanUsername}@codingclub.scr`

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: syntheticEmail,
        password
      })

      if (error) {
        return { success: false, error: 'Username atau password salah.' }
      }

      // Check role
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (roleRow?.role !== 'student') {
        await supabase.auth.signOut()
        return { success: false, error: 'Akun ini bukan akun siswa. Silakan masuk melalui tab Guru/Admin.' }
      }

      await resolveUserRoleAndProfile(data.user)
      return { success: true }
    } catch (err: unknown) {
      const e = err as Error
      return { success: false, error: e.message || 'Terjadi kesalahan saat masuk.' }
    }
  }

  const loginAdmin = async (identifier: string, password: string) => {
    if (!supabase) return { success: false, error: 'Database belum terhubung.' }

    const cleanIdentifier = identifier.trim()
    if (!cleanIdentifier) return { success: false, error: 'Masukkan email atau username admin.' }
    if (!password) return { success: false, error: 'Masukkan password.' }

    // Support both standard email or username
    const email = cleanIdentifier.includes('@')
      ? cleanIdentifier
      : `${cleanIdentifier.toLowerCase()}@pricode.local`

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })

      if (error) {
        return { success: false, error: 'Email/Username atau password salah.' }
      }

      // Check role
      const { data: roleRow } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', data.user.id)
        .maybeSingle()

      if (roleRow?.role !== 'admin') {
        await supabase.auth.signOut()
        return { success: false, error: 'Akses ditolak: Akun ini tidak memiliki hak akses Admin.' }
      }

      await resolveUserRoleAndProfile(data.user)
      return { success: true }
    } catch (err: unknown) {
      const e = err as Error
      return { success: false, error: e.message || 'Terjadi kesalahan saat masuk.' }
    }
  }

  const logout = async () => {
    if (!supabase) return
    await supabase.auth.signOut()
    setUser(null)
    setSession(null)
    setRole(null)
    setStudentProfile(null)
  }

  const refreshProfile = async () => {
    if (user) {
      await resolveUserRoleAndProfile(user)
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        role,
        studentProfile,
        loading,
        loginStudent,
        loginAdmin,
        logout,
        refreshProfile
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

