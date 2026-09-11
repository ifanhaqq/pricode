import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Check,
  Sparkles,
  Award,
  Layers,
  Info,
  Tag,
  AlertTriangle
} from 'lucide-react'

interface SubCourseOption {
  id: string
  title: string
  order: number
}

interface QuestionItem {
  id?: string
  prompt: string
  options: string[]
  correct_answer: string
  subcourse_id_tag: string
}

export default function FinalQuizEditor() {
  const { courseId } = useParams<{ courseId: string }>()

  const [courseTitle, setCourseTitle] = useState('')
  const [subcourses, setSubcourses] = useState<SubCourseOption[]>([])
  const [quizId, setQuizId] = useState<string | null>(null)

  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Simulator / Preview State
  const [activeTab, setActiveTab] = useState<'edit' | 'simulator'>('edit')
  const [simAnswers, setSimAnswers] = useState<Record<number, string>>({})
  const [simSubmitted, setSimSubmitted] = useState(false)

  const fetchFinalQuizData = useCallback(async () => {
    if (!supabase || !courseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch course details
      const { data: cData, error: cErr } = await supabase
        .from('courses')
        .select('title')
        .eq('id', courseId)
        .single()

      if (cErr) throw cErr
      if (cData) setCourseTitle(cData.title)

      // 2. Fetch all subcourses belonging to this course (for tagging questions)
      const { data: scData, error: scErr } = await supabase
        .from('sub_courses')
        .select('id, title, order')
        .eq('course_id', courseId)
        .order('order', { ascending: true })

      if (scErr) throw scErr
      const loadedSubcourses = scData || []
      setSubcourses(loadedSubcourses)

      // 3. Fetch or create final_quizzes record
      let currentQuizId: string | null = null
      const { data: qData, error: qErr } = await supabase
        .from('final_quizzes')
        .select('*')
        .eq('course_id', courseId)
        .maybeSingle()

      if (qErr) throw qErr

      if (qData) {
        currentQuizId = qData.id
        setQuizId(qData.id)
      }

      // 4. If final quiz exists, fetch its questions
      if (currentQuizId) {
        const { data: questionsData, error: questionsErr } = await supabase
          .from('questions')
          .select('*')
          .eq('final_quiz_id', currentQuizId)
          .order('created_at', { ascending: true })

        if (questionsErr) throw questionsErr

        if (questionsData && questionsData.length > 0) {
          setQuestions(
            questionsData.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer,
              subcourse_id_tag: q.subcourse_id_tag || ''
            }))
          )
        } else {
          // Initialize with 1 template question tagged to first subcourse if available
          setQuestions([
            {
              prompt: 'Dalam sebuah program, kita membuat variabel nama = "Budi". Apakah tipe data dari variabel tersebut?',
              options: ['String (Teks)', 'Integer (Angka Bulat)', 'Boolean (Benar / Salah)', 'Array (Daftar)'],
              correct_answer: 'String (Teks)',
              subcourse_id_tag: loadedSubcourses.length > 0 ? loadedSubcourses[0].id : ''
            }
          ])
        }
      } else {
        // Initialize default sample question
        setQuestions([
          {
            prompt: 'Dalam sebuah program, kita membuat variabel nama = "Budi". Apakah tipe data dari variabel tersebut?',
            options: ['String (Teks)', 'Integer (Angka Bulat)', 'Boolean (Benar / Salah)', 'Array (Daftar)'],
            correct_answer: 'String (Teks)',
            subcourse_id_tag: loadedSubcourses.length > 0 ? loadedSubcourses[0].id : ''
          }
        ])
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat data kuis akhir kursus.')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchFinalQuizData()
  }, [fetchFinalQuizData])

  // Question Management Helpers
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        prompt: '',
        options: ['', '', '', ''],
        correct_answer: '',
        subcourse_id_tag: subcourses.length > 0 ? subcourses[0].id : ''
      }
    ])
  }

  const removeQuestion = (qIndex: number) => {
    setQuestions(questions.filter((_, idx) => idx !== qIndex))
  }

  const updateQuestionPrompt = (qIndex: number, prompt: string) => {
    const updated = [...questions]
    updated[qIndex].prompt = prompt
    setQuestions(updated)
  }

  const updateSubcourseTag = (qIndex: number, subcourseIdTag: string) => {
    const updated = [...questions]
    updated[qIndex].subcourse_id_tag = subcourseIdTag
    setQuestions(updated)
  }

  const updateOptionText = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions]
    const oldVal = updated[qIndex].options[optIndex]
    updated[qIndex].options[optIndex] = text

    if (updated[qIndex].correct_answer === oldVal) {
      updated[qIndex].correct_answer = text
    }

    setQuestions(updated)
  }

  const setCorrectOption = (qIndex: number, optionText: string) => {
    const updated = [...questions]
    updated[qIndex].correct_answer = optionText
    setQuestions(updated)
  }

  const addOptionToQuestion = (qIndex: number) => {
    const updated = [...questions]
    if (updated[qIndex].options.length < 6) {
      updated[qIndex].options.push('')
      setQuestions(updated)
    }
  }

  const removeOptionFromQuestion = (qIndex: number, optIndex: number) => {
    const updated = [...questions]
    const removedVal = updated[qIndex].options[optIndex]
    updated[qIndex].options = updated[qIndex].options.filter((_, idx) => idx !== optIndex)

    if (updated[qIndex].correct_answer === removedVal) {
      updated[qIndex].correct_answer = updated[qIndex].options[0] || ''
    }

    setQuestions(updated)
  }

  // Save Final Quiz & Questions to Supabase
  const handleSave = async () => {
    if (!supabase || !courseId) return
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      // 1. Validation
      if (questions.length === 0) {
        throw new Error('Kuis akhir harus memiliki minimal 1 butir pertanyaan.')
      }

      for (let i = 0; i < questions.length; i++) {
        const q = questions[i]
        if (!q.prompt.trim()) {
          throw new Error(`Soal nomor ${i + 1} belum memiliki teks pertanyaan.`)
        }
        const validOptions = q.options.filter((o) => o.trim().length > 0)
        if (validOptions.length < 2) {
          throw new Error(`Soal nomor ${i + 1} harus memiliki minimal 2 pilihan jawaban.`)
        }
        if (!q.correct_answer.trim() || !validOptions.includes(q.correct_answer.trim())) {
          throw new Error(`Soal nomor ${i + 1} belum menentukan kunci jawaban yang benar.`)
        }
        // PRD Section 3.2 mandatory requirement:
        if (!q.subcourse_id_tag) {
          throw new Error(
            `Soal nomor ${i + 1} wajib ditandai (tag) ke salah satu Sub-Materi untuk mendukung fitur analisis remediasi otomatis (PRD 3.2).`
          )
        }
      }

      // 2. Ensure final_quizzes entry exists
      let targetQuizId = quizId
      if (!targetQuizId) {
        const { data: newQuiz, error: insertQuizErr } = await supabase
          .from('final_quizzes')
          .insert({
            course_id: courseId,
            title: `Kuis Akhir: ${courseTitle || 'Kursus'}`
          })
          .select()
          .single()

        if (insertQuizErr) throw insertQuizErr
        targetQuizId = newQuiz.id
        setQuizId(newQuiz.id)
      } else {
        await supabase
          .from('final_quizzes')
          .update({
            title: `Kuis Akhir: ${courseTitle || 'Kursus'}`
          })
          .eq('id', targetQuizId)
      }

      // 3. Sync questions (Delete existing questions for this final quiz and re-insert)
      const { error: deleteOldErr } = await supabase
        .from('questions')
        .delete()
        .eq('final_quiz_id', targetQuizId)

      if (deleteOldErr) throw deleteOldErr

      const questionsToInsert = questions.map((q) => ({
        final_quiz_id: targetQuizId,
        sub_course_quiz_id: null,
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
        correct_answer: q.correct_answer.trim(),
        subcourse_id_tag: q.subcourse_id_tag
      }))

      const { data: insertedQuestions, error: insertQErr } = await supabase
        .from('questions')
        .insert(questionsToInsert)
        .select()

      if (insertQErr) throw insertQErr

      if (insertedQuestions) {
        setQuestions(
          insertedQuestions.map((q) => ({
            id: q.id,
            prompt: q.prompt,
            options: Array.isArray(q.options) ? q.options : [],
            correct_answer: q.correct_answer,
            subcourse_id_tag: q.subcourse_id_tag || ''
          }))
        )
      }

      setSuccessMessage('Kuis akhir kursus dan pemetaan tag remediasi berhasil disimpan!')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan kuis akhir.')
    } finally {
      setSaving(false)
    }
  }

  // Simulator Logic
  const handleSimSelect = (qIdx: number, option: string) => {
    if (simSubmitted) return
    setSimAnswers((prev) => ({ ...prev, [qIdx]: option }))
  }

  const handleSimSubmit = () => {
    setSimSubmitted(true)
  }

  const handleSimReset = () => {
    setSimAnswers({})
    setSimSubmitted(false)
  }

  const calculateScore = () => {
    if (questions.length === 0) return 0
    let correctCount = 0
    questions.forEach((q, idx) => {
      if (simAnswers[idx] === q.correct_answer) {
        correctCount++
      }
    })
    return Math.round((correctCount / questions.length) * 100)
  }

  // PRD 3.2 Remediation Analysis: identify the subcourse with highest count of mistakes
  const getRemediationAnalysis = () => {
    const errorCountBySubcourse: Record<string, number> = {}

    questions.forEach((q, idx) => {
      if (simAnswers[idx] !== q.correct_answer && q.subcourse_id_tag) {
        errorCountBySubcourse[q.subcourse_id_tag] =
          (errorCountBySubcourse[q.subcourse_id_tag] || 0) + 1
      }
    })

    let worstSubcourseId: string | null = null
    let maxErrors = 0

    Object.entries(errorCountBySubcourse).forEach(([scId, count]) => {
      if (count > maxErrors) {
        maxErrors = count
        worstSubcourseId = scId
      }
    })

    const worstSubcourse = subcourses.find((s) => s.id === worstSubcourseId)

    return {
      hasErrors: maxErrors > 0,
      worstSubcourse,
      maxErrors,
      errorCountBySubcourse
    }
  }

  const score = calculateScore()
  const hasPassed = score >= 80 // PRD standard for final quiz
  const remediation = getRemediationAnalysis()

  if (loading) {
    return (
      <div className="card-brutal bg-white p-12 text-center font-bold text-neutral-600">
        <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow mb-2" />
        Memuat editor kuis akhir kursus...
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* Top Header & Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={`/admin/courses/${courseId}`}
          className="btn-brutal-white text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke Detail Kursus</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white border-2 border-black rounded-lg p-1 shadow-brutal-sm">
            <button
              onClick={() => setActiveTab('edit')}
              className={`px-3 py-1.5 rounded text-xs font-bold transition ${
                activeTab === 'edit'
                  ? 'bg-retro-yellow text-black border-2 border-black'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              Mode Penulisan Soal
            </button>
            <button
              onClick={() => {
                setActiveTab('simulator')
                handleSimReset()
              }}
              className={`px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-1.5 ${
                activeTab === 'simulator'
                  ? 'bg-retro-green text-black border-2 border-black'
                  : 'text-neutral-600 hover:text-black'
              }`}
            >
              <Play className="w-3.5 h-3.5" />
              Simulator Uji Coba & Remediasi
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-brutal-yellow text-xs py-2 px-4 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Kuis Akhir'}</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {successMessage && (
        <div className="card-brutal bg-retro-green p-4 flex items-center justify-between gap-3 text-black font-semibold text-sm">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5" />
            <span>{successMessage}</span>
          </div>
          <button onClick={() => setSuccessMessage(null)} className="p-1 hover:bg-black/10 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="card-brutal bg-retro-pink p-4 flex items-center justify-between gap-3 text-white font-semibold text-sm">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-white" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="p-1 hover:bg-white/20 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Course Context Header */}
      <div className="card-brutal bg-white p-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2 font-mono text-xs text-neutral-600">
          <span className="badge-brutal bg-retro-lavender text-black font-black">
            KUIS AKHIR KURSUS (FINAL QUIZ)
          </span>
          <span className="badge-brutal bg-black text-white">{courseTitle || 'Kursus'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2.5">
              <Award className="w-7 h-7 text-retro-yellow" />
              Kuis Evaluasi Akhir Kursus (Final Quiz)
            </h1>
            <p className="text-xs text-neutral-700 font-medium mt-1 max-w-2xl leading-relaxed">
              Materi kuis komprehensif yang menguji seluruh capaian kompetensi kursus. Setiap soal <strong>wajib ditautkan (tag) ke sub-materi</strong> terkait untuk mengaktifkan algoritma remediasi otomatis siswa (PRD Section 3.2).
            </p>
          </div>

          <div className="bg-[#FAF7EE] border-2 border-black p-3 rounded-xl flex items-center gap-3 self-start sm:self-auto">
            <Award className="w-6 h-6 text-retro-green flex-shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-500">Standar Kelulusan</p>
              <p className="text-sm font-black text-black font-mono">Skor Min: 80%</p>
            </div>
          </div>
        </div>

        {/* PRD Alert Box */}
        <div className="bg-[#FAF7EE] border-2 border-black p-3.5 rounded-xl flex items-start gap-3 mt-3">
          <Info className="w-5 h-5 text-retro-lavender flex-shrink-0 mt-0.5" />
          <div className="text-xs text-neutral-800 space-y-1">
            <p className="font-bold">Persyaratan PRD Section 3.2 (Remediation Tagging):</p>
            <p className="leading-relaxed">
              Saat siswa belum mencapai skor kelulusan, sistem PRICODE otomatis menghitung sub-materi mana yang memiliki frekuensi kesalahan tertinggi dan menyarankan siswa mempelajari ulang sub-materi tersebut.
            </p>
          </div>
        </div>
      </div>

      {activeTab === 'edit' ? (
        /* Edit Mode */
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-black" />
              <h2 className="text-lg font-black text-black">
                Daftar Soal Kuis Akhir ({questions.length} Butir Soal)
              </h2>
            </div>

            <button
              onClick={addQuestion}
              className="btn-brutal-black text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-retro-yellow" />
              <span>Tambah Soal Kuis Akhir</span>
            </button>
          </div>

          {subcourses.length === 0 && (
            <div className="card-brutal bg-retro-pink p-4 text-white text-xs font-bold flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 flex-shrink-0" />
              <span>
                Kursus ini belum memiliki sub-materi. Harap tambahkan sub-materi terlebih dahulu agar soal kuis akhir dapat ditautkan (tag) ke sub-materi yang bersangkutan.
              </span>
            </div>
          )}

          {questions.map((q, qIdx) => {
            const hasValidTag = Boolean(q.subcourse_id_tag)

            return (
              <div key={qIdx} className="card-brutal bg-white p-6 space-y-4">
                {/* Question Card Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b-2 border-black pb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-retro-lavender border-2 border-black flex items-center justify-center font-mono font-black text-xs shadow-brutal-sm">
                      {qIdx + 1}
                    </div>
                    <span className="font-black text-sm text-black">Soal Final #{qIdx + 1}</span>
                  </div>

                  <div className="flex items-center gap-3">
                    {/* PRD Subcourse Tag Selector */}
                    <div className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-neutral-600" />
                      <label className="text-[11px] font-black uppercase text-neutral-700">
                        Tag Sub-Materi *:
                      </label>
                      <select
                        value={q.subcourse_id_tag}
                        onChange={(e) => updateSubcourseTag(qIdx, e.target.value)}
                        className={`text-xs font-bold border-2 rounded-lg py-1 px-2.5 transition ${
                          hasValidTag
                            ? 'border-black bg-retro-yellow/30 text-black'
                            : 'border-retro-pink bg-retro-pink/10 text-rose-700 animate-pulse'
                        }`}
                      >
                        <option value="">-- Pilih Sub-Materi (Wajib) --</option>
                        {subcourses.map((sc) => (
                          <option key={sc.id} value={sc.id}>
                            Sub-Materi #{sc.order}: {sc.title}
                          </option>
                        ))}
                      </select>
                    </div>

                    {questions.length > 1 && (
                      <button
                        onClick={() => removeQuestion(qIdx)}
                        className="p-1.5 border-2 border-black rounded-lg hover:bg-retro-pink hover:text-white transition"
                        title="Hapus soal ini"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {!hasValidTag && (
                  <div className="bg-rose-50 border-2 border-rose-300 p-2.5 rounded-lg flex items-center gap-2 text-rose-800 text-xs font-bold">
                    <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                    <span>Wajib memilih tag sub-materi untuk mendukung penelusuran remediasi PRD 3.2.</span>
                  </div>
                )}

                {/* Question Prompt */}
                <div>
                  <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                    Teks Pertanyaan / Soal *
                  </label>
                  <textarea
                    rows={2}
                    value={q.prompt}
                    onChange={(e) => updateQuestionPrompt(qIdx, e.target.value)}
                    placeholder="Ketikkan teks soal kuis akhir di sini..."
                    className="input-brutal font-medium text-sm leading-relaxed"
                  />
                </div>

                {/* Options Section */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-black text-black uppercase tracking-wider">
                      Pilihan Jawaban (Klik Radio Button untuk Menandai Kunci Jawaban yang Benar) *
                    </label>
                    {q.options.length < 6 && (
                      <button
                        type="button"
                        onClick={() => addOptionToQuestion(qIdx)}
                        className="text-[11px] font-bold text-neutral-700 hover:text-black flex items-center gap-1 underline"
                      >
                        <Plus className="w-3 h-3" /> Tambah Pilihan
                      </button>
                    )}
                  </div>

                  <div className="space-y-2.5">
                    {q.options.map((opt, optIdx) => {
                      const optLetter = String.fromCharCode(65 + optIdx)
                      const isCorrect = q.correct_answer === opt && opt.trim().length > 0

                      return (
                        <div
                          key={optIdx}
                          className={`flex items-center gap-2 p-2 rounded-xl border-2 transition ${
                            isCorrect
                              ? 'border-black bg-retro-green/20'
                              : 'border-black/20 bg-[#FAF7EE]'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => setCorrectOption(qIdx, opt)}
                            title="Tandai sebagai kunci jawaban benar"
                            className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition flex-shrink-0 ${
                              isCorrect ? 'bg-retro-green' : 'bg-white hover:bg-neutral-200'
                            }`}
                          >
                            {isCorrect && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                          </button>

                          <span className="font-mono font-black text-xs w-5 text-neutral-700">
                            {optLetter}.
                          </span>

                          <input
                            type="text"
                            value={opt}
                            onChange={(e) => updateOptionText(qIdx, optIdx, e.target.value)}
                            placeholder={`Teks pilihan jawaban ${optLetter}`}
                            className="input-brutal py-1.5 text-xs flex-1 bg-white"
                          />

                          {isCorrect && (
                            <span className="badge-brutal text-[10px] bg-retro-green text-black font-black hidden sm:inline-flex">
                              KUNCI JAWABAN
                            </span>
                          )}

                          {q.options.length > 2 && (
                            <button
                              type="button"
                              onClick={() => removeOptionFromQuestion(qIdx, optIdx)}
                              className="p-1 text-neutral-400 hover:text-retro-pink"
                              title="Hapus opsi"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          })}

          {/* Bottom Action Bar */}
          <div className="flex items-center justify-between pt-4 border-t-2 border-black">
            <button
              onClick={addQuestion}
              className="btn-brutal-white text-xs py-2 px-4 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" />
              <span>Tambah Soal Baru</span>
            </button>

            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-brutal-yellow text-xs py-2 px-6 inline-flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Menyimpan...' : 'Simpan Kuis Akhir Kursus'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Simulator / Remediation Test Mode */
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-retro-green" />
                <h2 className="text-xl font-black text-black">Simulator Kuis Akhir & Uji Remediasi</h2>
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                Uji coba simulasi kuis akhir ini. Jika skor di bawah 80%, sistem akan menguji kalkulasi penentuan sub-materi terlemah siswa sesuai PRD 3.2.
              </p>
            </div>

            <button
              onClick={handleSimReset}
              className="btn-brutal-white text-xs py-1.5 px-3 inline-flex items-center gap-1 self-start"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Uji Coba</span>
            </button>
          </div>

          {/* Simulator Result Banner */}
          {simSubmitted && (
            <div className="space-y-4">
              <div
                className={`card-brutal p-6 space-y-3 ${
                  hasPassed ? 'bg-retro-green text-black' : 'bg-retro-pink text-white'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Award className="w-8 h-8 stroke-[2.5]" />
                    <div>
                      <h3 className="text-2xl font-black tracking-tight">
                        {hasPassed ? 'LULUS KURSUS!' : 'BELUM MENCAPAI STANDAR KELULUSAN'}
                      </h3>
                      <p className="text-xs font-semibold opacity-90">
                        {hasPassed
                          ? 'Selamat! Siswa berhasil menyelesaikan kuis akhir dengan skor minimal 80% dan menuntaskan kursus.'
                          : 'Siswa memperoleh skor di bawah 80%. Sistem otomatis mengaktifkan fitur remediasi terfokus.'}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-mono font-black text-4xl">{score}%</div>
                    <div className="text-[11px] font-bold uppercase tracking-wider">
                      Standar: 80%
                    </div>
                  </div>
                </div>
              </div>

              {/* PRD 3.2 Automatic Remediation Diagnosis Card */}
              {!hasPassed && (
                <div className="card-brutal bg-[#FAF7EE] p-5 space-y-3 border-2 border-black">
                  <div className="flex items-center gap-2 text-black font-black text-sm">
                    <Sparkles className="w-5 h-5 text-retro-pink" />
                    <span>HASIL ANALISIS REMEDIASI OTOMATIS (PRD 3.2)</span>
                  </div>

                  {remediation.worstSubcourse ? (
                    <div className="p-4 bg-white rounded-xl border-2 border-black space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="badge-brutal bg-retro-pink text-white font-black text-xs">
                          SUB-MATERI TERLEMAH
                        </span>
                        <h4 className="font-black text-base text-black">
                          {remediation.worstSubcourse.title}
                        </h4>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed font-medium">
                        Siswa melakukan <strong>{remediation.maxErrors} kesalahan</strong> pada soal terkait materi <strong>"{remediation.worstSubcourse.title}"</strong>.
                        Sistem akan merekomendasikan siswa untuk meninjau kembali aktivitas pada sub-materi ini sebelum mencoba kembali kuis akhir.
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-neutral-600">
                      Tidak ada kesalahan terdeteksi atau soal belum memiliki tag sub-materi.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Simulator Questions */}
          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const selectedAnswer = simAnswers[qIdx]
              const isCorrectAnswer = selectedAnswer === q.correct_answer
              const taggedSubcourse = subcourses.find((s) => s.id === q.subcourse_id_tag)

              return (
                <div
                  key={qIdx}
                  className={`p-5 rounded-2xl border-2 border-black space-y-3 ${
                    simSubmitted
                      ? isCorrectAnswer
                        ? 'bg-retro-green/10'
                        : 'bg-retro-pink/10'
                      : 'bg-[#FAF7EE]'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-black/10 pb-2">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-md bg-black text-white font-mono font-black text-xs flex items-center justify-center flex-shrink-0">
                        {qIdx + 1}
                      </span>
                      <span className="font-bold text-xs text-neutral-600 font-mono">
                        Soal #{qIdx + 1}
                      </span>
                    </div>

                    {taggedSubcourse && (
                      <span className="badge-brutal bg-retro-yellow text-black text-[10px] self-start sm:self-auto font-bold">
                        Tag: {taggedSubcourse.title}
                      </span>
                    )}
                  </div>

                  <p className="font-bold text-sm text-black leading-snug">{q.prompt}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2">
                    {q.options.map((opt, optIdx) => {
                      const optLetter = String.fromCharCode(65 + optIdx)
                      const isSelected = selectedAnswer === opt
                      const isOptionTheCorrectKey = opt === q.correct_answer

                      let btnStyle = 'bg-white border-black hover:bg-neutral-100 text-black'
                      if (isSelected) {
                        btnStyle = 'bg-black text-white border-black'
                      }
                      if (simSubmitted) {
                        if (isOptionTheCorrectKey) {
                          btnStyle = 'bg-retro-green text-black border-black font-black'
                        } else if (isSelected && !isOptionTheCorrectKey) {
                          btnStyle = 'bg-retro-pink text-white border-black'
                        }
                      }

                      return (
                        <button
                          key={optIdx}
                          type="button"
                          onClick={() => handleSimSelect(qIdx, opt)}
                          disabled={simSubmitted}
                          className={`p-3 rounded-xl border-2 text-left text-xs font-semibold transition flex items-center gap-2.5 ${btnStyle}`}
                        >
                          <span className="font-mono font-black text-xs opacity-75">
                            {optLetter}.
                          </span>
                          <span className="flex-1">{opt}</span>
                        </button>
                      )
                    })}
                  </div>

                  {simSubmitted && !isCorrectAnswer && (
                    <div className="pt-2 text-xs font-bold text-neutral-800 flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-retro-pink" />
                      <span>Kunci Jawaban yang Benar: <strong>{q.correct_answer}</strong></span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {!simSubmitted && (
            <div className="pt-4 border-t-2 border-black flex justify-end">
              <button
                type="button"
                onClick={handleSimSubmit}
                disabled={Object.keys(simAnswers).length === 0}
                className="btn-brutal-green text-xs py-2.5 px-6 inline-flex items-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Kumpulkan & Evaluasi Kuis Akhir</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
