import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import TextActivityRenderer from '../../components/student/TextActivityRenderer'
import VideoActivityRenderer from '../../components/student/VideoActivityRenderer'
import BlockSequencer, { IABlockItem } from '../../components/student/BlockSequencer'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Video,
  Puzzle,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Code2
} from 'lucide-react'

type SupportedActivityType = 'text' | 'video' | 'ia1' | 'ia2'

interface ActivityItem {
  id: string
  subcourse_id: string
  type: SupportedActivityType | 'quiz'
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
  }
]

export default function StudentActivityPlayerPage() {
  const { subcourseId, activityType: routeActivityType } = useParams<{
    subcourseId: string
    activityType?: string
  }>()

  const navigate = useNavigate()

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [activities, setActivities] = useState<ActivityItem[]>([])
  const [currentType, setCurrentType] = useState<SupportedActivityType>('text')

  // Block data for IA1 / IA2
  const [iaBlocks, setIaBlocks] = useState<IABlockItem[]>([])
  const [loadingBlocks, setLoadingBlocks] = useState(false)

  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  // Determine active activity type
  useEffect(() => {
    if (
      routeActivityType &&
      ['text', 'video', 'ia1', 'ia2'].includes(routeActivityType as SupportedActivityType)
    ) {
      setCurrentType(routeActivityType as SupportedActivityType)
    } else {
      setCurrentType('text')
    }
  }, [routeActivityType])

  // Fetch SubCourse, Course, and Activities
  const fetchSubCourseActivities = useCallback(async () => {
    if (!supabase || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch subcourse & course info
      const { data: scData, error: scErr } = await supabase
        .from('sub_courses')
        .select('id, title, course_id')
        .eq('id', subcourseId)
        .single()

      if (scErr) throw scErr
      if (scData) {
        setSubCourseTitle(scData.title)

        const { data: cData } = await supabase
          .from('courses')
          .select('title')
          .eq('id', scData.course_id)
          .single()

        if (cData) setCourseTitle(cData.title)
      }

      // 2. Fetch activities for this subcourse
      const { data: actData, error: actErr } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .order('order', { ascending: true })

      if (actErr) throw actErr

      setActivities((actData as ActivityItem[]) || [])
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat aktivitas materi.')
    } finally {
      setLoading(false)
    }
  }, [subcourseId])

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

  // Navigation helpers
  const currentStepIndex = STEP_DEFINITIONS.findIndex((s) => s.type === currentType)

  const goToActivity = (type: SupportedActivityType) => {
    setCurrentType(type)
    navigate(`/learn/${subcourseId}/${type}`, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleNext = () => {
    if (currentStepIndex < STEP_DEFINITIONS.length - 1) {
      goToActivity(STEP_DEFINITIONS[currentStepIndex + 1].type)
    }
  }

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      goToActivity(STEP_DEFINITIONS[currentStepIndex - 1].type)
    }
  }

  // Current activity record
  const activeActivity = activities.find((a) => a.type === currentType)

  if (loading) {
    return (
      <div className="min-h-screen bg-[#FAF7EE] flex flex-col items-center justify-center p-6 text-black font-sans">
        <div className="card-brutal bg-white p-8 text-center space-y-4 shadow-brutal max-w-sm w-full">
          <Sparkles className="w-10 h-10 animate-spin mx-auto text-retro-yellow" />
          <h2 className="text-base font-black tracking-tight">Memuat Ruang Belajar Siswa...</h2>
          <p className="text-xs text-neutral-600 font-medium">Menyiapkan alur aktivitas belajar.</p>
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
          <span className="badge-brutal text-xs bg-black text-white font-mono font-black shrink-0">
            Langkah {currentStepIndex + 1} / {STEP_DEFINITIONS.length}
          </span>
        </div>

        {/* Stepper Navigation Bar (Direct Navigation without Locking) */}
        <div className="border-t-2 border-black bg-[#FAF7EE] overflow-x-auto py-2 px-4">
          <div className="max-w-6xl mx-auto flex items-center justify-center sm:justify-start gap-2 min-w-max">
            {STEP_DEFINITIONS.map((step, idx) => {
              const isActive = step.type === currentType
              const IconComp = step.icon

              return (
                <button
                  key={step.type}
                  onClick={() => goToActivity(step.type)}
                  className={`flex items-center gap-2 py-1.5 px-3 rounded-xl text-xs font-black transition ${
                    isActive
                      ? 'bg-black text-white border-2 border-black shadow-brutal-sm scale-105'
                      : 'bg-white text-neutral-700 hover:text-black hover:bg-neutral-100 border-2 border-black/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs font-mono font-black ${
                      isActive ? 'bg-retro-yellow text-black' : 'bg-neutral-100 text-black'
                    }`}
                  >
                    {idx + 1}
                  </div>
                  <IconComp className="w-3.5 h-3.5" />
                  <span>{step.shortLabel}</span>
                </button>
              )
            })}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
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
                onNextActivity={() => {
                  // After finishing IA2, return to dashboard or show completion toast
                  navigate('/dashboard')
                }}
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
              className="btn-brutal-yellow text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <span>Selanjutnya</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          ) : (
            <Link
              to="/dashboard"
              className="btn-brutal-green text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <span>Kembali ke Dashboard</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          )}
        </div>
      </main>
    </div>
  )
}
