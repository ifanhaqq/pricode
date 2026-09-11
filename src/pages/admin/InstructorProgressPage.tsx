import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import {
  GraduationCap,
  Search,
  CheckCircle2,
  Clock,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Award,
  BookOpen,
  Filter,
  Users
} from 'lucide-react'

interface StudentItem {
  id: string
  name: string
  auth_id: string
  created_at: string
}

interface SubCourseItem {
  id: string
  title: string
  order: number
  course_id: string
}

interface CourseItem {
  id: string
  title: string
  order: number
}

interface ProgressRecord {
  student_id: string
  subcourse_id: string | null
  course_id?: string | null
  status: 'locked' | 'in_progress' | 'completed'
  quiz_score: number | null
  attempts: number
  cooldown_until: string | null
  updated_at: string
}

export default function InstructorProgressPage() {
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [subcourses, setSubcourses] = useState<SubCourseItem[]>([])
  const [students, setStudents] = useState<StudentItem[]>([])
  const [progressRows, setProgressRows] = useState<ProgressRecord[]>([])

  const [selectedCourseId, setSelectedCourseId] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Fetch all students and their progress via Admin RLS
  const loadInstructorData = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch courses
      const { data: cData, error: cErr } = await supabase
        .from('courses')
        .select('id, title, order')
        .order('order', { ascending: true })

      if (cErr) throw cErr
      const loadedCourses = cData || []
      setCourses(loadedCourses)

      if (loadedCourses.length > 0 && !selectedCourseId) {
        setSelectedCourseId(loadedCourses[0].id)
      }

      // 2. Fetch all subcourses
      const { data: scData, error: scErr } = await supabase
        .from('sub_courses')
        .select('id, title, order, course_id')
        .order('order', { ascending: true })

      if (scErr) throw scErr
      setSubcourses(scData || [])

      // 3. Fetch all students
      const { data: stData, error: stErr } = await supabase
        .from('students')
        .select('*')
        .order('name', { ascending: true })

      if (stErr) throw stErr
      setStudents(stData || [])

      // 4. Fetch all progress rows across ALL students (permitted by Admin RLS)
      const { data: pData, error: pErr } = await supabase
        .from('progress')
        .select('*')

      if (pErr) throw pErr
      setProgressRows((pData as ProgressRecord[]) || [])
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat data progress siswa.')
    } finally {
      setLoading(false)
    }
  }, [selectedCourseId])

  useEffect(() => {
    loadInstructorData()
  }, [loadInstructorData])

  // Subcourses of selected course
  const currentSubcourses = useMemo(() => {
    if (!selectedCourseId) return []
    return subcourses.filter((sc) => sc.course_id === selectedCourseId)
  }, [subcourses, selectedCourseId])

  // Filter students by search query
  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students
    const q = searchQuery.toLowerCase()
    return students.filter((s) => s.name.toLowerCase().includes(q))
  }, [students, searchQuery])

  // Build lookup index: studentId -> subcourseId -> ProgressRecord
  const progressIndex = useMemo(() => {
    const map: Record<string, Record<string, ProgressRecord>> = {}
    progressRows.forEach((p) => {
      if (!map[p.student_id]) {
        map[p.student_id] = {}
      }
      if (p.subcourse_id) {
        map[p.student_id][p.subcourse_id] = p
      }
      // Course-level progress (Final Quiz)
      if (p.course_id) {
        map[p.student_id][`course_${p.course_id}`] = p
      }
    })
    return map
  }, [progressRows])

  // Summary Metrics
  const summaryMetrics = useMemo(() => {
    const totalStudents = students.length
    let completedSubcoursesCount = 0
    let passedFinalQuizCount = 0

    students.forEach((s) => {
      const studentMap = progressIndex[s.id] || {}
      // Subcourses count
      currentSubcourses.forEach((sc) => {
        if (studentMap[sc.id]?.status === 'completed') {
          completedSubcoursesCount++
        }
      })
      // Final Quiz
      if (selectedCourseId && studentMap[`course_${selectedCourseId}`]?.status === 'completed') {
        passedFinalQuizCount++
      }
    })

    return {
      totalStudents,
      completedSubcoursesCount,
      passedFinalQuizCount
    }
  }, [students, currentSubcourses, progressIndex, selectedCourseId])

  return (
    <div className="p-6 sm:p-8 space-y-8 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="card-brutal bg-white p-6 sm:p-8 space-y-4 shadow-brutal border-2 border-black">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-retro-yellow text-black border-2 border-black flex items-center justify-center font-black shadow-brutal-sm">
              <GraduationCap className="w-7 h-7 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="badge-brutal text-[10px] bg-black text-white font-mono">
                  PANEL INSTRUKTUR
                </span>
                <span className="badge-brutal text-[10px] bg-retro-green text-black font-mono font-black">
                  ADMIN RLS AKTIF
                </span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight mt-1">
                Progress Belajar Siswa
              </h1>
            </div>
          </div>

          <button
            onClick={() => loadInstructorData()}
            className="btn-brutal-white text-xs py-2 px-4 inline-flex items-center gap-2 self-start sm:self-auto font-black"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Segarkan Data</span>
          </button>
        </div>

        {/* Summary Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
          <div className="bg-[#FAF7EE] border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">
                Total Siswa Terdaftar
              </span>
              <Users className="w-4 h-4 text-black" />
            </div>
            <p className="text-3xl font-black text-black mt-2">{summaryMetrics.totalStudents}</p>
          </div>

          <div className="bg-[#FAF7EE] border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">
                Total Sub-Materi Tuntas
              </span>
              <BookOpen className="w-4 h-4 text-black" />
            </div>
            <p className="text-3xl font-black text-black mt-2">
              {summaryMetrics.completedSubcoursesCount}
            </p>
          </div>

          <div className="bg-[#FAF7EE] border-2 border-black rounded-xl p-4 shadow-brutal-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono font-bold text-neutral-600 uppercase">
                Lulus Kuis Akhir
              </span>
              <Award className="w-4 h-4 text-retro-pink" />
            </div>
            <p className="text-3xl font-black text-black mt-2">
              {summaryMetrics.passedFinalQuizCount}
            </p>
          </div>
        </div>
      </div>

      {/* Filter & Controls Bar */}
      <div className="card-brutal bg-white p-4 shadow-brutal-sm border-2 border-black flex flex-col sm:flex-row items-center justify-between gap-4">
        {/* Course Selector */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-neutral-600 shrink-0" />
          <span className="text-xs font-mono font-bold text-neutral-600 uppercase shrink-0">
            Kursus:
          </span>
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            className="input-brutal text-xs py-2 px-3 font-bold bg-[#FAF7EE] w-full sm:w-64"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {/* Search Student Input */}
        <div className="relative w-full sm:w-72">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
          <input
            type="text"
            placeholder="Cari nama siswa..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-brutal text-xs py-2 pl-9 pr-3 w-full font-medium"
          />
        </div>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="card-brutal bg-retro-pink text-white p-4 font-bold text-xs shadow-brutal flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Main Table View */}
      {loading ? (
        <div className="card-brutal bg-white p-12 text-center text-neutral-600 font-bold space-y-3">
          <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow" />
          <p className="text-sm">Memuat tabel progress seluruh siswa...</p>
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="card-brutal bg-white p-8 text-center space-y-2">
          <Users className="w-8 h-8 mx-auto text-neutral-400" />
          <p className="font-black text-sm text-black">Tidak ada data siswa yang ditemukan.</p>
          <p className="text-xs text-neutral-600">
            {searchQuery ? 'Coba ubah kata kunci pencarian.' : 'Belum ada siswa yang terdaftar.'}
          </p>
        </div>
      ) : (
        <div className="card-brutal bg-white shadow-brutal border-2 border-black overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse font-sans text-xs">
              {/* Table Header */}
              <thead>
                <tr className="bg-black text-white font-mono border-b-2 border-black">
                  <th className="py-3 px-4 uppercase tracking-wider font-black w-12 text-center">
                    #
                  </th>
                  <th className="py-3 px-4 uppercase tracking-wider font-black min-w-[200px]">
                    Nama Siswa
                  </th>

                  {/* Dynamic Columns for Each SubCourse */}
                  {currentSubcourses.map((sc, scIdx) => (
                    <th
                      key={sc.id}
                      className="py-3 px-4 uppercase tracking-wider font-black min-w-[170px] border-l-2 border-neutral-700 text-center"
                    >
                      <div className="truncate">
                        Sub {scIdx + 1}: {sc.title}
                      </div>
                      <span className="text-[10px] text-retro-yellow font-normal">
                        Kuis Evaluasi (70%)
                      </span>
                    </th>
                  ))}

                  {/* Course Final Quiz Column */}
                  <th className="py-3 px-4 uppercase tracking-wider font-black min-w-[170px] border-l-2 border-neutral-700 text-center bg-neutral-900">
                    <div>Kuis Akhir Kursus</div>
                    <span className="text-[10px] text-retro-pink font-normal">
                      Evaluasi Kelulusan
                    </span>
                  </th>
                </tr>
              </thead>

              {/* Table Body */}
              <tbody className="divide-y-2 divide-black/10">
                {filteredStudents.map((student, idx) => {
                  const studentProgressMap = progressIndex[student.id] || {}
                  const finalQuizProg = selectedCourseId
                    ? studentProgressMap[`course_${selectedCourseId}`]
                    : null

                  return (
                    <tr
                      key={student.id}
                      className="hover:bg-[#FAF7EE] transition font-medium text-black"
                    >
                      {/* Row Index */}
                      <td className="py-3.5 px-4 text-center font-mono font-bold text-neutral-500">
                        {idx + 1}
                      </td>

                      {/* Student Info */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-sm text-black">{student.name}</div>
                        <div className="text-[10px] font-mono text-neutral-500">
                          ID: {student.id.slice(0, 8)}...
                        </div>
                      </td>

                      {/* SubCourses Columns */}
                      {currentSubcourses.map((sc) => {
                        const prog = studentProgressMap[sc.id]
                        const isCompleted = prog?.status === 'completed'
                        const isInProgress = prog?.status === 'in_progress'
                        const score = prog?.quiz_score
                        const attempts = prog?.attempts || 0

                        return (
                          <td
                            key={sc.id}
                            className="py-3.5 px-4 border-l-2 border-black/10 text-center"
                          >
                            {isCompleted ? (
                              <div className="space-y-1 inline-block text-center">
                                <span className="badge-brutal bg-retro-green text-black text-[10px] font-mono font-black inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                                  <span>Lulus ({score}%)</span>
                                </span>
                                <p className="text-[10px] font-mono text-neutral-600">
                                  {attempts}x percobaan
                                </p>
                              </div>
                            ) : isInProgress ? (
                              <div className="space-y-1 inline-block text-center">
                                <span className="badge-brutal bg-retro-yellow text-black text-[10px] font-mono font-bold">
                                  Sedang Belajar
                                </span>
                                {score !== null && score !== undefined && (
                                  <p className="text-[10px] font-mono text-neutral-600">
                                    Skor: {score}% ({attempts}x)
                                  </p>
                                )}
                              </div>
                            ) : (
                              <span className="badge-brutal bg-neutral-200 text-neutral-500 text-[10px] font-mono">
                                Belum Mulai
                              </span>
                            )}
                          </td>
                        )
                      })}

                      {/* Final Quiz Column */}
                      <td className="py-3.5 px-4 border-l-2 border-black/10 text-center bg-neutral-50/50">
                        {finalQuizProg?.status === 'completed' ? (
                          <div className="space-y-1 inline-block text-center">
                            <span className="badge-brutal bg-retro-green text-black text-[10px] font-mono font-black inline-flex items-center gap-1">
                              <Award className="w-3.5 h-3.5 stroke-[2.5]" />
                              <span>LULUS ({finalQuizProg.quiz_score}%)</span>
                            </span>
                            <p className="text-[10px] font-mono text-neutral-600">
                              {finalQuizProg.attempts}x percobaan
                            </p>
                          </div>
                        ) : finalQuizProg?.cooldown_until &&
                          new Date(finalQuizProg.cooldown_until).getTime() > Date.now() ? (
                          <div className="space-y-1 inline-block text-center">
                            <span className="badge-brutal bg-retro-pink text-white text-[10px] font-mono font-black inline-flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>Cooldown</span>
                            </span>
                            <p className="text-[10px] font-mono text-neutral-600">
                              Skor: {finalQuizProg.quiz_score}% ({finalQuizProg.attempts}x)
                            </p>
                          </div>
                        ) : finalQuizProg?.attempts && finalQuizProg.attempts > 0 ? (
                          <div className="space-y-1 inline-block text-center">
                            <span className="badge-brutal bg-retro-yellow text-black text-[10px] font-mono font-bold">
                              Belum Lulus
                            </span>
                            <p className="text-[10px] font-mono text-neutral-600">
                              Skor: {finalQuizProg.quiz_score}% ({finalQuizProg.attempts}x)
                            </p>
                          </div>
                        ) : (
                          <span className="badge-brutal bg-neutral-200 text-neutral-500 text-[10px] font-mono">
                            Belum Dikerjakan
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
