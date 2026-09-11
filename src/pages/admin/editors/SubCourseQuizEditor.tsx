import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  ArrowLeft,
  HelpCircle,
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
  Info
} from 'lucide-react'

interface QuestionItem {
  id?: string
  prompt: string
  options: string[]
  correct_answer: string
}

export default function SubCourseQuizEditor() {
  const { courseId, subcourseId } = useParams<{ courseId: string; subcourseId: string }>()

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [quizId, setQuizId] = useState<string | null>(null)
  const [activityId, setActivityId] = useState<string | null>(null)

  const [questions, setQuestions] = useState<QuestionItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Simulator / Preview State
  const [activeTab, setActiveTab] = useState<'edit' | 'simulator'>('edit')
  const [simAnswers, setSimAnswers] = useState<Record<number, string>>({})
  const [simSubmitted, setSimSubmitted] = useState(false)

  const fetchQuizData = useCallback(async () => {
    if (!supabase || !courseId || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch course & subcourse titles
      const { data: cData } = await supabase.from('courses').select('title').eq('id', courseId).single()
      if (cData) setCourseTitle(cData.title)

      const { data: scData } = await supabase.from('sub_courses').select('title').eq('id', subcourseId).single()
      if (scData) setSubCourseTitle(scData.title)

      // 2. Fetch or create sub_course_quiz record
      let currentQuizId: string | null = null
      const { data: qData, error: qErr } = await supabase
        .from('sub_course_quizzes')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .maybeSingle()

      if (qErr) throw qErr

      if (qData) {
        currentQuizId = qData.id
        setQuizId(qData.id)
      }

      // 3. Fetch activity record if exists
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .eq('type', 'quiz')
        .maybeSingle()

      if (actData) {
        setActivityId(actData.id)
      }

      // 4. If quiz exists, fetch its questions
      if (currentQuizId) {
        const { data: questionsData, error: questionsErr } = await supabase
          .from('questions')
          .select('*')
          .eq('sub_course_quiz_id', currentQuizId)
          .order('created_at', { ascending: true })

        if (questionsErr) throw questionsErr

        if (questionsData && questionsData.length > 0) {
          setQuestions(
            questionsData.map((q) => ({
              id: q.id,
              prompt: q.prompt,
              options: Array.isArray(q.options) ? q.options : [],
              correct_answer: q.correct_answer
            }))
          )
        } else {
          // Initialize with 1 empty question template
          setQuestions([
            {
              prompt: 'Apa fungsi utama dari sebuah variabel dalam pemrograman?',
              options: [
                'Menyimpan nilai atau data agar bisa digunakan kembali',
                'Mengubah warna tampilan layar monitor komputer',
                'Mematikan program secara otomatis saat terjadi kesalahan',
                'Mempercepat koneksi internet pada perangkat'
              ],
              correct_answer: 'Menyimpan nilai atau data agar bisa digunakan kembali'
            }
          ])
        }
      } else {
        // Initialize default sample question
        setQuestions([
          {
            prompt: 'Apa fungsi utama dari sebuah variabel dalam pemrograman?',
            options: [
              'Menyimpan nilai atau data agar bisa digunakan kembali',
              'Mengubah warna tampilan layar monitor komputer',
              'Mematikan program secara otomatis saat terjadi kesalahan',
              'Mempercepat koneksi internet pada perangkat'
            ],
            correct_answer: 'Menyimpan nilai atau data agar bisa digunakan kembali'
          }
        ])
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat data kuis sub-materi.')
    } finally {
      setLoading(false)
    }
  }, [courseId, subcourseId])

  useEffect(() => {
    fetchQuizData()
  }, [fetchQuizData])

  // Question Management Helpers
  const addQuestion = () => {
    setQuestions([
      ...questions,
      {
        prompt: '',
        options: ['', '', '', ''],
        correct_answer: ''
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

  const updateOptionText = (qIndex: number, optIndex: number, text: string) => {
    const updated = [...questions]
    const oldVal = updated[qIndex].options[optIndex]
    updated[qIndex].options[optIndex] = text

    // If this option was selected as correct, update correct_answer reference
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

  // Save Quiz & Questions to Supabase
  const handleSave = async () => {
    if (!supabase || !subcourseId) return
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      // 1. Validation
      if (questions.length === 0) {
        throw new Error('Kuis harus memiliki minimal 1 soal pertanyaan.')
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
      }

      // 2. Ensure sub_course_quizzes entry exists
      let targetQuizId = quizId
      if (!targetQuizId) {
        const { data: newQuiz, error: insertQuizErr } = await supabase
          .from('sub_course_quizzes')
          .insert({
            subcourse_id: subcourseId,
            title: `Kuis Sub-Materi: ${subCourseTitle || 'Sub-Materi'}`
          })
          .select()
          .single()

        if (insertQuizErr) throw insertQuizErr
        targetQuizId = newQuiz.id
        setQuizId(newQuiz.id)
      } else {
        await supabase
          .from('sub_course_quizzes')
          .update({
            title: `Kuis Sub-Materi: ${subCourseTitle || 'Sub-Materi'}`
          })
          .eq('id', targetQuizId)
      }

      // 3. Upsert activities table slot (Slot #5: quiz)
      const activityPayload = {
        subcourse_id: subcourseId,
        type: 'quiz',
        order: 5,
        content_ref: {
          sub_course_quiz_id: targetQuizId,
          passing_score: 70,
          question_count: questions.length,
          title: `Kuis Sub-Materi: ${subCourseTitle || 'Sub-Materi'}`
        }
      }

      if (activityId) {
        const { error: actUpdateErr } = await supabase
          .from('activities')
          .update(activityPayload)
          .eq('id', activityId)

        if (actUpdateErr) throw actUpdateErr
      } else {
        const { data: newAct, error: actInsertErr } = await supabase
          .from('activities')
          .insert(activityPayload)
          .select()
          .single()

        if (actInsertErr) throw actInsertErr
        setActivityId(newAct.id)
      }

      // 4. Sync questions (Delete existing questions for this quiz and re-insert)
      const { error: deleteOldErr } = await supabase
        .from('questions')
        .delete()
        .eq('sub_course_quiz_id', targetQuizId)

      if (deleteOldErr) throw deleteOldErr

      const questionsToInsert = questions.map((q) => ({
        sub_course_quiz_id: targetQuizId,
        final_quiz_id: null,
        prompt: q.prompt.trim(),
        options: q.options.map((o) => o.trim()).filter((o) => o.length > 0),
        correct_answer: q.correct_answer.trim(),
        subcourse_id_tag: null
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
            correct_answer: q.correct_answer
          }))
        )
      }

      setSuccessMessage('Kuis sub-materi dan seluruh butir soal berhasil disimpan!')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan kuis.')
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

  const score = calculateScore()
  const hasPassed = score >= 70

  if (loading) {
    return (
      <div className="card-brutal bg-white p-12 text-center font-bold text-neutral-600">
        <Sparkles className="w-8 h-8 animate-spin mx-auto text-retro-yellow mb-2" />
        Memuat data editor kuis...
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
              Simulator Uji Coba Siswa
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-brutal-yellow text-xs py-2 px-4 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Kuis'}</span>
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
          <span className="badge-brutal bg-retro-yellow text-black font-black">
            AKTIVITAS #5 (SUB-COURSE QUIZ)
          </span>
          <span className="badge-brutal bg-black text-white">{courseTitle || 'Kursus'}</span>
          <span className="text-black font-bold">» {subCourseTitle || 'Sub-Materi'}</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-1">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight flex items-center gap-2.5">
              <HelpCircle className="w-7 h-7 text-retro-pink" />
              Kuis Evaluasi Sub-Materi
            </h1>
            <p className="text-xs text-neutral-600 font-medium mt-1 max-w-2xl">
              Sesuai PRD Section 3 & 4: Kuis pilihan ganda untuk menguji pemahaman siswa. Siswa harus memperoleh skor minimal 70% untuk lulus dan membuka sub-materi berikutnya.
            </p>
          </div>

          <div className="bg-[#FAF7EE] border-2 border-black p-3 rounded-xl flex items-center gap-3 self-start sm:self-auto">
            <Award className="w-6 h-6 text-retro-green flex-shrink-0" />
            <div>
              <p className="text-[10px] font-black uppercase text-neutral-500">Ambang Kelulusan (PRD)</p>
              <p className="text-sm font-black text-black font-mono">Skor Min: 70%</p>
            </div>
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
                Daftar Butir Soal ({questions.length} Pertanyaan)
              </h2>
            </div>

            <button
              onClick={addQuestion}
              className="btn-brutal-black text-xs py-2 px-3.5 inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4 text-retro-yellow" />
              <span>Tambah Pertanyaan Baru</span>
            </button>
          </div>

          {questions.map((q, qIdx) => (
            <div key={qIdx} className="card-brutal bg-white p-6 space-y-4">
              {/* Question Card Header */}
              <div className="flex items-center justify-between border-b-2 border-black pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 rounded-lg bg-retro-yellow border-2 border-black flex items-center justify-center font-mono font-black text-xs shadow-brutal-sm">
                    {qIdx + 1}
                  </div>
                  <span className="font-black text-sm text-black">Pertanyaan #{qIdx + 1}</span>
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

              {/* Question Prompt */}
              <div>
                <label className="block text-xs font-black text-black uppercase tracking-wider mb-1.5">
                  Teks Pertanyaan / Soal *
                </label>
                <textarea
                  rows={2}
                  value={q.prompt}
                  onChange={(e) => updateQuestionPrompt(qIdx, e.target.value)}
                  placeholder="Ketikkan teks soal di sini... (contoh: Nilai apa yang dihasilkan dari kode berikut?)"
                  className="input-brutal font-medium text-sm leading-relaxed"
                />
              </div>

              {/* Options Section */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="block text-xs font-black text-black uppercase tracking-wider">
                    Pilihan Jawaban (Klik Radio Button untuk Menentukan Kunci Jawaban Benar) *
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
                        {/* Radio selection for correct answer */}
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
          ))}

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
              <span>{saving ? 'Menyimpan...' : 'Simpan Kuis Sub-Materi'}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Simulator / Test Mode */
        <div className="card-brutal bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-black pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Play className="w-5 h-5 text-retro-green" />
                <h2 className="text-xl font-black text-black">Simulator Kuis Siswa</h2>
              </div>
              <p className="text-xs text-neutral-600 mt-1">
                Uji coba kuis ini secara interaktif layaknya tampilan siswa untuk memastikan seluruh pertanyaan jelas dan kunci jawaban tepat.
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
                      {hasPassed ? 'LULUS KUIS!' : 'BELUM LULUS'}
                    </h3>
                    <p className="text-xs font-semibold opacity-90">
                      {hasPassed
                        ? 'Siswa berhasil mencapai ambang batas kelulusan 70% dan dapat membuka sub-materi berikutnya.'
                        : 'Siswa belum mencapai skor 70% dan harus meninjau ulang materi sebelum mencoba lagi.'}
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <div className="font-mono font-black text-4xl">{score}%</div>
                  <div className="text-[11px] font-bold uppercase tracking-wider">
                    Target: 70%
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Simulator Questions */}
          <div className="space-y-6">
            {questions.map((q, qIdx) => {
              const selectedAnswer = simAnswers[qIdx]
              const isCorrectAnswer = selectedAnswer === q.correct_answer

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
                  <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-md bg-black text-white font-mono font-black text-xs flex items-center justify-center flex-shrink-0 mt-0.5">
                      {qIdx + 1}
                    </span>
                    <p className="font-bold text-sm text-black leading-snug">{q.prompt}</p>
                  </div>

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
                <span>Kumpulkan & Periksa Jawaban</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
