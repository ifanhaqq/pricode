import { useState, useEffect, useCallback, useMemo } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import QuizEngine, { QuizQuestion, QuizResult } from '../../components/student/QuizEngine'
import {
  ArrowLeft,
  Award,
  Code2,
  HelpCircle,
  Sparkles,
  AlertCircle
} from 'lucide-react'

interface CourseProgress {
  attempts: number
  quiz_score: number | null
  status: string
  cooldown_until: string | null
  weakest_subcourse_id: string | null
}

export default function FinalQuizPlayerPage() {
  const { courseId } = useParams<{ courseId: string }>()
  const { studentProfile } = useAuth()

  const [courseTitle, setCourseTitle] = useState('')
  const [subcourseMap, setSubcourseMap] = useState<Record<string, string>>({})
  const [quizTitle, setQuizTitle] = useState('')
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [courseProgress, setCourseProgress] = useState<CourseProgress | null>(null)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Local storage helper key for resilience
  const localStorageKey = useMemo(() => {
    const stId = studentProfile?.id || 'guest'
    return `pricode_progress_${stId}_course_${courseId}`
  }, [studentProfile?.id, courseId])

  // Fetch Course, Subcourses, Final Quiz, and Questions
  const loadFinalQuizData = useCallback(async () => {
    if (!supabase || !courseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch Course details
      const { data: cData, error: cErr } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single()

      if (cErr) throw cErr
      if (cData) setCourseTitle(cData.title)

      // 2. Fetch all Subcourses for title mapping
      const { data: scData, error: scErr } = await supabase
        .from('sub_courses')
        .select('id, title')
        .eq('course_id', courseId)

      if (scErr) throw scErr
      const scMap: Record<string, string> = {}
      if (scData) {
        scData.forEach((sc) => {
          scMap[sc.id] = sc.title
        })
        setSubcourseMap(scMap)
      }

      // 3. Fetch Final Quiz record
      const { data: qData, error: qErr } = await supabase
        .from('final_quizzes')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle()

      if (qErr) throw qErr

      if (qData) {
        setQuizTitle(qData.title || `Kuis Akhir Kursus: ${cData?.title || ''}`)

        // 4. Fetch Questions for this Final Quiz
        const { data: questionsData, error: questionsErr } = await supabase
          .from('questions')
          .select('*')
          .eq('final_quiz_id', qData.id)
          .order('created_at', { ascending: true })

        if (questionsErr) throw questionsErr

        if (questionsData) {
          setQuestions(
            questionsData.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer,
              subcourse_id_tag: q.subcourse_id_tag
            }))
          )
        }
      }

      // 5. Fetch student's course progress
      let stId = studentProfile?.id
      if (!stId) {
        const { data: idData } = await supabase.rpc('get_current_student_id')
        stId = idData
      }

      let loadedProgress: CourseProgress | null = null

      if (stId) {
        try {
          const { data: dbProg, error: progErr } = await supabase
            .from('progress')
            .select('attempts, quiz_score, status, cooldown_until, weakest_subcourse_id')
            .eq('student_id', stId)
            .eq('course_id', courseId)
            .maybeSingle()

          if (!progErr && dbProg) {
            loadedProgress = dbProg as CourseProgress
          }
        } catch {
          // Column course_id might not exist yet if migration pending
        }
      }

      // Fallback / sync with localStorage
      if (!loadedProgress) {
        const cached = localStorage.getItem(localStorageKey)
        if (cached) {
          try {
            loadedProgress = JSON.parse(cached)
          } catch {
            // ignore JSON parse error
          }
        }
      }

      // Check if cooldown has expired
      if (loadedProgress?.cooldown_until) {
        const isExpired = new Date(loadedProgress.cooldown_until).getTime() <= Date.now()
        if (isExpired) {
          loadedProgress.cooldown_until = null
        }
      }

      if (loadedProgress) {
        setCourseProgress(loadedProgress)
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat kuis akhir kursus.')
    } finally {
      setLoading(false)
    }
  }, [courseId, studentProfile?.id, localStorageKey])

  useEffect(() => {
    loadFinalQuizData()
  }, [loadFinalQuizData])

  // Handle Final Quiz Complete
  const handleFinalQuizComplete = async (res: QuizResult) => {
    if (!courseId) return

    let stId = studentProfile?.id
    if (!stId && supabase) {
      const { data: idData } = await supabase.rpc('get_current_student_id')
      stId = idData
    }

    const nextAttempts = (courseProgress?.attempts || 0) + 1
    const nextStatus = res.passed ? 'completed' : 'in_progress'
    const nextCooldownUntil = res.passed
      ? null
      : new Date(Date.now() + 10 * 60 * 1000).toISOString() // 10 minutes lockout
    const nextWeakestSubcourse = res.weakestSubcourseId || null

    const updatedProg: CourseProgress = {
      attempts: nextAttempts,
      quiz_score: res.score,
      status: nextStatus,
      cooldown_until: nextCooldownUntil,
      weakest_subcourse_id: nextWeakestSubcourse
    }

    setCourseProgress(updatedProg)

    // 1. Cache to localStorage for instantaneous client resilience
    try {
      localStorage.setItem(localStorageKey, JSON.stringify(updatedProg))
    } catch {
      // ignore
    }

    // 2. Persist to Supabase progress table
    if (supabase && stId) {
      try {
        const { error: upsertErr } = await supabase.from('progress').upsert(
          {
            student_id: stId,
            course_id: courseId,
            status: nextStatus,
            quiz_score: res.score,
            attempts: nextAttempts,
            cooldown_until: nextCooldownUntil,
            weakest_subcourse_id: nextWeakestSubcourse,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'student_id,course_id' }
        )

        if (upsertErr) {
          console.warn('DB course_id upsert error (migration may be pending):', upsertErr.message)
        }
      } catch (err) {
        console.warn('Failed to upsert course progress to database:', err)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex flex-col items-center justify-center p-6 text-black font-sans">
        <div className="card-brutal bg-white p-8 text-center space-y-4 shadow-brutal max-w-sm w-full">
          <Sparkles className="w-10 h-10 animate-spin mx-auto text-retro-yellow" />
          <h2 className="text-base font-black tracking-tight">Memuat Kuis Akhir Kursus...</h2>
          <p className="text-xs text-neutral-600 font-medium">Menyiapkan soal evaluasi komprehensif.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col font-sans">
      {/* Top Navigation */}
      <header className="border-b-2 border-black bg-white sticky top-0 z-30 shadow-brutal-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              to="/dashboard"
              className="btn-brutal-white text-xs py-1.5 px-3 inline-flex items-center gap-1.5 hover:bg-neutral-100"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Kembali ke Dashboard</span>
              <span className="sm:hidden">Dashboard</span>
            </Link>

            <div className="h-5 w-[2px] bg-black/20 hidden sm:block" />

            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-retro-lavender border-2 border-black flex items-center justify-center font-black text-xs shadow-brutal-sm">
                <Code2 className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <div className="truncate">
                <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500 font-mono truncate">
                  Evaluasi Akhir
                </p>
                <h1 className="text-sm sm:text-base font-black text-black truncate">
                  {courseTitle || 'Kursus PRICODE'}
                </h1>
              </div>
            </div>
          </div>

          {/* Status Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {courseProgress?.status === 'completed' && (
              <span className="badge-brutal text-xs bg-retro-green text-black font-mono font-black flex items-center gap-1">
                <Award className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Lulus ({courseProgress.quiz_score}%)</span>
              </span>
            )}
            <span className="badge-brutal text-xs bg-black text-white font-mono font-black">
              KUIS AKHIR
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {errorMessage && (
          <div className="card-brutal bg-retro-pink p-4 text-white text-xs font-bold shadow-brutal flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button onClick={() => setErrorMessage(null)} className="underline text-xs">
              Tutup
            </button>
          </div>
        )}

        {questions.length === 0 ? (
          <div className="card-brutal bg-white p-12 text-center space-y-4 shadow-brutal max-w-lg mx-auto">
            <HelpCircle className="w-12 h-12 mx-auto text-retro-yellow" />
            <h3 className="text-lg font-black text-black">Kuis Akhir Belum Tersedia</h3>
            <p className="text-xs text-neutral-600 font-medium">
              Guru sedang menyusun bank soal evaluasi akhir untuk kursus {courseTitle}.
            </p>
            <div className="pt-2">
              <Link to="/dashboard" className="btn-brutal-yellow text-xs py-2 px-4 inline-block">
                Kembali ke Dashboard
              </Link>
            </div>
          </div>
        ) : (
          <QuizEngine
            quizType="final"
            title={quizTitle || `Kuis Akhir Kursus: ${courseTitle}`}
            subtitle="Uji penguasaan seluruh konsep yang telah kamu pelajari di kursus ini. Batas nilai kelulusan adalah 70%. Jika belum lulus, sistem akan memberikan waktu jeda 10 menit agar kamu dapat mempelajari ulang konsep yang direkomendasikan."
            questions={questions}
            passThreshold={70}
            subcourseMap={subcourseMap}
            initialCooldownUntil={courseProgress?.cooldown_until}
            initialWeakestSubcourseId={courseProgress?.weakest_subcourse_id}
            onComplete={handleFinalQuizComplete}
            backToDashboardUrl="/dashboard"
            onContinueNext={() => {
              window.location.href = '#/dashboard'
            }}
          />
        )}
      </main>
    </div>
  )
}
