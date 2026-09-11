import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import TextActivityRenderer from '../../components/student/TextActivityRenderer'
import VideoActivityRenderer from '../../components/student/VideoActivityRenderer'
import BlockSequencer, { IABlockItem } from '../../components/student/BlockSequencer'
import QuizEngine, { QuizQuestion, QuizResult } from '../../components/student/QuizEngine'
import {
  canAccessActivity,
  canAccessSubcourse,
  fetchCompletedActivities,
  markActivityCompleted,
  SubCourseGatingItem
} from '../../lib/gating'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Video,
  Puzzle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Code2,
  HelpCircle,
  Award,
  Lock,
  Check,
  AlertTriangle
} from 'lucide-react'

type SupportedActivityType = 'text' | 'video' | 'ia1' | 'ia2' | 'quiz'

interface ActivityItem {
  id: string
  subcourse_id: string
  type: SupportedActivityType
  order: number
  content_ref: Record<string, unknown>
}

const STEP_DEFINITIONS: {
  type: SupportedActivityType
  label: string
  shortLabel: string
  icon: typeof BookOpen
  accentColor: string
}[] = [
  {
    type: 'text',
    label: '1. Materi Bacaan',
    shortLabel: 'Bacaan',
    icon: BookOpen,
    accentColor: 'bg-retro-yellow'
  },
  {
    type: 'video',
    label: '2. Video Pembelajaran',
    shortLabel: 'Video',
    icon: Video,
    accentColor: 'bg-retro-green'
  },
  {
    type: 'ia1',
    label: '3. Latihan Balok 1',
    shortLabel: 'Blok 1',
    icon: Puzzle,
    accentColor: 'bg-retro-pink'
  },
  {
    type: 'ia2',
    label: '4. Latihan Balok 2',
    shortLabel: 'Blok 2',
    icon: Puzzle,
    accentColor: 'bg-retro-lavender'
  },
  {
    type: 'quiz',
    label: '5. Kuis Sub-Materi',
    shortLabel: 'Kuis',
    icon: HelpCircle,
    accentColor: 'bg-retro-yellow'
  }
]

