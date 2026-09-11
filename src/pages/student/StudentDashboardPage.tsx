import { useState, useEffect, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import {
  Code2,
  BookOpen,
  LogOut,
  ShieldAlert,
  ArrowRight,
  CheckCircle2,
  User,
  Play,
  Sparkles,
  Award,
  Clock,
  AlertTriangle
} from 'lucide-react'

interface SubCourseWithProgress {
  id: string
  title: string
  order: number
  status: 'locked' | 'in_progress' | 'completed'
  quizScore: number | null
}

interface CourseItemWithQuizzes {
  id: string
  title: string
  description?: string
  subcourses: SubCourseWithProgress[]
  finalQuizId: string | null
  finalQuizTitle: string | null
  courseProgress: {
    status: string
    quiz_score: number | null
    cooldown_until: string | null
    weakest_subcourse_id: string | null
    weakest_subcourse_title?: string | null
  } | null
}

export default function StudentDashboardPage() {
  const { user, studentProfile, logout } = useAuth()
  const navigate = useNavigate()

  const [courses, setCourses] = useState<CourseItemWithQuizzes[]>([])
  const [loadingContent, setLoadingContent] = useState(true)
  const [currentTime, setCurrentTime] = useState<number>(Date.now())

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const displayName = studentProfile?.name || 'Siswa Hebat'
  const displayUsername = studentProfile?.username || user?.email?.split('@')[0] || ''

  // Tick clock for live cooldown timer display
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(Date.now())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  const loadStudentDashboardData = useCallback(async () => {
    if (!supabase) return
    setLoadingContent(true)

    try {
      let stId = studentProfile?.id
      if (!stId) {
        const { data: idData } = await supabase.rpc('get_current_student_id')
        stId = idData
      }

      // 1. Fetch published courses
      const { data: cData, error: cErr } = await supabase
        .from('courses')
        .select('id, title, description, order')
        .order('order', { ascending: true })

      if (cErr) throw cErr
      if (!cData || cData.length === 0) {
        setCourses([])
        return
      }

      const courseIds = cData.map((c) => c.id)

      // 2. Fetch all subcourses
      const { data: scData } = await supabase
        .from('sub_courses')
        .select('id, title, course_id, order')
        .in('course_id', courseIds)
        .order('order', { ascending: true })

      const subcourseIds = (scData || []).map((sc) => sc.id)

      // 3. Fetch student's subcourse progress
      const progressMap: Record<string, { status: string; quiz_score: number | null }> = {}
      if (stId && subcourseIds.length > 0) {
        const { data: pData } = await supabase
          .from('progress')
          .select('subcourse_id, status, quiz_score')
          .eq('student_id', stId)
          .in('subcourse_id', subcourseIds)

        if (pData) {
          pData.forEach((p) => {
            progressMap[p.subcourse_id] = {
              status: p.status,
              quiz_score: p.quiz_score
            }
          })
        }
      }

      // 4. Fetch final quizzes for each course
      const finalQuizMap: Record<string, { id: string; title: string }> = {}
      const { data: fqData } = await supabase
        .from('final_quizzes')
        .select('id, course_id, title')
        .in('course_id', courseIds)

      if (fqData) {
        fqData.forEach((fq) => {
          finalQuizMap[fq.course_id] = { id: fq.id, title: fq.title }
        })
      }

      // 5. Fetch course-level progress (from Supabase or localStorage fallback)
      const courseProgressMap: Record<
        string,
        {
          status: string
          quiz_score: number | null
          cooldown_until: string | null
          weakest_subcourse_id: string | null
          weakest_subcourse_title?: string | null
        }
      > = {}

      for (const c of cData) {
        let progRow: {
          status: string
          quiz_score: number | null
          cooldown_until: string | null
          weakest_subcourse_id: string | null
          weakest_subcourse_title?: string | null
        } | null = null

        // Try Supabase first
        if (stId) {
          try {
            const { data: dbCProg } = await supabase
              .from('progress')
              .select('status, quiz_score, cooldown_until, weakest_subcourse_id')
              .eq('student_id', stId)
              .eq('course_id', c.id)
              .maybeSingle()

            if (dbCProg) {
              progRow = dbCProg
            }
          } catch {
            // Course progress column might not exist yet
          }
        }

        // Fallback to localStorage
        if (!progRow) {
          const cacheKey = `pricode_progress_${stId || 'guest'}_course_${c.id}`
          const cached = localStorage.getItem(cacheKey)
          if (cached) {
            try {
              progRow = JSON.parse(cached)
            } catch {
              // ignore
            }
          }
        }

        if (progRow) {
          // Resolve weakest subcourse title
          if (progRow.weakest_subcourse_id && scData) {
            const sc = scData.find((s) => s.id === progRow!.weakest_subcourse_id)
            if (sc) {
              progRow.weakest_subcourse_title = sc.title
            }
          }
          courseProgressMap[c.id] = progRow
        }
      }

      // Assemble final data structure
      const compiledCourses: CourseItemWithQuizzes[] = cData.map((c) => {
        const cSubcourses = (scData || [])
          .filter((sc) => sc.course_id === c.id)
          .map((sc) => {
            const p = progressMap[sc.id]
            return {
              id: sc.id,
              title: sc.title,
              order: sc.order,
              status: (p?.status as 'locked' | 'in_progress' | 'completed') || 'in_progress',
              quizScore: p?.quiz_score ?? null
            }
          })

        const fQuiz = finalQuizMap[c.id]
        const cProg = courseProgressMap[c.id] || null

        return {
          id: c.id,
          title: c.title,
          description: c.description,
          subcourses: cSubcourses,
          finalQuizId: fQuiz?.id || null,
          finalQuizTitle: fQuiz?.title || null,
          courseProgress: cProg
        }
      })

      setCourses(compiledCourses)
    } catch (err) {
      console.error('Failed to load student dashboard data:', err)
    } finally {
      setLoadingContent(false)
    }
  }, [studentProfile?.id])

  useEffect(() => {
    loadStudentDashboardData()
  }, [loadStudentDashboardData])

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
              Selamat datang di petualangan coding PRICODE! Selesaikan setiap materi pembelajaran, ikuti kuis sub-materi, dan pecahkan Kuis Akhir untuk menuntaskan kurikulum!
            </p>
          </div>
        </div>

        {/* Enrolled Courses Section */}
        {loadingContent ? (
          <div className="card-brutal bg-white p-12 text-center text-neutral-600 font-bold space-y-3">
            <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow" />
            <p className="text-sm">Memuat kurikulum dan progress belajar...</p>
          </div>
        ) : courses.length === 0 ? (
          <div className="card-brutal bg-white p-8 text-center space-y-2">
            <p className="font-black text-sm text-black">Belum ada kursus yang tersedia saat ini.</p>
            <p className="text-xs text-neutral-600">
              Guru sedang mempersiapkan kurikulum belajar untukmu.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {courses.map((course) => {
              // Check cooldown on this course
              const cooldownUntil = course.courseProgress?.cooldown_until
              const cooldownMs = cooldownUntil ? new Date(cooldownUntil).getTime() - currentTime : 0
              const isCooldownActive = cooldownMs > 0
              const cooldownSecs = Math.max(0, Math.floor(cooldownMs / 1000))
              const formattedTimer = `${Math.floor(cooldownSecs / 60)
                .toString()
                .padStart(2, '0')}:${(cooldownSecs % 60).toString().padStart(2, '0')}`

              const isCourseCompleted = course.courseProgress?.status === 'completed'

              return (
                <div
                  key={course.id}
                  className="card-brutal bg-white p-6 sm:p-8 space-y-6 border-2 border-black shadow-brutal-lg"
                >
                  {/* Course Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-xl bg-retro-lavender border-2 border-black flex items-center justify-center shadow-brutal-sm flex-shrink-0">
                        <BookOpen className="w-6 h-6 text-black stroke-[2.5]" />
                      </div>
                      <div>
                        <span className="badge-brutal text-[10px] bg-retro-green text-black mb-1 inline-block font-mono">
                          KURSUS AKTIF
                        </span>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                          {course.title}
                        </h2>
                        <p className="text-xs text-neutral-600 font-medium">
                          {course.description ||
                            'Pengenalan konsep logika komputasi dan tantangan coding interaktif.'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-start sm:self-auto">
                      {isCourseCompleted ? (
                        <span className="badge-brutal bg-retro-green text-black text-xs py-1.5 px-3 flex items-center gap-1.5 font-black">
                          <Award className="w-4 h-4 stroke-[2.5]" />
                          <span>KURSUS TUNTAS ({course.courseProgress?.quiz_score}%)</span>
                        </span>
                      ) : (
                        <span className="badge-brutal bg-retro-yellow text-black text-xs py-1.5 px-3 flex items-center gap-1.5 font-bold">
                          <CheckCircle2 className="w-4 h-4 stroke-[3]" />
                          <span>SEDANG DIPELAJARI</span>
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Subcourses List */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-mono font-black uppercase text-neutral-500 tracking-wider">
                      Daftar Sub-Materi & Evaluasi:
                    </h3>

                    {course.subcourses.length === 0 ? (
                      <p className="text-xs text-neutral-600 italic">
                        Belum ada sub-materi dalam kursus ini.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-3">
                        {course.subcourses.map((sc, index) => {
                          const isCompleted = sc.status === 'completed'

                          return (
                            <div
                              key={sc.id}
                              className="bg-[#FAF7EE] border-2 border-black rounded-xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-brutal-sm hover:bg-white transition"
                            >
                              <div className="space-y-1">
                                <div className="flex items-center gap-2">
                                  <span className="w-6 h-6 rounded-md bg-retro-yellow border border-black text-black font-mono font-black text-xs flex items-center justify-center">
                                    {index + 1}
                                  </span>
                                  <span className="badge-brutal bg-black text-white text-[10px] font-mono">
                                    SUB-MATERI
                                  </span>
                                  {isCompleted && (
                                    <span className="badge-brutal bg-retro-green text-black text-[10px] font-mono flex items-center gap-1">
                                      <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                                      <span>Lulus ({sc.quizScore}%)</span>
                                    </span>
                                  )}
                                </div>
                                <h4 className="text-base font-black text-black">{sc.title}</h4>
                                <p className="text-xs text-neutral-600">
                                  Baca materi, tonton video, pecahkan balok kode IA1 & IA2, serta selesaikan kuis sub-materi.
                                </p>
                              </div>

                              <Link
                                to={`/learn/${sc.id}`}
                                className="btn-brutal-yellow text-xs py-2 px-4 inline-flex items-center justify-center gap-2 flex-shrink-0 font-black"
                              >
                                <Play className="w-3.5 h-3.5 fill-black" />
                                <span>{isCompleted ? 'Pelajari Ulang' : 'Mulai Belajar ➔'}</span>
                              </Link>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {/* Course Final Quiz Section Card */}
                  <div
                    className={`card-brutal border-2 border-black p-5 sm:p-6 rounded-2xl shadow-brutal flex flex-col sm:flex-row sm:items-center justify-between gap-5 ${
                      isCourseCompleted
                        ? 'bg-[#D1FAE5]'
                        : isCooldownActive
                        ? 'bg-[#FFE4E6]'
                        : 'bg-retro-yellow/20'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="badge-brutal bg-black text-white text-xs font-mono font-black flex items-center gap-1.5">
                          <Award className="w-3.5 h-3.5" />
                          <span>KUIS AKHIR KURSUS</span>
                        </span>

                        {isCourseCompleted ? (
                          <span className="badge-brutal bg-retro-green text-black text-xs font-mono font-black">
                            LULUS ({course.courseProgress?.quiz_score}%)
                          </span>
                        ) : isCooldownActive ? (
                          <span className="badge-brutal bg-retro-pink text-white text-xs font-mono font-black flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 animate-pulse" />
                            <span>COOLDOWN: {formattedTimer}</span>
                          </span>
                        ) : (
                          <span className="badge-brutal bg-retro-yellow text-black text-xs font-mono font-black">
                            SIAP DIKERJAKAN
                          </span>
                        )}
                      </div>

                      <h4 className="text-lg font-black text-black">
                        {course.finalQuizTitle || `Evaluasi Komprehensif: ${course.title}`}
                      </h4>

                      <p className="text-xs text-neutral-700 font-medium max-w-xl leading-relaxed">
                        {isCourseCompleted
                          ? 'Selamat! Kamu telah lulus kuis akhir dan berhasil menguasai seluruh materi dalam kursus ini.'
                          : isCooldownActive
                          ? 'Kamu sedang dalam masa jeda 10 menit setelah percobaan sebelumnya. Harap pelajari kembali materi yang direkomendasikan sebelum mencoba lagi.'
                          : 'Uji pemahaman komprehensif seluruh materi kursus. Batas lulus 70%. Kegagalan akan mengunci kuis selama 10 menit.'}
                      </p>

                      {/* Diagnostic Review Recommendation Highlight */}
                      {isCooldownActive && course.courseProgress?.weakest_subcourse_title && (
                        <div className="bg-white border-2 border-black p-3 rounded-xl flex items-center gap-3 text-xs font-bold text-black mt-2">
                          <AlertTriangle className="w-4 h-4 text-retro-pink shrink-0" />
                          <span>
                            Materi yang perlu kamu pelajari ulang:{' '}
                            <span className="underline font-black">
                              {course.courseProgress.weakest_subcourse_title}
                            </span>
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="shrink-0 flex flex-col gap-2">
                      <Link
                        to={`/courses/${course.id}/final-quiz`}
                        className={`text-xs py-3 px-5 inline-flex items-center justify-center gap-2 font-black text-center ${
                          isCooldownActive
                            ? 'btn-brutal-white border-2 border-black'
                            : isCourseCompleted
                            ? 'btn-brutal-green'
                            : 'btn-brutal-yellow'
                        }`}
                      >
                        {isCooldownActive ? (
                          <>
                            <Clock className="w-4 h-4" />
                            <span>Buka Status Cooldown</span>
                          </>
                        ) : isCourseCompleted ? (
                          <>
                            <Award className="w-4 h-4" />
                            <span>Lihat Hasil / Ulangi</span>
                          </>
                        ) : (
                          <>
                            <Play className="w-4 h-4 fill-black" />
                            <span>Mulai Kuis Akhir ➔</span>
                          </>
                        )}
                      </Link>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

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
