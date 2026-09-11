import React, { useState, useEffect, useCallback } from 'react'
import {
  Puzzle,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  ArrowRight,
  ChevronUp,
  ChevronDown,
  X,
  Sparkles,
  Award,
  Layers,
  HelpCircle,
  Check
} from 'lucide-react'

export interface IABlockItem {
  id: string
  label: string
  role: 'correct' | 'distractor'
  correct_order: number | null
}

interface BlockSequencerProps {
  activityNumber?: number
  activityType?: 'ia1' | 'ia2'
  activityTitle?: string
  blocks: IABlockItem[]
  onSuccess?: () => void
  onNextActivity?: () => void
}

interface CheckResult {
  isCorrect: boolean
  message: string
  details?: string
  distractorIds: string[]
  misplacedIds: string[]
}

// Fisher-Yates shuffle helper
function shuffleArray<T>(array: T[]): T[] {
  const shuffled = [...array]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const temp = shuffled[i]
    shuffled[i] = shuffled[j]
    shuffled[j] = temp
  }
  return shuffled
}

export default function BlockSequencer({
  activityNumber = 3,
  activityType = 'ia1',
  activityTitle,
  blocks,
  onNextActivity
}: BlockSequencerProps) {
  // Bank Balok (available unplaced blocks) & Alur Program (placed blocks)
  const [availableBlocks, setAvailableBlocks] = useState<IABlockItem[]>([])
  const [placedBlocks, setPlacedBlocks] = useState<IABlockItem[]>([])

  // Solution check result
  const [checkResult, setCheckResult] = useState<CheckResult | null>(null)

  // Drag-and-drop state
  const [draggedItem, setDraggedItem] = useState<{
    source: 'bank' | 'placed'
    index: number
    block: IABlockItem
  } | null>(null)

  const [dragOverPlacedIndex, setDragOverPlacedIndex] = useState<number | null>(null)

  // Initialize and scramble blocks
  const resetBlocks = useCallback(() => {
    if (!blocks || blocks.length === 0) {
      setAvailableBlocks([])
      setPlacedBlocks([])
      setCheckResult(null)
      return
    }

    // Scramble the blocks
    const scrambled = shuffleArray(blocks)
    setAvailableBlocks(scrambled)
    setPlacedBlocks([])
    setCheckResult(null)
  }, [blocks])

  useEffect(() => {
    resetBlocks()
  }, [resetBlocks])

  // Move block from Bank to Placed
  const moveToPlaced = (index: number) => {
    const block = availableBlocks[index]
    setAvailableBlocks((prev) => prev.filter((_, idx) => idx !== index))
    setPlacedBlocks((prev) => [...prev, block])
    setCheckResult(null)
  }

  // Move block from Placed back to Bank
  const moveToAvailable = (index: number) => {
    const block = placedBlocks[index]
    setPlacedBlocks((prev) => prev.filter((_, idx) => idx !== index))
    setAvailableBlocks((prev) => [...prev, block])
    setCheckResult(null)
  }

  // Nudge order in Placed list
  const movePlacedOrder = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index === 0) return
    if (direction === 'down' && index === placedBlocks.length - 1) return

    const targetIndex = direction === 'up' ? index - 1 : index + 1
    const updated = [...placedBlocks]
    const temp = updated[index]
    updated[index] = updated[targetIndex]
    updated[targetIndex] = temp

    setPlacedBlocks(updated)
    setCheckResult(null)
  }

  // ─── Drag & Drop Handlers ──────────────────────────────────────────────────
  const handleDragStartFromBank = (e: React.DragEvent, index: number, block: IABlockItem) => {
    e.dataTransfer.setData('text/plain', block.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem({ source: 'bank', index, block })
  }

  const handleDragStartFromPlaced = (e: React.DragEvent, index: number, block: IABlockItem) => {
    e.dataTransfer.setData('text/plain', block.id)
    e.dataTransfer.effectAllowed = 'move'
    setDraggedItem({ source: 'placed', index, block })
  }

  const handleDragOverPlacedZone = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDropOnPlacedZone = (e: React.DragEvent) => {
    e.preventDefault()
    if (!draggedItem) return

    if (draggedItem.source === 'bank') {
      // Append block from bank to placed list
      moveToPlaced(draggedItem.index)
    }
    setDraggedItem(null)
    setDragOverPlacedIndex(null)
  }

  const handleDropOnPlacedItem = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault()
    e.stopPropagation()
    if (!draggedItem) return

    if (draggedItem.source === 'placed') {
      // Reorder within placed list
      const fromIndex = draggedItem.index
      if (fromIndex !== targetIndex) {
        const updated = [...placedBlocks]
        const [movedItem] = updated.splice(fromIndex, 1)
        updated.splice(targetIndex, 0, movedItem)
        setPlacedBlocks(updated)
        setCheckResult(null)
      }
    } else if (draggedItem.source === 'bank') {
      // Insert from bank at targetIndex
      const block = draggedItem.block
      setAvailableBlocks((prev) => prev.filter((b) => b.id !== block.id))
      const updated = [...placedBlocks]
      updated.splice(targetIndex, 0, block)
      setPlacedBlocks(updated)
      setCheckResult(null)
    }

    setDraggedItem(null)
    setDragOverPlacedIndex(null)
  }

  // ─── Verification Logic ───────────────────────────────────────────────────
  const handleCheckSolution = () => {
    // 1. Get required correct sequence from CMS
    const correctBlocks = blocks
      .filter((b) => b.role === 'correct')
      .sort((a, b) => (a.correct_order || 0) - (b.correct_order || 0))

    const targetSequence = correctBlocks.map((b) => b.label.trim())
    const userPlacedSequence = placedBlocks.map((b) => b.label.trim())

    // 2. Find any placed distractors
    const distractorIds = placedBlocks.filter((b) => b.role === 'distractor').map((b) => b.id)

    // 3. Check for completeness
    if (userPlacedSequence.length === 0) {
      setCheckResult({
        isCorrect: false,
        message: 'Alur Program Masih Kosong!',
        details: 'Klik atau geser balok dari "Pilihan Balok" ke "Urutan Program Kamu" untuk menyusun program.',
        distractorIds: [],
        misplacedIds: []
      })
      return
    }

    if (distractorIds.length > 0) {
      setCheckResult({
        isCorrect: false,
        message: 'Ada Balok Pengecoh Terpasang!',
        details:
          'Balok yang ditandai merah muda tidak diperlukan dalam program ini. Klik balok tersebut untuk mengeluarkannya.',
        distractorIds,
        misplacedIds: []
      })
      return
    }

    if (userPlacedSequence.length < targetSequence.length) {
      setCheckResult({
        isCorrect: false,
        message: 'Balok Belum Lengkap!',
        details: `Program membutuhkan ${targetSequence.length} langkah berurutan. Kamu baru memasang ${userPlacedSequence.length} balok.`,
        distractorIds: [],
        misplacedIds: []
      })
      return
    }

    if (userPlacedSequence.length > targetSequence.length) {
      setCheckResult({
        isCorrect: false,
        message: 'Terlalu Banyak Balok Terpasang!',
        details: `Program hanya membutuhkan ${targetSequence.length} balok. Periksa kembali apakah ada balok yang tidak sesuai.`,
        distractorIds: [],
        misplacedIds: []
      })
      return
    }

    // 4. Check exact sequential match
    const misplacedIds: string[] = []
    let allMatches = true

    for (let i = 0; i < targetSequence.length; i++) {
      if (userPlacedSequence[i] !== targetSequence[i]) {
        allMatches = false
        misplacedIds.push(placedBlocks[i].id)
      }
    }

    if (allMatches) {
      setCheckResult({
        isCorrect: true,
        message: 'HORE! JAWABAN KAMU BENAR! 🎉',
        details: 'Hebat sekali! Kamu berhasil menyusun urutan logika balok kode dengan tepat 100%!',
        distractorIds: [],
        misplacedIds: []
      })
    } else {
      setCheckResult({
        isCorrect: false,
        message: 'Urutan Balok Belum Tepat!',
        details:
          'Ada balok yang posisinya tertukar. Perhatikan langkah logika: mana yang harus dijalankan lebih dulu? Gunakan tombol panah untuk menukar posisi balok.',
        distractorIds: [],
        misplacedIds
      })
    }
  }

  const isSuccess = checkResult?.isCorrect === true
  const correctBlocksCount = blocks.filter((b) => b.role === 'correct').length
  const distractorBlocksCount = blocks.filter((b) => b.role === 'distractor').length

  return (
    <div className="card-brutal bg-white p-6 sm:p-10 space-y-8 shadow-brutal-lg max-w-4xl mx-auto">
      {/* Activity Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-5">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-retro-pink border-2 border-black flex items-center justify-center shadow-brutal-sm flex-shrink-0">
            <Puzzle className="w-6 h-6 text-white stroke-[2.5]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="badge-brutal text-[10px] bg-retro-pink text-white font-black">
                AKTIVITAS #{activityNumber}
              </span>
              <span className="badge-brutal text-[10px] bg-black text-white font-mono">
                {activityType.toUpperCase()}
              </span>
            </div>
            <h2 className="text-xl font-black text-black tracking-tight mt-1">
              {activityTitle ||
                (activityType === 'ia1'
                  ? 'Urutkan Pembuatan Variabel'
                  : 'Tantangan Blok: Nilai & Perhitungan')}
            </h2>
          </div>
        </div>

        <button
          onClick={resetBlocks}
          className="btn-brutal-white text-xs py-2 px-3.5 inline-flex items-center gap-1.5 self-start sm:self-auto hover:bg-neutral-100"
          title="Acak ulang balok dan mulai dari awal"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Tata Ulang / Reset</span>
        </button>
      </div>

      {/* Instructions Box */}
      <div className="card-brutal bg-[#FAF7EE] border-2 border-black p-4 sm:p-5 space-y-1.5">
        <div className="flex items-center gap-2 text-xs font-black uppercase text-black font-mono">
          <HelpCircle className="w-4 h-4 text-retro-yellow flex-shrink-0" />
          <span>Instruksi Misi Coding:</span>
        </div>
        <p className="text-xs sm:text-sm text-neutral-800 leading-relaxed font-medium">
          Susun balok-balok kode di bawah ini ke dalam urutan yang logis dari atas ke bawah.
          {distractorBlocksCount > 0 ? (
            <>
              {' '}
              Hati-hati, ada <strong>{distractorBlocksCount} balok pengecoh</strong> yang tidak boleh dimasukkan ke dalam program!
            </>
          ) : (
            <> Gunakan semua balok yang tersedia untuk menyelesaikan alur program.</>
          )}
        </p>
        <p className="text-[11px] text-neutral-600 font-mono pt-1">
          💡 Tips: Kamu bisa <strong>klik langsung</strong> balok untuk memindahkannya, atau <strong>geser (drag & drop)</strong> ke area susunan.
        </p>
      </div>

      {/* Visual Feedback Result Banner (Simple, Obvious for Kids) */}
      {checkResult && (
        <div
          className={`card-brutal p-5 sm:p-6 space-y-3 transition-all animate-fade-in ${
            isSuccess ? 'bg-retro-green text-black' : 'bg-retro-pink text-white'
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              {isSuccess ? (
                <div className="w-10 h-10 rounded-full bg-black text-retro-green flex items-center justify-center flex-shrink-0 mt-0.5 border-2 border-black shadow-brutal-sm">
                  <Check className="w-6 h-6 stroke-[3.5]" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-white text-retro-pink flex items-center justify-center flex-shrink-0 mt-0.5 border-2 border-black shadow-brutal-sm">
                  <AlertCircle className="w-6 h-6 stroke-[3]" />
                </div>
              )}

              <div>
                <h3 className="text-lg sm:text-xl font-black tracking-tight font-heading">
                  {checkResult.message}
                </h3>
                {checkResult.details && (
                  <p
                    className={`text-xs sm:text-sm font-medium mt-1 leading-relaxed ${
                      isSuccess ? 'text-neutral-900' : 'text-white/95'
                    }`}
                  >
                    {checkResult.details}
                  </p>
                )}
              </div>
            </div>

            {isSuccess && onNextActivity && (
              <button
                onClick={onNextActivity}
                className="btn-brutal-black text-retro-yellow text-xs py-2 px-4 inline-flex items-center gap-2 flex-shrink-0 shadow-brutal hover:bg-neutral-900"
              >
                <span>Lanjut ➔</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Drag-and-Drop Workspace Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column: Bank Balok (Available Blocks) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-neutral-600" />
              <h3 className="text-xs font-black uppercase tracking-wider text-black font-mono">
                Pilihan Balok ({availableBlocks.length} Tersedia)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">Klik untuk pasang</span>
          </div>

          <div className="card-brutal bg-[#FAF7EE] p-4 min-h-[260px] space-y-2.5 border-2 border-black border-dashed">
            {availableBlocks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                <Sparkles className="w-8 h-8 text-neutral-400" />
                <p className="text-xs font-bold text-neutral-700">Semua balok sudah dipindahkan!</p>
                <p className="text-[11px] text-neutral-500">
                  Periksa urutan balok di sebelah kanan lalu klik tombol "Periksa Jawaban".
                </p>
              </div>
            ) : (
              availableBlocks.map((block, idx) => (
                <div
                  key={block.id}
                  draggable={!isSuccess}
                  onDragStart={(e) => handleDragStartFromBank(e, idx, block)}
                  onClick={() => !isSuccess && moveToPlaced(idx)}
                  className="card-brutal bg-white p-3.5 flex items-center justify-between gap-3 cursor-pointer hover:bg-retro-yellow/30 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all group select-none shadow-brutal-sm"
                  title="Klik untuk memasukkan balok ke urutan alur program"
                >
                  <div className="flex items-center gap-2.5 overflow-hidden">
                    <span className="font-mono text-xs font-black text-neutral-400 group-hover:text-black">
                      ::
                    </span>
                    <span className="font-mono font-black text-xs sm:text-sm text-black truncate">
                      {block.label}
                    </span>
                  </div>

                  <span className="badge-brutal text-[10px] bg-neutral-100 group-hover:bg-retro-yellow text-black font-bold flex-shrink-0">
                    + PASANG
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column: Alur Program Kamu (Placed Sequence Workspace) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Puzzle className="w-4 h-4 text-retro-pink" />
              <h3 className="text-xs font-black uppercase tracking-wider text-black font-mono">
                Urutan Program Kamu ({placedBlocks.length} / {correctBlocksCount} Balok)
              </h3>
            </div>
            <span className="text-[11px] font-mono text-neutral-500">Urutan Dari Atas ke Bawah</span>
          </div>

          <div
            onDragOver={handleDragOverPlacedZone}
            onDrop={handleDropOnPlacedZone}
            className={`card-brutal p-4 min-h-[260px] space-y-2.5 border-3 transition-colors ${
              isSuccess
                ? 'bg-retro-green/10 border-retro-green'
                : checkResult && !checkResult.isCorrect
                ? 'bg-retro-pink/10 border-retro-pink'
                : 'bg-white border-black'
            }`}
          >
            {placedBlocks.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 text-neutral-500 space-y-2">
                <div className="w-10 h-10 rounded-xl border-2 border-dashed border-black/40 flex items-center justify-center text-neutral-400">
                  <Puzzle className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-black">Area Alur Program Masih Kosong</p>
                <p className="text-[11px] text-neutral-600 max-w-xs leading-relaxed">
                  Pilih balok dari kolom kiri untuk mulai menyusun langkah logika program.
                </p>
              </div>
            ) : (
              placedBlocks.map((block, idx) => {
                const isDistractor = checkResult?.distractorIds.includes(block.id)
                const isMisplaced = checkResult?.misplacedIds.includes(block.id)

                let cardStyle = 'bg-white border-black'
                if (isSuccess) {
                  cardStyle = 'bg-retro-green text-black border-black font-black'
                } else if (isDistractor) {
                  cardStyle = 'bg-retro-pink/20 border-retro-pink text-black'
                } else if (isMisplaced) {
                  cardStyle = 'bg-retro-yellow/30 border-black'
                }

                return (
                  <div
                    key={block.id}
                    draggable={!isSuccess}
                    onDragStart={(e) => handleDragStartFromPlaced(e, idx, block)}
                    onDragOver={(e) => {
                      e.preventDefault()
                      setDragOverPlacedIndex(idx)
                    }}
                    onDragLeave={() => setDragOverPlacedIndex(null)}
                    onDrop={(e) => handleDropOnPlacedItem(e, idx)}
                    className={`card-brutal p-3 flex items-center justify-between gap-2.5 transition-all select-none shadow-brutal-sm ${cardStyle} ${
                      dragOverPlacedIndex === idx ? 'border-dashed border-retro-pink scale-[1.02]' : ''
                    }`}
                  >
                    <div className="flex items-center gap-2.5 overflow-hidden flex-1">
                      {/* Step Number Badge */}
                      <span className="w-6 h-6 rounded-lg bg-black text-white font-mono font-black text-xs flex items-center justify-center flex-shrink-0">
                        {idx + 1}
                      </span>

                      <div className="truncate flex-1">
                        <p className="font-mono font-black text-xs sm:text-sm text-black truncate">
                          {block.label}
                        </p>

                        {/* Visual Error / Warning Labels */}
                        {isDistractor && (
                          <span className="badge-brutal text-[9px] bg-retro-pink text-white font-black mt-0.5 inline-block">
                            ❌ BALOK PENGECOH (TIDAK DIPERLUKAN)
                          </span>
                        )}
                        {isMisplaced && (
                          <span className="badge-brutal text-[9px] bg-retro-yellow text-black font-black mt-0.5 inline-block">
                            ⚠️ URUTAN BELUM TEPAT
                          </span>
                        )}
                        {isSuccess && (
                          <span className="badge-brutal text-[9px] bg-black text-retro-green font-black mt-0.5 inline-block">
                            ✓ TEPAT
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Controls: Reorder Up / Down & Remove */}
                    {!isSuccess && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          type="button"
                          onClick={() => movePlacedOrder(idx, 'up')}
                          disabled={idx === 0}
                          className="p-1 rounded border border-black hover:bg-neutral-200 disabled:opacity-20"
                          title="Pindahkan ke atas"
                        >
                          <ChevronUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePlacedOrder(idx, 'down')}
                          disabled={idx === placedBlocks.length - 1}
                          className="p-1 rounded border border-black hover:bg-neutral-200 disabled:opacity-20"
                          title="Pindahkan ke bawah"
                        >
                          <ChevronDown className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveToAvailable(idx)}
                          className="p-1 rounded border border-black hover:bg-retro-pink hover:text-white transition ml-0.5"
                          title="Keluarkan balok ini dari susunan"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

      {/* Action Footer Button */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t-2 border-black">
        <div className="flex items-center gap-2 text-xs font-bold text-neutral-600">
          <Award className="w-4 h-4 text-retro-yellow" />
          <span>
            Target Selesai: {correctBlocksCount} Balok Logika Terpasang Tepat
          </span>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          {!isSuccess ? (
            <button
              onClick={handleCheckSolution}
              disabled={placedBlocks.length === 0}
              className="btn-brutal-yellow w-full sm:w-auto py-3 px-8 text-sm font-black inline-flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4 stroke-[2.5]" />
              <span>Periksa Jawaban</span>
            </button>
          ) : (
            onNextActivity && (
              <button
                onClick={onNextActivity}
                className="btn-brutal-green w-full sm:w-auto py-3 px-8 text-sm font-black inline-flex items-center justify-center gap-2"
              >
                <span>Lanjut ke Aktivitas Berikutnya</span>
                <ArrowRight className="w-4 h-4 stroke-[3]" />
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}