export default function StudentActivityPlayerPage() {
  const { subcourseId, activityType: routeActivityType } = useParams<{
    subcourseId: string
    activityType?: string
  }>()

  const navigate = useNavigate()
  const { studentProfile } = useAuth()

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [currentType, setCurrentType] = useState<SupportedActivityType>('text')

  // Block data for IA1 / IA2
  const [iaBlocks, setIaBlocks] = useState<IABlockItem[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)

  // Quiz data for SubCourse Quiz
  const [quizTitle, setQuizTitle] = useState('')
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([])
  const [loadingQuiz, setLoadingQuiz] = useState(false)
  const [subcourseProgress, setSubcourseProgress] = useState<{
    attempts: number
    quiz_score: number | null
    status: string
  } | null>(null)

  // Progression & Gating state
  const [completedActivities, setCompletedActivities] = useState<string[]>([])
  const [gatingAlert, setGatingAlert] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Helper: Get student ID
  const getStudentId = useCallback(async (): Promise<string | null> => {
    if (studentProfile?.id) return studentProfile.id
    if (!supabase) return null
    try {
      const { data } = await supabase.rpc('get_current_student_id')
      return data || null
    } catch {
      return null
    }
  }, [studentProfile?.id])

  // Fetch SubCourse, Course, Sibling Subcourses, and Activities
  const fetchSubCourseActivities = useCallback(async () => {
    if (!supabase || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      const stId = await getStudentId()

      // 1. Fetch subcourse & course info
      const { data: scData, error: scErr } = await supabase
        .from('sub_courses')
        .select('id, title, course_id, order')
        .eq('id', subcourseId)
        .single()

      if (scErr) throw scErr
      if (!scData) throw new Error('Sub-materi tidak ditemukan.')

      setSubCourseTitle(scData.title)

      const { data: cData } = await supabase
        .from('courses')
        .select('title')
        .eq('id', scData.course_id)
        .single()

      if (cData) setCourseTitle(cData.title)

      // 2. SubCourse-to-SubCourse Gating Enforcement
      const { data: siblingSubcourses } = await supabase
        .from('sub_courses')
        .select('id, title, order, course_id')
        .eq('course_id', scData.course_id)
        .order('order', { ascending: true })

      if (siblingSubcourses && siblingSubcourses.length > 0 && stId) {
        const siblingIds = siblingSubcourses.map((s) => s.id)
        const { data: siblingProgs } = await supabase
          .from('progress')
          .select('subcourse_id, status')
          .eq('student_id', stId)
          .in('subcourse_id', siblingIds)

        const siblingProgMap: Record<string, { status?: string }> = {}
        siblingProgs?.forEach((sp) => {
          siblingProgMap[sp.subcourse_id] = { status: sp.status }
        })

        const scGating = canAccessSubcourse(
          siblingSubcourses as SubCourseGatingItem[],
          siblingProgMap,
          subcourseId
        )

        if (!scGating.allowed && scGating.redirectSubcourseId) {
          setGatingAlert(
            scGating.reason || 'Akses Dibatasi: Selesaikan sub-materi sebelumnya terlebih dahulu!'
          )
          navigate(`/learn/${scGating.redirectSubcourseId}`, { replace: true })
          return
        }
      }

      // 3. Fetch activities for this subcourse
      const { data: actData, error: actErr } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .order('order', { ascending: true })

      if (actErr) throw actErr
      setActivities((actData as ActivityItem[]) || [])

      // 4. Fetch student progress & completed activities for this subcourse
      let isCompleted = false
      if (stId) {
        const { data: progData } = await supabase
          .from('progress')
          .select('attempts, quiz_score, status')
          .eq('student_id', stId)
          .eq('subcourse_id', subcourseId)
          .maybeSingle()

        if (progData) {
          setSubcourseProgress(progData)
          isCompleted = progData.status === 'completed'
        }

        const acts = await fetchCompletedActivities(stId, subcourseId, isCompleted, supabase)
        setCompletedActivities(acts)

        // 5. Activity-Level Gating Check on current target activity
        const targetAct = (routeActivityType as SupportedActivityType) || 'text'
        const actGating = canAccessActivity(acts, targetAct, isCompleted)

        if (!actGating.allowed) {
          setGatingAlert(
            actGating.reason || 'Akses Dibatasi: Selesaikan aktivitas sebelumnya terlebih dahulu!'
          )
          setCurrentType(actGating.redirectActivity)
          navigate(`/learn/${subcourseId}/${actGating.redirectActivity}`, { replace: true })
        } else {
          setCurrentType(targetAct)
        }
      } else {
        setCurrentType((routeActivityType as SupportedActivityType) || 'text')
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat aktivitas materi.')
    } finally {
      setLoading(false)
    }
  }, [subcourseId, routeActivityType, getStudentId, navigate])

  useEffect(() => {
    fetchSubCourseActivities()
  }, [fetchSubCourseActivities])

  // Fetch IA blocks when currentType is ia1 or ia2
  const fetchIABlocks = useCallback(
    async (activityId: string) => {
      if (!supabase || !activityId) return
      setLoadingBlocks(true)

      try {
        const { data: blocksData, error: blocksErr } = await supabase
          .from('ia_blocks')
          .select('*')
          .eq('activity_id', activityId)
          .order('created_at', { ascending: true })

        if (blocksErr) throw blocksErr

        setIaBlocks((blocksData as IABlockItem[]) || [])
      } catch (err: unknown) {
        const e = err as Error
        setErrorMessage(e.message || 'Gagal memuat balok interaktif.')
      } finally {
        setLoadingBlocks(false)
      }
    },
    []
  )

  useEffect(() => {
    const currentAct = activities.find((a) => a.type === currentType)
    if (currentAct && (currentType === 'ia1' || currentType === 'ia2')) {
      fetchIABlocks(currentAct.id)
    }
  }, [currentType, activities, fetchIABlocks])

  // Fetch Quiz Data when currentType is 'quiz'
  const fetchSubCourseQuizData = useCallback(async () => {
    if (!supabase || !subcourseId) return
    setLoadingQuiz(true)

    try {
      const { data: qData, error: qErr } = await supabase
        .from('sub_course_quizzes')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .maybeSingle()

      if (qErr) throw qErr

      if (qData) {
        setQuizTitle(qData.title || `Kuis Evaluasi Sub-Materi: ${subCourseTitle}`)

        const { data: questionsData, error: questionsErr } = await supabase
          .from('questions')
          .select('*')
          .eq('sub_course_quiz_id', qData.id)
          .order('created_at', { ascending: true })

        if (questionsErr) throw questionsErr

        if (questionsData) {
          setQuizQuestions(
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
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat kuis sub-materi.')
    } finally {
      setLoadingQuiz(false)
    }
  }, [subcourseId, subCourseTitle])

  useEffect(() => {
    if (currentType === 'quiz') {
      fetchSubCourseQuizData()
    }
  }, [currentType, fetchSubCourseQuizData])

  // Navigation helpers with Gating Enforcement
  const isSubcourseCompleted = subcourseProgress?.status === 'completed'

  const goToActivity = async (type: SupportedActivityType) => {
    const gating = canAccessActivity(completedActivities, type, isSubcourseCompleted)
    if (!gating.allowed) {
      setGatingAlert(gating.reason || 'Aktivitas ini masih terkunci.')
      return
    }

    setGatingAlert(null)
    setCurrentType(type)
    navigate(`/learn/${subcourseId}/${type}`)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Advancing to Next Activity with Completion Tracking
  const handleNext = async () => {
    const stId = await getStudentId()

    // 1. Mark current activity as completed upon moving forward
    if (stId && subcourseId) {
      if (currentType === 'text') {
        const updated = await markActivityCompleted(stId, subcourseId, 'text', supabase)
        setCompletedActivities(updated)
      } else if (currentType === 'video') {
        const updated = await markActivityCompleted(stId, subcourseId, 'video', supabase)
        setCompletedActivities(updated)
      }
    }

    const currentStepIndex = STEP_DEFINITIONS.findIndex((s) => s.type === currentType)
    if (currentStepIndex < STEP_DEFINITIONS.length - 1) {
      const nextStep = STEP_DEFINITIONS[currentStepIndex + 1].type
      goToActivity(nextStep)
    }
  }

  const handlePrev = () => {
    const currentStepIndex = STEP_DEFINITIONS.findIndex((s) => s.type === currentType)
    if (currentStepIndex > 0) {
      const prevStep = STEP_DEFINITIONS[currentStepIndex - 1].type
      goToActivity(prevStep)
    }
  }

  // Handle Block Sequencer Success
  const handleBlockSuccess = async (actType: 'ia1' | 'ia2') => {
    const stId = await getStudentId()
    if (stId && subcourseId) {
      const updated = await markActivityCompleted(stId, subcourseId, actType, supabase)
      setCompletedActivities(updated)
    }
  }

  // Handle SubCourse Quiz Submission
  const handleSubCourseQuizComplete = async (res: QuizResult) => {
    if (!supabase || !subcourseId) return

    try {
      const stId = await getStudentId()
      if (!stId) {
        console.warn('Student ID not found, unable to write progress to DB')
        return
      }

      const nextAttempts = (subcourseProgress?.attempts || 0) + 1
      const nextStatus = res.passed ? 'completed' : 'in_progress'

      // If passed, mark quiz and all activities completed
      let updatedActs = completedActivities
      if (res.passed) {
        updatedActs = await markActivityCompleted(stId, subcourseId, 'quiz', supabase)
        setCompletedActivities(['text', 'video', 'ia1', 'ia2', 'quiz'])
      }

      const { error: saveErr } = await supabase.from('progress').upsert(
        {
          student_id: stId,
          subcourse_id: subcourseId,
          status: nextStatus,
          quiz_score: res.score,
          attempts: nextAttempts,
          completed_activities: res.passed
            ? ['text', 'video', 'ia1', 'ia2', 'quiz']
            : updatedActs,
          cooldown_until: null,
          updated_at: new Date().toISOString()
        },
        { onConflict: 'student_id,subcourse_id' }
      )

      if (saveErr) {
        console.error('Error saving subcourse quiz progress:', saveErr)
      } else {
        setSubcourseProgress({
          attempts: nextAttempts,
          quiz_score: res.score,
          status: nextStatus
        })
      }
    } catch (err) {
      console.error('Failed to update subcourse progress:', err)
    }
  }

  const currentStepIndex = STEP_DEFINITIONS.findIndex((s) => s.type === currentType)
  const activeActivity = activities.find((a) => a.type === currentType)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex flex-col items-center justify-center p-6 text-black font-sans">
        <div className="card-brutal bg-white p-8 text-center space-y-4 shadow-brutal max-w-sm w-full">
          <Sparkles className="w-10 h-10 animate-spin mx-auto text-retro-yellow" />
          <h2 className="text-base font-black tracking-tight">Memuat Ruang Belajar Siswa...</h2>
          <p className="text-xs text-neutral-600 font-medium">Memeriksa hak akses dan progress belajar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#FAF7EE] text-black flex flex-col font-sans">
      {/* Top Navbar */}
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
              <div className="w-8 h-8 rounded-lg bg-retro-yellow border-2 border-black flex items-center justify-center font-black text-xs shadow-brutal-sm">
                <Code2 className="w-4 h-4 text-black stroke-[2.5]" />
              </div>
              <div className="truncate">
                <p className="text-[10px] uppercase font-black tracking-wider text-neutral-500 font-mono truncate">
                  {courseTitle || 'Kursus'}
                </p>
                <h1 className="text-sm sm:text-base font-black text-black truncate">
                  {subCourseTitle || 'Sub-Materi'}
                </h1>
              </div>
            </div>
          </div>

          {/* Current Step Counter Badge */}
          <div className="flex items-center gap-2 shrink-0">
            {isSubcourseCompleted && (
              <span className="badge-brutal text-xs bg-retro-green text-black font-mono font-black hidden sm:inline-flex items-center gap-1">
                <Award className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Lulus ({subcourseProgress?.quiz_score}%)</span>
              </span>
            )}
            <span className="badge-brutal text-xs bg-black text-white font-mono font-black">
              Langkah {currentStepIndex + 1} / {STEP_DEFINITIONS.length}
            </span>
          </div>
        </div>

        {/* Stepper Navigation Bar with Gating & Locking Visuals */}
        <div className="border-t-2 border-black bg-[#FAF7EE] overflow-x-auto py-2 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-center sm:justify-start gap-2 min-w-max">
            {STEP_DEFINITIONS.map((step, idx) => {
              const isActive = step.type === currentType
              const stepGating = canAccessActivity(completedActivities, step.type, isSubcourseCompleted)
              const isLocked = !stepGating.allowed
              const isDone = completedActivities.includes(step.type) || isSubcourseCompleted
              const IconComp = step.icon

              return (
                <button
                  key={step.type}
                  onClick={() => goToActivity(step.type)}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-xl text-xs font-black transition ${
                    isActive
                      ? 'bg-black text-white border-2 border-black shadow-brutal-sm scale-105'
                      : isLocked
                      ? 'bg-neutral-100 text-neutral-400 border-2 border-black/20 opacity-60 cursor-not-allowed'
                      : 'bg-white text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-black/40'
                  }`}
                  title={isLocked ? stepGating.reason : `Buka ${step.label}`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-mono font-black ${
                      isActive
                        ? 'bg-retro-yellow text-black'
                        : isDone
                        ? 'bg-retro-green text-black'
                        : isLocked
                        ? 'bg-neutral-200 text-neutral-500'
                        : 'bg-neutral-100 text-black'
                    }`}
                  >
                    {isDone && !isActive ? (
                      <Check className="w-3 h-3 stroke-[3]" />
                    ) : isLocked ? (
                      <Lock className="w-3 h-3 text-neutral-600" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{step.shortLabel}</span>
                  {isLocked && <Lock className="w-3 h-3 text-neutral-400 ml-0.5" />}
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        {/* Progression & Gating Alert Banner */}
        {gatingAlert && (
          <div className="card-brutal bg-retro-pink text-white p-4 font-bold text-xs shadow-brutal flex items-center justify-between gap-3 animate-pulse">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 stroke-[2.5]" />
              <span className="text-xs">{gatingAlert}</span>
            </div>
            <button
              onClick={() => setGatingAlert(null)}
              className="underline text-xs shrink-0 hover:text-retro-yellow"
            >
              Mengerti
            </button>
          </div>
        )}

        {errorMessage && (
          <div className="card-brutal bg-retro-pink p-4 text-white text-xs font-bold shadow-brutal flex items-center justify-between gap-3">
            <span>{errorMessage}</span>
            <button onClick={() => setErrorMessage(null)} className="underline text-xs">
              Tutup
            </button>
          </div>
        )}

        {/* Step 1: Text Activity */}
        {currentType === 'text' && (
          <TextActivityRenderer
            title={subCourseTitle}
            content={
              (activeActivity?.content_ref as { text?: string })?.text ||
              '# ' + (subCourseTitle || 'Materi') + '\n\nMateri bacaan sedang disiapkan.'
            }
          />
        )}

        {/* Step 2: Video Activity */}
        {currentType === 'video' && (
          <VideoActivityRenderer
            title={subCourseTitle}
            videoId={(activeActivity?.content_ref as { video_id?: string })?.video_id}
            fallbackText={(activeActivity?.content_ref as { fallback_text?: string })?.fallback_text}
          />
        )}

        {/* Step 3: IA1 Block Sequencer */}
        {currentType === 'ia1' && (
          <div>
            {loadingBlocks ? (
              <div className="card-brutal bg-white p-16 text-center space-y-3 font-bold text-neutral-600">
                <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow" />
                <p className="text-sm">Menyiapkan balok tantangan coding...</p>
              </div>
            ) : (
              <BlockSequencer
                activityNumber={3}
                activityType="ia1"
                activityTitle={
                  (activeActivity?.content_ref as { title?: string })?.title ||
                  'Urutkan Blok Pembuatan Variabel'
                }
                blocks={iaBlocks}
                onSuccess={() => handleBlockSuccess('ia1')}
                onNextActivity={handleNext}
              />
            )}
          </div>
        )}

        {/* Step 4: IA2 Block Sequencer */}
        {currentType === 'ia2' && (
          <div>
            {loadingBlocks ? (
              <div className="card-brutal bg-white p-16 text-center space-y-3 font-bold text-neutral-600">
                <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow" />
                <p className="text-sm">Menyiapkan balok tantangan lanjutan...</p>
              </div>
            ) : (
              <BlockSequencer
                activityNumber={4}
                activityType="ia2"
                activityTitle={
                  (activeActivity?.content_ref as { title?: string })?.title ||
                  'Tantangan Balok: Nilai Variabel & Perhitungan'
                }
                blocks={iaBlocks}
                onSuccess={() => handleBlockSuccess('ia2')}
                onNextActivity={() => goToActivity('quiz')}
              />
            )}
          </div>
        )}

        {/* Step 5: SubCourse Quiz */}
        {currentType === 'quiz' && (
          <div>
            {loadingQuiz ? (
              <div className="card-brutal bg-white p-16 text-center space-y-3 font-bold text-neutral-600">
                <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow" />
                <p className="text-sm">Menyiapkan soal kuis sub-materi...</p>
              </div>
            ) : quizQuestions.length === 0 ? (
              <div className="card-brutal bg-white p-12 text-center space-y-3 font-bold text-neutral-600">
                <HelpCircle className="w-10 h-10 mx-auto text-retro-yellow" />
                <h3 className="text-base font-black text-black">Kuis Belum Tersedia</h3>
                <p className="text-xs text-neutral-600">
                  Guru sedang menyusun pertanyaan kuis evaluasi untuk sub-materi ini.
                </p>
                <div className="pt-2">
                  <Link to="/dashboard" className="btn-brutal-yellow text-xs py-2 px-4 inline-block">
                    Kembali ke Dashboard
                  </Link>
                </div>
              </div>
            ) : (
              <QuizEngine
                quizType="subcourse"
                title={quizTitle || `Kuis Evaluasi: ${subCourseTitle}`}
                subtitle="Jawab setiap soal pilihan ganda di bawah. Dapatkan nilai minimal 70% untuk menyelesaikan sub-materi ini. Jika belum berhasil, kamu dapat langsung mengulang kuis tanpa jeda waktu!"
                questions={quizQuestions}
                passThreshold={70}
                onComplete={handleSubCourseQuizComplete}
                backToDashboardUrl="/dashboard"
                onContinueNext={() => navigate('/dashboard')}
              />
            )}
          </div>
        )}

        {/* Bottom Navigation Toolbar */}
        <div className="card-brutal bg-white p-4 flex items-center justify-between gap-4 max-w-4xl mx-auto shadow-brutal-sm">
          <button
            onClick={handlePrev}
            disabled={currentStepIndex === 0}
            className="btn-brutal-white text-xs py-2 px-4 inline-flex items-center gap-1.5 disabled:opacity-30 disabled:pointer-events-none"
          >
            <ChevronLeft className="w-4 h-4" />
            <span>Sebelumnya</span>
          </button>

          <div className="text-center font-mono text-xs font-bold text-neutral-600 hidden sm:block">
            {STEP_DEFINITIONS[currentStepIndex]?.label}
          </div>

          {currentStepIndex < STEP_DEFINITIONS.length - 1 ? (
            <button
              onClick={handleNext}
              className="btn-brutal-yellow text-xs py-2 px-4 inline-flex items-center gap-1.5 font-black"
            >
              <span>Selesai & Lanjut</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to="/dashboard"
              className="btn-brutal-green text-xs py-2 px-4 inline-flex items-center gap-1.5 font-black"
            >
              <span>Selesai & Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
