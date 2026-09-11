import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import {
  BookOpen,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  Layers,
  Sparkles,
  ToggleLeft,
  ToggleRight,
  HelpCircle,
  ArrowRight
} from 'lucide-react'

interface CourseItem {
  id: string
  title: string
  order: number
  description: string | null
  is_published: boolean
  created_at: string
  sub_courses_count?: number
}

export default function CourseListPage() {
  const [courses, setCourses] = useState<CourseItem[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Create/Edit Modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCourse, setEditingCourse] = useState<CourseItem | null>(null)
  const [title, setTitle] = useState('')
  const [order, setOrder] = useState(1)
  const [description, setDescription] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Delete confirmation modal state
  const [deleteCourseId, setDeleteCourseId] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const fetchCourses = useCallback(async () => {
    if (!supabase) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch courses
      const { data: coursesData, error: coursesError } = await supabase
        .from('courses')
        .select('*')
        .order('order', { ascending: true })

      if (coursesError) throw coursesError

      // 2. Fetch subcourses count for each course
      const { data: subcoursesData } = await supabase
        .from('sub_courses')
        .select('id, course_id')

      const countsMap: Record<string, number> = {}
      if (subcoursesData) {
        for (const sc of subcoursesData) {
          countsMap[sc.course_id] = (countsMap[sc.course_id] || 0) + 1
        }
      }

      const combined: CourseItem[] = (coursesData || []).map((c) => ({
        ...c,
        is_published: c.is_published ?? true,
        sub_courses_count: countsMap[c.id] || 0
      }))

      setCourses(combined)
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat daftar kursus.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCourses()
  }, [fetchCourses])

  const openCreateModal = () => {
    setEditingCourse(null)
    setTitle('')
    setOrder(courses.length + 1)
    setDescription('')
    setIsPublished(false)
    setIsModalOpen(true)
    setErrorMessage(null)
  }

  const openEditModal = (course: CourseItem) => {
    setEditingCourse(course)
    setTitle(course.title)
    setOrder(course.order)
    setDescription(course.description || '')
    setIsPublished(course.is_published)
    setIsModalOpen(true)
    setErrorMessage(null)
  }

  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase) return
    setIsSaving(true)
    setErrorMessage(null)

    try {
      if (editingCourse) {
        // Update
        const payload: Record<string, unknown> = {
          title: title.trim(),
          order,
          description: description.trim() || null,
          is_published: isPublished
        }
        let { error } = await supabase
          .from('courses')
          .update(payload)
          .eq('id', editingCourse.id)

        if (error && error.message?.includes('is_published')) {
          delete payload.is_published
          const retry = await supabase.from('courses').update(payload).eq('id', editingCourse.id)
          error = retry.error
        }

        if (error) throw error
        setSuccessMessage(`Kursus "${title}" berhasil diperbarui!`)
      } else {
        // Create
        const payload: Record<string, unknown> = {
          title: title.trim(),
          order,
          description: description.trim() || null,
          is_published: isPublished
        }
        let { data: newCourse, error } = await supabase
          .from('courses')
          .insert(payload)
          .select()
          .single()

        if (error && error.message?.includes('is_published')) {
          delete payload.is_published
          const retry = await supabase.from('courses').insert(payload).select().single()
          newCourse = retry.data
          error = retry.error
        }

        if (error) throw error

        // Also ensure final quiz record is initialized
        if (newCourse) {
          await supabase
            .from('final_quizzes')
            .insert({
              course_id: newCourse.id,
              title: `Kuis Akhir ${title}`
            })
            .select()
        }

        setSuccessMessage(`Kursus "${title}" berhasil dibuat!`)
      }

      setIsModalOpen(false)
      await fetchCourses()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan kursus.')
    } finally {
      setIsSaving(false)
    }
  }

  const togglePublishStatus = async (course: CourseItem) => {
    if (!supabase) return
    const newStatus = !course.is_published

    try {
      const { error } = await supabase
        .from('courses')
        .update({ is_published: newStatus })
        .eq('id', course.id)

      if (error) {
        if (error.message?.includes('is_published')) {
          throw new Error('Fitur Publish membutuhkan migrasi database. Harap jalankan perintah dari file supabase/cms-schema.sql di SQL Editor Supabase.')
        }
        throw error
      }

      setCourses((prev) =>
        prev.map((c) => (c.id === course.id ? { ...c, is_published: newStatus } : c))
      )
      setSuccessMessage(
        `Status kursus "${course.title}" diubah menjadi: ${
          newStatus ? 'DITERBITKAN (PUBLISHED)' : 'DRAF (DRAFT)'
        }`
      )
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal mengubah status publikasi.')
    }
  }

  const handleDeleteCourse = async () => {
    if (!supabase || !deleteCourseId) return
    setIsDeleting(true)

    try {
      const { error } = await supabase
        .from('courses')
        .delete()
        .eq('id', deleteCourseId)

      if (error) throw error

      setSuccessMessage('Kursus berhasil dihapus.')
      setDeleteCourseId(null)
      await fetchCourses()
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menghapus kursus.')
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="card-brutal bg-retro-yellow p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="space-y-2 relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 border-2 border-black rounded-full bg-white text-xs font-bold shadow-brutal-sm">
            <Sparkles className="w-3.5 h-3.5 text-black" />
            Kurikulum Coding SD
          </div>
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-black">
            Authoring Kursus & Materi
          </h1>
          <p className="text-sm font-medium text-neutral-800 leading-relaxed">
            Kelola hierarki pembelajaran <span className="font-bold">Course → Sub-Course → 5 Aktivitas Belajar</span>. Kontrol draf kursus agar tersembunyi hingga siap dipelajari siswa.
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="btn-brutal-black shrink-0 text-sm px-5 py-3"
        >
          <Plus className="w-5 h-5 text-retro-yellow" />
          <span>Tambah Kursus Baru</span>
        </button>
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

      {/* Course Cards Grid */}
      {loading ? (
        <div className="card-brutal p-16 text-center space-y-3">
          <div className="w-10 h-10 border-4 border-black border-t-retro-yellow rounded-full animate-spin mx-auto" />
          <p className="font-bold text-sm">Memuat kurikulum kursus...</p>
        </div>
      ) : courses.length === 0 ? (
        <div className="card-brutal bg-white p-12 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-retro-yellow border-2 border-black shadow-brutal flex items-center justify-center mx-auto">
            <BookOpen className="w-8 h-8 text-black" />
          </div>
          <h3 className="text-xl font-bold">Belum Ada Kursus Dibuat</h3>
          <p className="text-sm text-neutral-600 max-w-md mx-auto">
            Mulai dengan membuat kursus pertama seperti "Logika Pemrograman" untuk menyusun materi dan kuis.
          </p>
          <button onClick={openCreateModal} className="btn-brutal-yellow mx-auto">
            <Plus className="w-4 h-4" /> Buat Kursus Pertama
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {courses.map((course) => (
            <div
              key={course.id}
              className="card-brutal bg-white p-6 flex flex-col justify-between space-y-6 hover:shadow-brutal-lg transition-all"
            >
              {/* Card Header & Publish Toggle */}
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="badge-brutal bg-black text-white font-mono text-xs">
                      #{course.order}
                    </span>
                    <span className="badge-brutal bg-white text-black font-semibold text-xs">
                      <Layers className="w-3.5 h-3.5" />
                      {course.sub_courses_count} Sub-Materi
                    </span>
                  </div>

                  {/* High-Contrast Publish/Draft Toggle */}
                  <button
                    onClick={() => togglePublishStatus(course)}
                    className={`badge-brutal cursor-pointer transition-all active:translate-x-0.5 active:translate-y-0.5 ${
                      course.is_published
                        ? 'bg-retro-green text-black hover:bg-[#00B975]'
                        : 'bg-retro-yellow text-black hover:bg-retro-yellow-hover'
                    }`}
                    title="Klik untuk mengubah status terbit"
                  >
                    {course.is_published ? (
                      <>
                        <ToggleRight className="w-4 h-4 text-black" />
                        <span>✦ TERBIT (PUBLISHED)</span>
                      </>
                    ) : (
                      <>
                        <ToggleLeft className="w-4 h-4 text-black" />
                        <span>○ DRAF (TERSEMBUNYI)</span>
                      </>
                    )}
                  </button>
                </div>

                <div>
                  <h2 className="text-2xl font-black text-black tracking-tight mb-1.5">
                    {course.title}
                  </h2>
                  <p className="text-xs text-neutral-600 font-medium line-clamp-2 leading-relaxed">
                    {course.description || 'Tidak ada deskripsi kursus.'}
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t-2 border-black/10">
                <div className="flex items-center gap-2">
                  <Link
                    to={`/admin/courses/${course.id}`}
                    className="btn-brutal-yellow flex-1 text-xs py-2.5"
                  >
                    <BookOpen className="w-4 h-4" />
                    <span>Buka Sub-Materi</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>

                  <Link
                    to={`/admin/courses/${course.id}/final-quiz`}
                    className="btn-brutal-white px-3 text-xs py-2.5 border-2 border-black"
                    title="Kelola Soal Kuis Akhir Kursus (Final Quiz)"
                  >
                    <HelpCircle className="w-4 h-4 text-retro-pink" />
                    <span className="hidden sm:inline font-bold">Kuis Akhir</span>
                  </Link>

                  <button
                    onClick={() => openEditModal(course)}
                    className="btn-brutal-white px-2.5 py-2.5"
                    title="Edit Informasi Kursus"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => setDeleteCourseId(course.id)}
                    className="btn-brutal bg-white hover:bg-retro-pink text-black hover:text-white px-2.5 py-2.5"
                    title="Hapus Kursus"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                {!course.is_published && (
                  <p className="text-[11px] text-neutral-500 italic text-center font-medium">
                    ⚠️ Kursus ini berstatus draf dan tersembunyi dari akun siswa.
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create / Edit Course Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-brutal-xl">
            <div className="flex items-center justify-between border-b-2 border-black pb-4">
              <h2 className="text-xl font-black text-black flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-retro-yellow bg-black p-1 rounded-md" />
                {editingCourse ? 'Edit Informasi Kursus' : 'Tambah Kursus Baru'}
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 border-2 border-black rounded-lg hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourse} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                  Judul Kursus *
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="misal: Logika Pemrograman"
                  className="input-brutal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Urutan Tampil (Order)
                  </label>
                  <input
                    type="number"
                    min={1}
                    required
                    value={order}
                    onChange={(e) => setOrder(parseInt(e.target.value) || 1)}
                    className="input-brutal font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                    Status Publikasi
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsPublished(!isPublished)}
                    className={`w-full py-2.5 px-3 border-2 border-black rounded-lg text-xs font-bold flex items-center justify-center gap-2 shadow-[2px_2px_0px_#000] ${
                      isPublished ? 'bg-retro-green text-black' : 'bg-retro-yellow text-black'
                    }`}
                  >
                    {isPublished ? '✦ PUBLISHED' : '○ DRAFT'}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-black uppercase tracking-wider mb-1.5">
                  Deskripsi Kursus
                </label>
                <textarea
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ringkasan materi dan target capaian belajar siswa..."
                  className="input-brutal resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t-2 border-black">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-brutal-white text-xs"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="btn-brutal-yellow text-xs"
                >
                  {isSaving ? 'Menyimpan...' : editingCourse ? 'Simpan Perubahan' : 'Buat Kursus'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteCourseId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fade-in">
          <div className="card-brutal bg-white max-w-md w-full p-6 space-y-4 shadow-brutal-xl">
            <h3 className="text-xl font-black text-black">Hapus Kursus Ini?</h3>
            <p className="text-xs text-neutral-700 leading-relaxed font-medium">
              Semua sub-materi, aktivitas belajar (teks, video, blok kode), dan kuis di dalam kursus ini akan ikut terhapus. Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black">
              <button
                onClick={() => setDeleteCourseId(null)}
                className="btn-brutal-white text-xs"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteCourse}
                disabled={isDeleting}
                className="btn-brutal-pink text-xs"
              >
                {isDeleting ? 'Menghapus...' : 'Ya, Hapus Kursus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
