import { useState, useEffect, useMemo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  HelpCircle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  Clock,
  BookOpen,
  Award,
  Sparkles,
  ChevronRight,
  XCircle
} from 'lucide-react'

export interface QuizQuestion {
  id: string
  prompt: string
  options: string[]
  correct_answer: string
  subcourse_id_tag?: string | null
}

export interface QuizResult {
  score: number
  passed: boolean
  totalQuestions: number
  correctCount: number
  wrongCount: number
  missedQuestionTags: string[]
  weakestSubcourseId: string | null
  weakestSubcourseTitle: string | null
  answers: Record<string, string>
}

interface QuizEngineProps {
  quizType: 'subcourse' | 'final'
  title: string
  subtitle?: string
  questions: QuizQuestion[]
  passThreshold?: number // Default: 70
  subcourseMap?: Record<string, string> // subcourse_id -> title mapping
  onComplete?: (result: QuizResult) => Promise<void> | void
  initialCooldownUntil?: string | null
  initialWeakestSubcourseId?: string | null
  backToDashboardUrl?: string
  onContinueNext?: () => void
}

export default function QuizEngine({
  quizType,
  title,
  subtitle,
  questions,
  passThreshold = 70,
  subcourseMap = {},
  onComplete,
  initialCooldownUntil = null,
  initialWeakestSubcourseId = null,
  backToDashboardUrl = '/dashboard',
  onContinueNext
}: QuizEngineProps) {
  // Answers state: questionId -> selectedOption
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({})
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Result state
  const [result, setResult] = useState<QuizResult | null>(null)

  // Cooldown timer state (primarily for Final Quiz)
  const [cooldownUntil, setCooldownUntil] = useState<string | null>(initialCooldownUntil)
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0)
  const [weakestSubcourseId, setWeakestSubcourseId] = useState<string | null>(initialWeakestSubcourseId)

  // Calculate initial cooldown time
  useEffect(() => {
    if (!cooldownUntil) {
      setRemainingSeconds(0)
      return
    }

    const targetTime = new Date(cooldownUntil).getTime()
    const diff = Math.max(0, Math.floor((targetTime - Date.now()) / 1000))
    setRemainingSeconds(diff)

    if (diff <= 0) return

    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.floor((targetTime - Date.now()) / 1000))
      setRemainingSeconds(remaining)
      if (remaining <= 0) {
        clearInterval(interval)
        setCooldownUntil(null)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [cooldownUntil])

  const isCooldownActive = Boolean(cooldownUntil && remainingSeconds > 0)

  // Format remaining seconds into MM:SS
  const formattedCountdown = useMemo(() => {
    const mins = Math.floor(remainingSeconds / 60)
    const secs = remainingSeconds % 60
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }, [remainingSeconds])

  // Weakest subcourse title lookup
  const weakestSubcourseTitle = useMemo(() => {
    if (!weakestSubcourseId) return null
    return subcourseMap[weakestSubcourseId] || 'Materi Pemrograman Terkait'
  }, [weakestSubcourseId, subcourseMap])

  // Select option handler
  const handleSelectOption = (questionId: string, option: string) => {
    if (result) return // Locked if result is showing
    setValidationError(null)
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionId]: option
    }))
  }

  // Submit quiz handler
  const handleSubmit = async () => {
    if (questions.length === 0) return

    // Check that all questions have been answered
    const unansweredCount = questions.filter((q) => !selectedAnswers[q.id]).length
    if (unansweredCount > 0) {
      setValidationError(
        `Masih ada ${unansweredCount} soal yang belum dijawab. Pastikan semua soal telah kamu jawab ya!`
      )
      return
    }

    setSubmitting(true)
    setValidationError(null)

    try {
      let correctCount = 0
      const missedTags: string[] = []

      questions.forEach((q) => {
        const studentAns = selectedAnswers[q.id]?.trim()
        const correctAns = q.correct_answer?.trim()
        if (studentAns === correctAns) {
          correctCount++
        } else {
          if (q.subcourse_id_tag) {
            missedTags.push(q.subcourse_id_tag)
          }
        }
      })

      const totalQuestions = questions.length
      const score = Math.round((correctCount / totalQuestions) * 100)
      const passed = score >= passThreshold
      const wrongCount = totalQuestions - correctCount

      // Compute weakest subcourse from missed tags
      let computedWeakestId: string | null = null
      if (missedTags.length > 0) {
        const tagFrequency: Record<string, number> = {}
        missedTags.forEach((tag) => {
          tagFrequency[tag] = (tagFrequency[tag] || 0) + 1
        })

        let highestCount = -1
        for (const [tag, count] of Object.entries(tagFrequency)) {
          if (count > highestCount) {
            highestCount = count
            computedWeakestId = tag
          }
        }
      } else if (!passed && questions.length > 0) {
        // If no tags were attached to missed questions, pick first question's tag if available
        computedWeakestId = questions.find((q) => q.subcourse_id_tag)?.subcourse_id_tag || null
      }

      const computedWeakestTitle = computedWeakestId
        ? subcourseMap[computedWeakestId] || 'Materi Pemrograman Terkait'
        : null

      const quizResult: QuizResult = {
        score,
        passed,
        totalQuestions,
        correctCount,
        wrongCount,
        missedQuestionTags: missedTags,
        weakestSubcourseId: computedWeakestId,
        weakestSubcourseTitle: computedWeakestTitle,
        answers: { ...selectedAnswers }
      }

      setResult(quizResult)

      // If Final Quiz and failed, set 10-minute cooldown
      if (quizType === 'final' && !passed) {
        const cooldownTime = new Date(Date.now() + 10 * 60 * 1000).toISOString()
        setCooldownUntil(cooldownTime)
        setWeakestSubcourseId(computedWeakestId)
      }

      // Notify parent / persist to DB
      if (onComplete) {
        await onComplete(quizResult)
      }
    } catch (err) {
      console.error('Error completing quiz:', err)
      setValidationError('Terjadi kesalahan saat memproses jawaban kuis. Silakan coba lagi.')
    } finally {
      setSubmitting(false)
    }
  }

  // Retry quiz handler
  const handleRetry = useCallback(() => {
    setSelectedAnswers({})
    setResult(null)
    setValidationError(null)
  }, [])

  // Cooldown Lockout Screen (for Final Quiz)
  if (isCooldownActive) {
    return (
      <div className="card-brutal bg-white p-6 sm:p-8 space-y-6 shadow-brutal-lg max-w-2xl mx-auto border-2 border-black">
        <div className="flex items-center gap-3 border-b-2 border-black pb-4">
          <div className="w-12 h-12 rounded-xl bg-retro-pink text-white border-2 border-black flex items-center justify-center shadow-brutal-sm">
            <Clock className="w-6 h-6 stroke-[2.5] animate-pulse" />
          </div>
          <div>
            <span className="badge-brutal text-[10px] bg-retro-pink text-white font-mono">
              WAKTU JEDA (COOLDOWN) AKTIF
            </span>
            <h2 className="text-xl font-black text-black tracking-tight">{title}</h2>
          </div>
        </div>

        <div className="bg-[#FAF7EE] border-2 border-black rounded-xl p-6 text-center space-y-3 shadow-brutal-sm">
          <p className="text-xs font-mono font-bold text-neutral-600 uppercase tracking-wider">
            Sisa Waktu Sebelum Kamu Boleh Mengulang Kuis Akhir:
          </p>
          <div className="text-5xl font-mono font-black text-black tracking-widest bg-white border-2 border-black py-4 px-6 rounded-xl inline-block shadow-brutal-sm">
            {formattedCountdown}
          </div>
          <p className="text-xs text-neutral-600 font-medium max-w-md mx-auto">
            Kuis Akhir menguji pemahaman seluruh materi. Gunakan waktu 10 menit ini untuk meninjau kembali konsep coding yang belum kamu kuasai.
          </p>
        </div>

        {/* Weakest Sub-course Review Recommendation */}
        {weakestSubcourseId && (
          <div className="card-brutal bg-retro-yellow/30 border-2 border-black p-5 space-y-3 shadow-brutal-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-black stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider text-black">
                Rekomendasi Materi Untuk Dipelajari Ulang
              </span>
            </div>
            <p className="text-sm font-bold text-black">
              Berdasarkan jawaban kuis sebelumnya, kamu paling banyak salah pada materi:
            </p>
            <div className="bg-white border-2 border-black p-3 rounded-lg flex items-center justify-between gap-3">
              <span className="font-black text-black text-sm">{weakestSubcourseTitle}</span>
              <Link
                to={`/learn/${weakestSubcourseId}`}
                className="btn-brutal-yellow text-xs py-1.5 px-3 inline-flex items-center gap-1.5"
              >
                <span>Buka Materi</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link
            to={backToDashboardUrl}
            className="btn-brutal-white text-xs py-2 px-4 w-full sm:w-auto text-center"
          >
            Kembali ke Dashboard
          </Link>
          <button
            disabled
            className="btn-brutal-white text-xs py-2 px-4 w-full sm:w-auto opacity-50 cursor-not-allowed text-center"
          >
            Tunggu Cooldown Selesai ({formattedCountdown})
          </button>
        </div>
      </div>
    )
  }

  // Result View (After Submitting)
  if (result) {
    return (
      <div className="card-brutal bg-white p-6 sm:p-8 space-y-6 shadow-brutal-lg max-w-2xl mx-auto border-2 border-black">
        {/* Header Badge & Title */}
        <div className="flex items-center gap-3 border-b-2 border-black pb-4">
          <div
            className={`w-12 h-12 rounded-xl border-2 border-black flex items-center justify-center shadow-brutal-sm ${
              result.passed ? 'bg-retro-green text-black' : 'bg-retro-pink text-white'
            }`}
          >
            {result.passed ? (
              <Award className="w-7 h-7 stroke-[2.5]" />
            ) : (
              <XCircle className="w-7 h-7 stroke-[2.5]" />
            )}
          </div>
          <div>
            <span
              className={`badge-brutal text-[10px] font-mono ${
                result.passed ? 'bg-retro-green text-black' : 'bg-retro-pink text-white'
              }`}
            >
              {result.passed ? 'EVALUASI: LULUS' : 'EVALUASI: PERLU MENCOBA LAGI'}
            </span>
            <h2 className="text-xl font-black text-black tracking-tight">{title}</h2>
          </div>
        </div>

        {/* Score & Banner */}
        <div
          className={`card-brutal border-2 border-black p-6 text-center space-y-3 shadow-brutal-sm ${
            result.passed ? 'bg-[#D1FAE5]' : 'bg-[#FFE4E6]'
          }`}
        >
          <span className="text-xs font-mono font-bold uppercase tracking-wider text-black">
            Nilai Hasil Pengerjaan
          </span>
          <div className="text-5xl font-mono font-black text-black">
            {result.score}
            <span className="text-xl font-normal text-neutral-600"> / 100</span>
          </div>

          <p className="text-sm font-bold text-black max-w-md mx-auto">
            {result.passed
              ? `🎉 Hebat sekali! Kamu berhasil menjawab ${result.correctCount} dari ${result.totalQuestions} soal dengan benar (Batas lulus: ${passThreshold}%).`
              : `Ups! Kamu menjawab ${result.correctCount} dari ${result.totalQuestions} soal dengan benar. Kamu membutuhkan minimal nilai ${passThreshold}% untuk lulus.`}
          </p>
        </div>

        {/* Diagnostic Review Recommendation for Final Quiz Failure */}
        {quizType === 'final' && !result.passed && result.weakestSubcourseId && (
          <div className="card-brutal bg-retro-yellow/30 border-2 border-black p-5 space-y-3 shadow-brutal-sm">
            <div className="flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-black stroke-[2.5]" />
              <span className="text-xs font-black uppercase tracking-wider text-black">
                Materi Yang Perlu Kamu Pelajari Ulang
              </span>
            </div>
            <p className="text-xs text-neutral-700 font-medium">
              Kamu paling banyak mengalami kesulitan pada materi sub-kursus berikut:
            </p>
            <div className="bg-white border-2 border-black p-3.5 rounded-xl flex items-center justify-between gap-3">
              <div>
                <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase">
                  Rekomendasi Review
                </span>
                <p className="font-black text-sm text-black">{result.weakestSubcourseTitle}</p>
              </div>
              <Link
                to={`/learn/${result.weakestSubcourseId}`}
                className="btn-brutal-yellow text-xs py-2 px-3 inline-flex items-center gap-1.5"
              >
                <span>Pelajari Ulang</span>
                <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
            <p className="text-[11px] text-neutral-600 font-mono">
              ⚠️ Cooldown 10 menit diberlakukan untuk memberikan waktu belajar sebelum mencoba kembali.
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
          <Link
            to={backToDashboardUrl}
            className="btn-brutal-white text-xs py-2.5 px-4 w-full sm:w-auto text-center"
          >
            Kembali ke Dashboard
          </Link>

          {/* Sub Course Quiz: Immediate Retry on Failure */}
          {quizType === 'subcourse' && !result.passed && (
            <button
              onClick={handleRetry}
              className="btn-brutal-yellow text-xs py-2.5 px-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 font-black"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Coba Lagi Sekarang (Tanpa Cooldown)</span>
            </button>
          )}

          {/* Final Quiz: Locked if cooldown is active, or retry if expired */}
          {quizType === 'final' && !result.passed && (
            <button
              disabled={isCooldownActive}
              onClick={handleRetry}
              className={`text-xs py-2.5 px-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 font-black ${
                isCooldownActive
                  ? 'btn-brutal-white opacity-50 cursor-not-allowed'
                  : 'btn-brutal-yellow'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              <span>
                {isCooldownActive
                  ? `Terkunci Cooldown (${formattedCountdown})`
                  : 'Coba Lagi Kuis Akhir'}
              </span>
            </button>
          )}

          {/* If Passed: Continue action */}
          {result.passed && (
            <button
              onClick={() => {
                if (onContinueNext) {
                  onContinueNext()
                } else {
                  window.location.href = backToDashboardUrl
                }
              }}
              className="btn-brutal-green text-xs py-2.5 px-5 w-full sm:w-auto inline-flex items-center justify-center gap-2 font-black"
            >
              <span>Lanjut Belajar</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    )
  }

  // Active Quiz Form Screen
  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Quiz Header Card */}
      <div className="card-brutal bg-white p-6 sm:p-8 space-y-3 shadow-brutal border-2 border-black">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-retro-yellow text-black border-2 border-black flex items-center justify-center font-black shadow-brutal-sm">
            <HelpCircle className="w-5 h-5 stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-brutal text-[10px] bg-retro-yellow text-black font-mono">
                {quizType === 'subcourse' ? 'KUIS SUB-MATERI' : 'KUIS AKHIR KURSUS'}
              </span>
              <span className="badge-brutal text-[10px] bg-black text-white font-mono">
                BATAS LULUS: {passThreshold}%
              </span>
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight mt-1">
              {title}
            </h2>
          </div>
        </div>

        {subtitle && (
          <p className="text-xs sm:text-sm text-neutral-600 font-medium leading-relaxed">
            {subtitle}
          </p>
        )}

        <div className="pt-2 border-t-2 border-black/10 flex items-center justify-between text-xs font-mono font-bold text-neutral-600">
          <span>Total: {questions.length} Pertanyaan</span>
          <span>
            Dijawab: {Object.keys(selectedAnswers).length} / {questions.length}
          </span>
        </div>
      </div>

      {/* Validation Alert */}
      {validationError && (
        <div className="card-brutal bg-retro-pink text-white p-4 font-bold text-xs shadow-brutal flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Question Cards List */}
      <div className="space-y-6">
        {questions.map((q, qIndex) => {
          const isAnswered = Boolean(selectedAnswers[q.id])
          const selectedOption = selectedAnswers[q.id]

          return (
            <div
              key={q.id}
              className={`card-brutal bg-white p-6 sm:p-7 space-y-4 shadow-brutal border-2 border-black transition ${
                isAnswered ? 'ring-2 ring-retro-yellow/60' : ''
              }`}
            >
              {/* Question Header */}
              <div className="flex items-center justify-between gap-2 border-b-2 border-black/10 pb-3">
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-retro-yellow border-2 border-black font-mono font-black text-xs flex items-center justify-center text-black shadow-brutal-sm">
                    {qIndex + 1}
                  </span>
                  <span className="font-mono text-xs font-black uppercase text-neutral-500">
                    Soal {qIndex + 1} dari {questions.length}
                  </span>
                </div>

                {isAnswered ? (
                  <span className="badge-brutal text-[10px] bg-retro-green text-black font-mono flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 stroke-[3]" />
                    <span>Sudah Dipilih</span>
                  </span>
                ) : (
                  <span className="badge-brutal text-[10px] bg-neutral-200 text-neutral-600 font-mono">
                    Belum Dijawab
                  </span>
                )}
              </div>

              {/* Prompt */}
              <h3 className="text-base sm:text-lg font-black text-black leading-snug">
                {q.prompt}
              </h3>

              {/* Option Cards */}
              <div className="space-y-2.5 pt-1">
                {q.options.map((opt, optIndex) => {
                  const isSelected = selectedOption === opt
                  const optionLabel = String.fromCharCode(65 + optIndex) // A, B, C, D

                  return (
                    <button
                      key={optIndex}
                      type="button"
                      onClick={() => handleSelectOption(q.id, opt)}
                      className={`w-full text-left p-3.5 sm:p-4 rounded-xl border-2 border-black flex items-center gap-3.5 transition ${
                        isSelected
                          ? 'bg-retro-yellow text-black font-black shadow-brutal-sm scale-[1.01]'
                          : 'bg-[#FAF7EE] text-neutral-800 hover:bg-white hover:text-black'
                      }`}
                    >
                      {/* Option Alphabet Box */}
                      <span
                        className={`w-7 h-7 rounded-lg border-2 border-black font-mono font-black text-xs flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-black text-white' : 'bg-white text-black'
                        }`}
                      >
                        {optionLabel}
                      </span>

                      {/* Option Text */}
                      <span className="text-xs sm:text-sm font-bold flex-1 leading-relaxed">
                        {opt}
                      </span>

                      {/* Selection Indicator Circle */}
                      <div
                        className={`w-5 h-5 rounded-full border-2 border-black flex items-center justify-center shrink-0 ${
                          isSelected ? 'bg-black' : 'bg-white'
                        }`}
                      >
                        {isSelected && <div className="w-2 h-2 rounded-full bg-retro-yellow" />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

      {/* Submission Card */}
      <div className="card-brutal bg-white p-5 sm:p-6 shadow-brutal-sm flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-black sticky bottom-4 z-20">
        <div className="text-xs font-mono font-bold text-neutral-600">
          Pertanyaan Terjawab:{' '}
          <span className="text-black font-black">
            {Object.keys(selectedAnswers).length}
          </span>{' '}
          / {questions.length}
        </div>

        <button
          onClick={handleSubmit}
          disabled={submitting || questions.length === 0}
          className="btn-brutal-yellow text-xs py-3 px-6 w-full sm:w-auto inline-flex items-center justify-center gap-2 font-black shadow-brutal disabled:opacity-50"
        >
          {submitting ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>Memeriksa Jawaban...</span>
            </>
          ) : (
            <>
              <span>Kirim Jawaban & Periksa Nilai</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

