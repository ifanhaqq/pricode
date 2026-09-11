import React, { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  ArrowLeft,
  Plus,
  Edit2,
  Trash2,
  ChevronUp,
  ChevronDown,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Video,
  Puzzle,
  HelpCircle,
  ArrowRight,
  Sparkles,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'

interface CourseDetail {
  id: string
  title: string
  order: number
  description: string | null
  is_published: boolean
}

interface ActivityRecord {
  id: string
  subcourse_id: string
  type: 'text' | 'video' | 'ia1' | 'ia2' | 'quiz'
  order: number
  content_ref: Record<string, unknown>
}

interface SubCourseDetail {
  id: string
  course_id: string
  title: string
  order: number
  activities: ActivityRecord[]
  quiz_questions_count?: number
}

// PRD fixed sequence definition for each subcourse
const ACTIVITY_SLOTS: {
  type: 'text' | 'video' | 'ia1' | 'ia2' | 'quiz'
  order: number
  label: string
  badgeLabel: string
  description: string
  icon: typeof FileText
  accentColor: string
}[] = [
  {
    type: 'text',
    order: 1,
    label: '1. Teks Pembelajaran & Konsep',
    badgeLabel: 'TEXT',
    description: 'Instruksi tertulis, heading, dan blok sintaks kode berwarna.',
    icon: FileText,
    accentColor: 'bg-retro-yellow'
  },
  {
    type: 'video',
    order: 2,
    label: '2. Video Tutorial YouTube',
    badgeLabel: 'VIDEO',
    description: 'Embed video edukasi via youtube-nocookie.com dan teks cadangan.',
    icon: Video,
    accentColor: 'bg-retro-pink text-white'
  },
  {
    type: 'ia1',
    order: 3,
    label: '3. Aktivitas Interaktif 1 (IA1 - Dasar)',
    badgeLabel: 'IA1 BLOK',
    description: 'Penyusunan urutan kode: 4–5 blok, 0 pengecoh.',
    icon: Puzzle,
    accentColor: 'bg-retro-green'
  },
  {
    type: 'ia2',
    order: 4,
    label: '4. Aktivitas Interaktif 2 (IA2 - Lanjutan)',
    badgeLabel: 'IA2 BLOK',
    description: 'Urutan lebih menantang: 7–9 blok, 2–4 pengecoh.',
    icon: Puzzle,
    accentColor: 'bg-retro-purple text-white'
  },
  {
    type: 'quiz',
    order: 5,
    label: '5. Kuis Sub-Materi',
    badgeLabel: 'KUIS',
    description: 'Soal pilihan ganda konsep sub-materi (Ambang kelulusan: 70%).',
    icon: HelpCircle,
    accentColor: 'bg-retro-blue text-black'
  }
]

export default function CourseDetailPage() {
  const { courseId } = useParams<{ courseId: string }>()

  const [course, setCourse] = useState<CourseDetail | null>(null)
  const [subcourses, setSubcourses] = useState<SubCourseDetail[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // SubCourse Modal state
  const [isSubCourseModalOpen, setIsSubCourseModalOpen] = useState(false)
  const [editingSubCourse, setEditingSubCourse] = useState<SubCourseDetail | null>(null)
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [subCourseOrder, setSubCourseOrder] = useState(1)
  const [isSavingSubCourse, setIsSavingSubCourse] = useState(false)

  // Delete SubCourse state
  const [deleteSubCourseId, setDeleteSubCourseId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCourseData = useCallback(async () => {
    if (!supabase || !courseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch course details
      const { data: cData, error: cError } = await supabase
        .from('courses')
        .select('*')
        .eq('id', courseId)
        .single()

      if (cError) throw cError
      setCourse(cData)

      // 2. Fetch subcourses
      const { data: scData, error: scError } = await supabase
        .from('sub_courses')
        .select('*')
        .eq('course_id', courseId)
        .order('order', { ascending: true })

      if (scError) throw scError

      // 3. Fetch activities for all subcourses in this course
      const subcourseIds = (scData || []).map((sc) => sc.id)
      let activitiesMap: Record<string, ActivityRecord[]> = {}

      if (subcourseIds.length > 0) {
        const { data: actData } = await supabase
          .from('activities')
          .select('*')
          .in('subcourse_id', subcourseIds)

        if (actData) {
          for (const act of actData) {
            if (!activitiesMap[act.subcourse_id]) {
              activitiesMap[act.subcourse_id] = []
            }
            activitiesMap[act.subcourse_id].push(act)
          }
        }
      }

      const combinedSubcourses: SubCourseDetail[] = (scData || []).map((sc) => ({
        ...sc,
        activities: activitiesMap[sc.id] || []
      }))

      setSubcourses(combinedSubcourses)
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat detail kursus.')
    } finally {
      setLoading(false)
    }
  }, [courseId])

  useEffect(() => {
    fetchCourseData()
  }, [fetchCourseData])

  const openAddSubCourseModal = () => {
    setEditingSubCourse(null)
    setSubCourseTitle('')
    setSubCourseOrder(subcourses.length + 1)
    setIsSubCourseModalOpen(true)
    setErrorMessage(null)
  }

  const openEditSubCourseModal = (sc: SubCourseDetail) => {
    setEditingSubCourse(sc)
    setSubCourseTitle(sc.title)
    setSubCourseOrder(sc.order)
    setIsSubCourseModalOpen(true)
    setErrorMessage(null)
  }

  const handleSaveSubCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !courseId) return
    setIsSavingSubCourse(true)
    setErrorMessage(null)

    try {
      if (editingSubCourse) {
        const { error } = await supabase
          .from('sub_courses')
          .update({
            title: subCourseTitle.trim(),
            order: subCourseOrder
          })
          .eq('id', editingSubCourse.id)

        if (error) throw error
        setSuccessMessage(`Sub-Materi "${subCourseTitle}" berhasil diperbarui.`)
      } else {
        const { data: newSc, error } = await supabase
          .from('sub_courses')
          .insert({
            course_id: courseId,
            title: subCourseTitle.trim(),
            order: subCourseOrder
          })
          .select()
          .single()

        if (error) throw error

        // Also ensure subcourse quiz record is initialized
        await supabase
          .from('sub_course_quizzes')
          .insert({
            subcourse_id: newSc.id,
            title: `Kuis ${subCourseTitle}`
          })
          .select()

        setSuccessMessage(`Sub-Materi "${subCourseTitle}" berhasil dibuat!`)
      }

      setIsSubCourseModalOpen(false)
      await fetchCourseData()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan sub-materi.')
    } finally {
      setIsSavingSubCourse(false)
    }
  }

  const handleDeleteSubCourse = async () => {
    if (!supabase || !deleteSubCourseId) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('sub_courses')
        .delete()
        .eq('id', deleteSubCourseId)

      if (error) throw error

      setSuccessMessage('Sub-Materi berhasil dihapus.')
      setDeleteSubCourseId(null)
      await fetchCourseData()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menghapus sub-materi.')
    } finally {
      setIsDeleting(false)
    }
  }

  const handleReorderSubCourse = async (sc: SubCourseDetail, direction: 'up' | 'down') => {
    if (!supabase) return
    const currentIndex = subcourses.findIndex((s) => s.id === sc.id)
    if (direction === 'up' && currentIndex === 0) return
    if (direction === 'down' && currentIndex === subcourses.length - 1) return

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
    const targetSc = subcourses[targetIndex]

    try {
      await supabase
        .from('sub_courses')
        .update({ order: targetSc.order })
        .eq('id', sc.id)

      await supabase
        .from('sub_courses')
        .update({ order: sc.order })
        .eq('id', targetSc.id)

      await fetchCourseData()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal mengubah urutan sub-materi.')
    }
  }

  const toggleCoursePublish = async () => {
    if (!supabase || !course) return
    const newStatus = !course.is_published

    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_published: newStatus })
        .eq('id', course.id)

      if (error) {
        if (error.message?.includes('is_published')) {
          throw new Error('Fitur Publish membutuhkan migrasi database. Harap jalankan script supabase/cms-schema.sql di SQL Editor Supabase.')
        }
        throw error
      }

      setCourse({ ...course, is_published: newStatus })
      setSuccessMessage(
        `Status kursus diubah menjadi: ${newStatus ? 'DITERBITKAN (PUBLISHED)' : 'DRAF (DRAFT)'}`
      )
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal mengubah status publikasi.')
    }
  }

  if (loading) {
    return (
      <div className="card-brutal p-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-black border-t-retro-yellow rounded-full animate-spin mx-auto" />
        <p className="font-bold text-sm">Memuat kurikulum sub-materi...</p>
      </div>
    )
  }

  if (!course) {
    return (
      <div className="card-brutal p-12 text-center space-y-4">
        <h2 className="text-xl font-bold">Kursus Tidak Ditemukan</h2>
        <Link to="/admin/courses" className="btn-brutal-white inline-flex items-center gap-2">
          <ArrowLeft className="w-4 h-4" /> Kembali ke Daftar Kursus
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Back Link & Navigation Breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to="/admin/courses"
          className="btn-brutal-white text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Daftar Kursus</span>
        </Link>

        <div className="flex items-center gap-3">
          <Link
            to={`/admin/courses/${course.id}/final-quiz`}
            className="btn-brutal bg-white hover:bg-retro-pink hover:text-white text-xs py-2 px-3 border-2 border-black"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Kuis Akhir Kursus (Final Quiz)</span>
          </Link>

          <button
            onClick={toggleCoursePublish}
            className={`badge-brutal text-xs py-1.5 px-3 cursor-pointer transition-all ${
              course.is_published
                ? 'bg-retro-green text-black hover:bg-[#00B975]'
                : 'bg-retro-yellow text-black hover:bg-retro-yellow-hover'
            }`}
          >
            {course.is_published ? (
              <>
                <ToggleRight className="w-4 h-4" />
                <span>✦ PUBLISHED</span>
              </>
            ) : (
              <>
                <ToggleLeft className="w-4 h-4" />
                <span>○ DRAFT</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Course Header Banner */}
      <div className="card-brutal bg-white p-6 sm:p-8 space-y-3">
        <div className="flex items-center gap-2 font-mono text-xs text-neutral-600">
          <span className="badge-brutal bg-black text-white">KURSUS #{course.order}</span>
          <span>ID: {course.id.slice(0, 8)}...</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black">
          {course.title}
        </h1>
        <p className="text-sm text-neutral-700 font-medium leading-relaxed max-w-3xl">
          {course.description || 'Kelola alur materi dan 5 aktivitas wajib untuk kursus ini.'}
        </p>
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

      {/* SubCourses Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black pb-4">
        <div>
          <h2 className="text-xl font-black text-black flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-retro-yellow" />
            Alur Sub-Materi (Sub-Courses)
          </h2>
          <p className="text-xs text-neutral-600 font-medium mt-0.5">
            Sesuai PRD Section 3: Setiap sub-materi memiliki 5 urutan aktivitas yang diselesaikan siswa secara linear.
          </p>
        </div>

        <button onClick={openAddSubCourseModal} className="btn-brutal-black text-xs py-2.5 px-4">
          <Plus className="w-4 h-4 text-retro-yellow" />
          <span>Tambah Sub-Materi</span>
        </button>
      </div>

      {/* SubCourses List */}
      {subcourses.length === 0 ? (
        <div className="card-brutal bg-white p-10 text-center space-y-3">
          <p className="text-base font-bold text-neutral-800">Belum ada sub-materi dalam kursus ini.</p>
          <p className="text-xs text-neutral-600 max-w-sm mx-auto">
            Tambahkan sub-materi pertama seperti "Variabel" untuk menyusun 5 aktivitas belajar.
          </p>
          <button onClick={openAddSubCourseModal} className="btn-brutal-yellow mx-auto text-xs">
            <Plus className="w-4 h-4" /> Tambah Sub-Materi Pertama
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {subcourses.map((subcourse, index) => (
            <div key={subcourse.id} className="card-brutal bg-white p-6 sm:p-8 space-y-6">
              {/* SubCourse Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-black/10 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-retro-yellow border-2 border-black shadow-brutal-sm flex items-center justify-center font-black text-base font-mono">
                    {subcourse.order}
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-black tracking-tight">
                      {subcourse.title}
                    </h3>
                    <p className="text-xs text-neutral-500 font-mono">
                      Sub-Course ID: {subcourse.id.slice(0, 8)}...
                    </p>
                  </div>
                </div>

                {/* SubCourse Actions */}
                <div className="flex items-center gap-1.5 self-end sm:self-auto">
                  <button
                    onClick={() => handleReorderSubCourse(subcourse, 'up')}
                    disabled={index === 0}
                    className="p-1.5 border-2 border-black rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                    title="Pindah ke atas"
                  >
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleReorderSubCourse(subcourse, 'down')}
                    disabled={index === subcourses.length - 1}
                    className="p-1.5 border-2 border-black rounded-lg hover:bg-neutral-100 disabled:opacity-30"
                    title="Pindah ke bawah"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => openEditSubCourseModal(subcourse)}
                    className="p-1.5 border-2 border-black rounded-lg hover:bg-neutral-100 ml-1"
                    title="Edit nama sub-materi"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setDeleteSubCourseId(subcourse.id)}
                    className="p-1.5 border-2 border-black rounded-lg hover:bg-retro-pink hover:text-white transition"
                    title="Hapus sub-materi"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Fixed 5 Activity Slots Grid */}
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-neutral-700">
                  <span>5 AKTIVITAS BELAJAR (URUTAN TETAP PRD):</span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    {subcourse.activities.length} / 5 Slot Terisi
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {ACTIVITY_SLOTS.map((slot) => {
                    const existingActivity = subcourse.activities.find((a) => a.type === slot.type)
                    const isConfigured = Boolean(
                      existingActivity &&
                        existingActivity.content_ref &&
                        Object.keys(existingActivity.content_ref).length > 0
                    )

                    const IconComponent = slot.icon

                    return (
                      <Link
                        key={slot.type}
                        to={`/admin/courses/${course.id}/subcourses/${subcourse.id}/activity/${slot.type}`}
                        className={`card-brutal p-4 flex flex-col justify-between space-y-3 hover:-translate-x-0.5 hover:-translate-y-0.5 transition-all text-left group ${
                          isConfigured ? 'bg-white' : 'bg-[#FAF7EE]'
                        }`}
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-1">
                            <span
                              className={`badge-brutal text-[10px] font-black ${slot.accentColor}`}
                            >
                              {slot.badgeLabel}
                            </span>

                            {isConfigured ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-retro-green bg-black px-1.5 py-0.5 rounded border border-black">
                                ✦ SIAP
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-neutral-600 bg-neutral-200 px-1.5 py-0.5 rounded">
                                ○ KOSONG
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-2 pt-1">
                            <div className="p-1.5 rounded-lg border-2 border-black bg-white group-hover:bg-retro-yellow transition">
                              <IconComponent className="w-4 h-4 text-black" />
                            </div>
                            <p className="font-bold text-xs text-black tracking-tight leading-snug">
                              {slot.label}
                            </p>
                          </div>

                          <p className="text-[11px] text-neutral-600 leading-tight">
                            {slot.description}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-neutral-800 group-hover:text-black">
                          <span>{isConfigured ? 'Ubah Konten' : 'Isi Konten'}</span>
                          <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform" />
                        </div>
                      </Link>
                    )
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit SubCourse Modal */}
      {isSubCourseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-md w-full p-6 space-y-5 shadow-brutal-xl">
            <div className="flex items-center justify-between border-b-2 border-black pb-3">
              <h3 className="text-lg font-black text-black">
                {editingSubCourse ? 'Edit Sub-Materi' : 'Tambah Sub-Materi Baru'}
              </h3>
              <button
                onClick={() => setIsSubCourseModalOpen(false)}
                className="p-1 border-2 border-black rounded-lg hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSubCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                  Judul Sub-Materi *
                </label>
                <input
                  type="text"
                  required
                  value={subCourseTitle}
                  onChange={(e) => setSubCourseTitle(e.target.value)}
                  placeholder="misal: Variabel"
                  className="input-brutal"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                  Urutan (Order)
                </label>
                <input
                  type="number"
                  min={1}
                  required
                  value={subCourseOrder}
                  onChange={(e) => setSubCourseOrder(parseInt(e.target.value) || 1)}
                  className="input-brutal font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsSubCourseModalOpen(false)}
                  className="btn-brutal-white text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSavingSubCourse}
                  className="btn-brutal-yellow text-xs"
                >
                  {isSavingSubCourse ? 'Menyimpan...' : editingSubCourse ? 'Simpan Perubahan' : 'Buat Sub-Materi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete SubCourse Confirmation Modal */}
      {deleteSubCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-md w-full p-6 space-y-4 shadow-brutal-xl">
            <h3 className="text-xl font-black text-black">Hapus Sub-Materi Ini?</h3>
            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              Semua 5 aktivitas belajar dan data kuis pada sub-materi ini akan ikut dihapus permanen.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
              <button
                onClick={() => setDeleteSubCourseId(null)}
                className="btn-brutal-white text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteSubCourse}
                disabled={isDeleting}
                className="btn-brutal-pink text-xs"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Sub-Materi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
