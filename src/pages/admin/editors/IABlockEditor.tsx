import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
  Play,
  RotateCcw,
  Code,
  Check
} from 'lucide-react'

interface BlockItem {
  id?: string
  label: string
  role: 'correct' | 'distractor'
  correct_order: number | null
}

export default function IABlockEditor() {
  const { courseId, subcourseId, activityType } = useParams<{
    courseId: string
    subcourseId: string
    activityType: 'ia1' | 'ia2'
  }>()

  const isIA1 = activityType === 'ia1'

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [activityId, setActivityId] = useState<string | null>(null)
  const [activityTitle, setActivityTitle] = useState(
    isIA1 ? 'Urutkan Pembuatan Variabel' : 'Penetapan & Perhitungan Nilai Variabel'
  )

  const [blocks, setBlocks] = useState<BlockItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Interactive Simulator state
  const [simulatorBlocks, setSimulatorBlocks] = useState<{ id: string; label: string; originalIndex: number }[]>([])
  const [simResult, setSimResult] = useState<'success' | 'fail' | null>(null)

  const fetchBlocks = useCallback(async () => {
    if (!supabase || !courseId || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // Fetch titles
      const { data: cData } = await supabase.from('courses').select('title').eq('id', courseId).single()
      if (cData) setCourseTitle(cData.title)

      const { data: scData } = await supabase.from('sub_courses').select('title').eq('id', subcourseId).single()
      if (scData) setSubCourseTitle(scData.title)

      // Fetch or create activity row
      let { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .eq('type', activityType || 'ia1')
        .maybeSingle()

      if (actData) {
        setActivityId(actData.id)
        if ((actData.content_ref as { title?: string })?.title) {
          setActivityTitle((actData.content_ref as { title: string }).title)
        }

        // Fetch existing blocks
        const { data: bData, error: bError } = await supabase
          .from('ia_blocks')
          .select('*')
          .eq('activity_id', actData.id)
          .order('correct_order', { ascending: true, nullsFirst: false })

        if (bError) throw bError

        if (bData && bData.length > 0) {
          setBlocks(bData)
        } else {
          // Initialize with PRD-compliant defaults if empty
          initializeDefaultBlocks()
        }
      } else {
        initializeDefaultBlocks()
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat blok interaktif.')
    } finally {
      setLoading(false)
    }
  }, [courseId, subcourseId, activityType])

  const initializeDefaultBlocks = () => {
    if (isIA1) {
      // IA1 Spec: 4-5 blocks, 0 distractors
      setBlocks([
        { label: 'skor = 0', role: 'correct', correct_order: 1 },
        { label: 'nama_pemain = "Budi"', role: 'correct', correct_order: 2 },
        { label: 'skor = skor + 10', role: 'correct', correct_order: 3 },
        { label: 'tampilkan(skor)', role: 'correct', correct_order: 4 }
      ])
    } else {
      // IA2 Spec: 7-9 blocks, 2-4 distractors
      setBlocks([
        { label: 'total_koin = 10', role: 'correct', correct_order: 1 },
        { label: 'bonus = 5', role: 'correct', correct_order: 2 },
        { label: 'total_koin = total_koin + bonus', role: 'correct', correct_order: 3 },
        { label: 'tampilkan("Koin Akhir:")', role: 'correct', correct_order: 4 },
        { label: 'tampilkan(total_koin)', role: 'correct', correct_order: 5 },
        // Distractors (2 distractors):
        { label: 'hapus_semua_koin()', role: 'distractor', correct_order: null },
        { label: 'total_koin = "kosong"', role: 'distractor', correct_order: null }
      ])
    }
  }

  useEffect(() => {
    fetchBlocks()
  }, [fetchBlocks])

  // Reset simulator when blocks change
  useEffect(() => {
    const shuffled = [...blocks]
      .map((b, i) => ({ id: `sim-${i}`, label: b.label, originalIndex: i }))
      .sort(() => Math.random() - 0.5)
    setSimulatorBlocks(shuffled)
    setSimResult(null)
  }, [blocks])

  const addBlock = () => {
    const correctCount = blocks.filter((b) => b.role === 'correct').length
    const nextOrder = correctCount + 1

    setBlocks([
      ...blocks,
      {
        label: `kode_baru_${blocks.length + 1}()`,
        role: isIA1 ? 'correct' : 'correct',
        correct_order: nextOrder
      }
    ])
  }

  const removeBlock = (index: number) => {
    const updated = blocks.filter((_, i) => i !== index)
    // Re-index correct_order
    let orderCounter = 1
    const reordered = updated.map((b) => {
      if (b.role === 'correct') {
        return { ...b, correct_order: orderCounter++ }
      }
      return b
    })
    setBlocks(reordered)
  }

  const updateBlock = (index: number, updates: Partial<BlockItem>) => {
    const updated = [...blocks]
    const target = { ...updated[index], ...updates }

    if (updates.role === 'distractor') {
      target.correct_order = null
    } else if (updates.role === 'correct' && target.correct_order === null) {
      const correctCount = blocks.filter((b, i) => i !== index && b.role === 'correct').length
      target.correct_order = correctCount + 1
    }

    updated[index] = target

    // Re-index correct_order sequence
    let orderCounter = 1
    const finalBlocks = updated.map((b) => {
      if (b.role === 'correct') {
        return { ...b, correct_order: orderCounter++ }
      }
      return b
    })

    setBlocks(finalBlocks)
  }

  const moveOrder = (index: number, direction: 'up' | 'down') => {
    const correctIndices = blocks
      .map((b, i) => (b.role === 'correct' ? i : -1))
      .filter((i) => i !== -1)

    const correctPos = correctIndices.indexOf(index)
    if (correctPos === -1) return
    if (direction === 'up' && correctPos === 0) return
    if (direction === 'down' && correctPos === correctIndices.length - 1) return

    const swapWithIndex = correctIndices[direction === 'up' ? correctPos - 1 : correctPos + 1]

    const updated = [...blocks]
    const tempOrder = updated[index].correct_order
    updated[index].correct_order = updated[swapWithIndex].correct_order
    updated[swapWithIndex].correct_order = tempOrder

    // Swap positions in array for clean UI
    const tempItem = updated[index]
    updated[index] = updated[swapWithIndex]
    updated[swapWithIndex] = tempItem

    setBlocks(updated)
  }

  const handleSave = async () => {
    if (!supabase || !subcourseId) return
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      // 1. Upsert activity record
      const orderSlot = isIA1 ? 3 : 4
      const payloadActivity = {
        subcourse_id: subcourseId,
        type: activityType || 'ia1',
        order: orderSlot,
        content_ref: {
          title: activityTitle.trim(),
          mode: activityType,
          total_blocks: blocks.length,
          correct_count: blocks.filter((b) => b.role === 'correct').length,
          distractors_count: blocks.filter((b) => b.role === 'distractor').length,
          updated_at: new Date().toISOString()
        }
      }

      let currentActId = activityId
      if (currentActId) {
        await supabase.from('activities').update(payloadActivity).eq('id', currentActId)
      } else {
        const { data, error } = await supabase
          .from('activities')
          .insert(payloadActivity)
          .select()
          .single()
        if (error) throw error
        currentActId = data.id
        setActivityId(data.id)
      }

      // 2. Clear old blocks and re-insert new blocks
      await supabase.from('ia_blocks').delete().eq('activity_id', currentActId)

      if (blocks.length > 0) {
        const rowsToInsert = blocks.map((b) => ({
          activity_id: currentActId,
          label: b.label.trim(),
          role: b.role,
          correct_order: b.role === 'correct' ? b.correct_order : null
        }))

        const { error: blockError } = await supabase.from('ia_blocks').insert(rowsToInsert)
        if (blockError) throw blockError
      }

      setSuccessMessage('Aktivitas blok kode berhasil disimpan ke database!')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan blok aktivitas.')
    } finally {
      setSaving(false)
    }
  }

  // Interactive Simulator helper
  const moveSimulatorItem = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === simulatorBlocks.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...simulatorBlocks]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp

    setSimulatorBlocks(updated)
    setSimResult(null)
  }

  const checkSimulatorSolution = () => {
    const correctBlocks = blocks.filter((b) => b.role === 'correct')
    const correctLabelsInOrder = correctBlocks
      .sort((a, b) => (a.correct_order || 0) - (b.correct_order || 0))
      .map((b) => b.label.trim())

    // Filter out items in simulator that match distractor labels
    const userPlacedLabels = simulatorBlocks.map((s) => s.label.trim())

    // Compare with the target correct sequence
    const isExactMatch =
      correctLabelsInOrder.length === userPlacedLabels.slice(0, correctLabelsInOrder.length).length &&
      correctLabelsInOrder.every((label, idx) => userPlacedLabels[idx] === label)

    setSimResult(isExactMatch ? 'success' : 'fail')
  }

  // PRD Compliance Calculations
  const totalCount = blocks.length
  const distractorCount = blocks.filter((b) => b.role === 'distractor').length

  const isIA1Compliant = totalCount >= 4 && totalCount <= 5 && distractorCount === 0
  const isIA2Compliant = totalCount >= 7 && totalCount <= 9 && distractorCount >= 2 && distractorCount <= 4

  if (loading) {
    return (
      <div className="card-brutal p-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-black border-t-retro-green rounded-full animate-spin mx-auto" />
        <p className="font-bold text-sm">Memuat editor blok interaktif...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Navigation Top */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={`/admin/courses/${courseId}`}
          className="btn-brutal-white text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke {subCourseTitle || 'Sub-Materi'}</span>
        </Link>

        <button
          onClick={handleSave}
          disabled={saving}
          className="btn-brutal-green text-xs py-2 px-4 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : 'Simpan Blok Kode'}</span>
        </button>
      </div>

      {/* Header Info Banner */}
      <div className="card-brutal bg-white p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span
              className={`badge-brutal ${
                isIA1 ? 'bg-retro-green text-black' : 'bg-retro-purple text-white'
              }`}
            >
              {isIA1 ? 'AKTIVITAS 3 (IA1)' : 'AKTIVITAS 4 (IA2)'}
            </span>
            <span className="text-neutral-500">{courseTitle} &gt; {subCourseTitle}</span>
          </div>
          <h1 className="text-xl font-black text-black">
            Editor Drag-and-Drop Blok Kode ({isIA1 ? 'Urutan Dasar' : 'Urutan Lanjutan'})
          </h1>
        </div>

        {/* PRD Compliance Check Badge */}
        <div className="flex items-center gap-2">
          {isIA1 ? (
            <div
              className={`badge-brutal text-xs py-1.5 px-3 ${
                isIA1Compliant ? 'bg-retro-green text-black' : 'bg-retro-yellow text-black'
              }`}
            >
              {isIA1Compliant ? '✦ SESUAI PRD IA1 (4-5 Blok, 0 Pengecoh)' : '○ ATURAN PRD IA1 (4-5 Blok, 0 Pengecoh)'}
            </div>
          ) : (
            <div
              className={`badge-brutal text-xs py-1.5 px-3 ${
                isIA2Compliant ? 'bg-retro-green text-black' : 'bg-retro-yellow text-black'
              }`}
            >
              {isIA2Compliant ? '✦ SESUAI PRD IA2 (7-9 Blok, 2-4 Pengecoh)' : '○ ATURAN PRD IA2 (7-9 Blok, 2-4 Pengecoh)'}
            </div>
          )}
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

      {/* Activity Title Input */}
      <div className="card-brutal bg-white p-4 space-y-1.5">
        <label className="block text-xs font-bold text-black uppercase tracking-wider">
          Instruksi Tugas untuk Siswa *
        </label>
        <input
          type="text"
          required
          value={activityTitle}
          onChange={(e) => setActivityTitle(e.target.value)}
          placeholder="misal: Urutkan blok kode untuk membuat dan menampilkan variabel!"
          className="input-brutal font-semibold text-sm"
        />
      </div>

      {/* Main Grid: Blocks Builder (Left) & Live Simulator (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Modular Block Builder */}
        <div className="lg:col-span-7 space-y-4">
          <div className="flex items-center justify-between border-b-2 border-black pb-2">
            <div>
              <h2 className="text-base font-black text-black flex items-center gap-2">
                <Code className="w-5 h-5 text-black" />
                Daftar Blok Kode ({blocks.length} Blok)
              </h2>
              <p className="text-[11px] text-neutral-600 font-medium">
                Atur urutan yang benar dan tentukan blok mana yang menjadi pengecoh (distractor).
              </p>
            </div>

            <button onClick={addBlock} className="btn-brutal-yellow text-xs py-1.5 px-3">
              <Plus className="w-4 h-4" /> Tambah Blok
            </button>
          </div>

          {/* Blocks List */}
          <div className="space-y-3">
            {blocks.map((block, index) => {
              const isCorrect = block.role === 'correct'

              return (
                <div
                  key={index}
                  className={`card-brutal p-4 space-y-3 transition-all ${
                    isCorrect ? 'bg-white' : 'bg-retro-pink/10 border-retro-pink'
                  }`}
                >
                  {/* Block Header Controls */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {isCorrect ? (
                        <span className="badge-brutal bg-retro-green text-black font-mono text-xs">
                          Urutan #{block.correct_order}
                        </span>
                      ) : (
                        <span className="badge-brutal bg-retro-pink text-white font-mono text-xs">
                          Pengecoh (Distractor)
                        </span>
                      )}

                      {/* Role Toggle Switch */}
                      <button
                        type="button"
                        onClick={() =>
                          updateBlock(index, { role: isCorrect ? 'distractor' : 'correct' })
                        }
                        className="text-[11px] font-bold underline text-neutral-700 hover:text-black cursor-pointer"
                      >
                        Ubah jadi {isCorrect ? 'Pengecoh' : 'Blok Benar'}
                      </button>
                    </div>

                    <div className="flex items-center gap-1">
                      {isCorrect && (
                        <>
                          <button
                            type="button"
                            onClick={() => moveOrder(index, 'up')}
                            className="p-1 border border-black rounded hover:bg-neutral-100"
                            title="Naikkan urutan"
                          >
                            <ChevronUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => moveOrder(index, 'down')}
                            className="p-1 border border-black rounded hover:bg-neutral-100"
                            title="Turunkan urutan"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button
                        type="button"
                        onClick={() => removeBlock(index)}
                        className="p-1 border border-black rounded hover:bg-retro-pink hover:text-white transition ml-1"
                        title="Hapus blok ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Block Code Content */}
                  <div>
                    <input
                      type="text"
                      value={block.label}
                      onChange={(e) => updateBlock(index, { label: e.target.value })}
                      placeholder="misal: skor = 100"
                      className={`w-full border-2 border-black rounded-lg px-3 py-2 text-xs font-mono font-bold shadow-[2px_2px_0px_#000] focus:outline-none ${
                        isCorrect ? 'bg-[#FFFDE6]' : 'bg-[#FFEBF3]'
                      }`}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Column: Live Interactive Sandbox / Simulator */}
        <div className="lg:col-span-5 space-y-4">
          <div className="card-brutal bg-[#FAF7EE] p-5 space-y-4 sticky top-20">
            <div className="border-b-2 border-black pb-3 flex items-center justify-between">
              <div>
                <span className="badge-brutal bg-black text-white font-mono text-[10px]">
                  SIMULATOR INTERAKTIF SISWA
                </span>
                <p className="text-xs font-black text-black mt-1">Uji Coba Penyelesaian Urutan</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  const shuffled = [...blocks]
                    .map((b, i) => ({ id: `sim-${i}`, label: b.label, originalIndex: i }))
                    .sort(() => Math.random() - 0.5)
                  setSimulatorBlocks(shuffled)
                  setSimResult(null)
                }}
                className="btn-brutal-white text-[11px] py-1 px-2.5 inline-flex items-center gap-1"
                title="Acak kembali blok"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Acak</span>
              </button>
            </div>

            <p className="text-[11px] text-neutral-600 font-medium">
              Siswa akan melihat blok-blok ini dalam posisi acak. Siswa menyusun urutan yang benar dari atas ke bawah:
            </p>

            {/* Draggable-like simulator blocks */}
            <div className="space-y-2">
              {simulatorBlocks.map((item, idx) => (
                <div
                  key={item.id}
                  className="card-brutal bg-white p-3 flex items-center justify-between gap-2 shadow-brutal-sm hover:translate-x-0.5 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-5 h-5 rounded bg-black text-white text-[10px] font-mono flex items-center justify-center font-bold">
                      {idx + 1}
                    </span>
                    <code className="text-xs font-mono font-bold text-black">{item.label}</code>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => moveSimulatorItem(idx, 'up')}
                      disabled={idx === 0}
                      className="p-1 border border-black rounded hover:bg-neutral-100 disabled:opacity-20"
                    >
                      <ChevronUp className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSimulatorItem(idx, 'down')}
                      disabled={idx === simulatorBlocks.length - 1}
                      className="p-1 border border-black rounded hover:bg-neutral-100 disabled:opacity-20"
                    >
                      <ChevronDown className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Check Button */}
            <button
              type="button"
              onClick={checkSimulatorSolution}
              className="btn-brutal-yellow w-full text-xs py-2.5 flex items-center justify-center gap-2"
            >
              <Play className="w-3.5 h-3.5 fill-black" />
              <span>Periksa Urutan (Cek Jawaban)</span>
            </button>

            {/* Result Banner */}
            {simResult === 'success' && (
              <div className="card-brutal bg-retro-green p-3 flex items-center gap-2 text-xs font-bold text-black animate-fade-in">
                <Check className="w-4 h-4 text-black" />
                <span>Urutan Benar! Siswa berhasil menyelesaikan aktivitas ini! 🎉</span>
              </div>
            )}

            {simResult === 'fail' && (
              <div className="card-brutal bg-retro-pink p-3 flex items-center gap-2 text-xs font-bold text-white animate-fade-in">
                <AlertCircle className="w-4 h-4 text-white" />
                <span>Urutan masih belum tepat atau ada blok pengecoh di atas! Coba susun ulang.</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
