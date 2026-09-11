import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  ArrowLeft,
  Video,
  Save,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  X,
  FileText,
  Info
} from 'lucide-react'

export default function VideoActivityEditor() {
  const { courseId, subcourseId } = useParams<{ courseId: string; subcourseId: string }>()

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [rawUrl, setRawUrl] = useState('')
  const [videoId, setVideoId] = useState<string | null>(null)
  const [fallbackText, setFallbackText] = useState('')
  const [activityId, setActivityId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  // Function to extract and validate YouTube video ID
  const extractVideoId = (inputUrl: string): string | null => {
    const trimmed = inputUrl.trim()
    if (!trimmed) return null

    // If direct 11-char ID
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
      return trimmed
    }

    // Standard YouTube URL formats
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/
    const match = trimmed.match(regExp)
    return match && match[2].length === 11 ? match[2] : null
  }

  const handleUrlChange = (val: string) => {
    setRawUrl(val)
    const extracted = extractVideoId(val)
    setVideoId(extracted)
  }

  const fetchActivity = useCallback(async () => {
    if (!supabase || !courseId || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      const { data: cData } = await supabase.from('courses').select('title').eq('id', courseId).single()
      if (cData) setCourseTitle(cData.title)

      const { data: scData } = await supabase.from('sub_courses').select('title').eq('id', subcourseId).single()
      if (scData) setSubCourseTitle(scData.title)

      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .eq('type', 'video')
        .maybeSingle()

      if (actData && actData.content_ref) {
        setActivityId(actData.id)
        const ref = actData.content_ref as {
          video_id?: string
          url?: string
          fallback_text?: string
        }
        if (ref.video_id) {
          setVideoId(ref.video_id)
          setRawUrl(`https://www.youtube.com/watch?v=${ref.video_id}`)
        } else if (ref.url) {
          setRawUrl(ref.url)
          setVideoId(extractVideoId(ref.url))
        }
        setFallbackText(ref.fallback_text || '')
      } else {
        // Default example for initial demonstration
        const sampleUrl = 'https://www.youtube.com/watch?v=kqtD5dpn9C8'
        setRawUrl(sampleUrl)
        setVideoId('kqtD5dpn9C8')
        setFallbackText(
          'Pada video ini, siswa mempelajari analogi variabel seperti kotak berlabel yang menyimpan nilai dalam memori komputer. Jika video tidak dapat diputar karena pemblokiran jaringan sekolah, silakan lanjutkan ke aktivitas interaktif berikutnya.'
        )
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat data aktivitas video.')
    } finally {
      setLoading(false)
    }
  }, [courseId, subcourseId])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supabase || !subcourseId) return

    if (!videoId) {
      setErrorMessage('Masukkan tautan YouTube yang valid (video ID tidak ditemukan).')
      return
    }

    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      // Strictly construct youtube-nocookie embed URL as mandated by PRD
      const embedUrl = `https://www.youtube-nocookie.com/embed/${videoId}`

      const payload = {
        subcourse_id: subcourseId,
        type: 'video',
        order: 2,
        content_ref: {
          video_id: videoId,
          embed_url: embedUrl,
          fallback_text: fallbackText.trim(),
          original_url: rawUrl.trim(),
          updated_at: new Date().toISOString()
        }
      }

      if (activityId) {
        const { error } = await supabase
          .from('activities')
          .update(payload)
          .eq('id', activityId)
        if (error) throw error
      } else {
        const { data, error } = await supabase
          .from('activities')
          .insert(payload)
          .select()
          .single()
        if (error) throw error
        if (data) setActivityId(data.id)
      }

      setSuccessMessage('Aktivitas video YouTube berhasil disimpan!')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan aktivitas video.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="card-brutal p-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-black border-t-retro-pink rounded-full animate-spin mx-auto" />
        <p className="font-bold text-sm">Memuat editor video...</p>
      </div>
    )
  }

  const embedUrl = videoId ? `https://www.youtube-nocookie.com/embed/${videoId}` : null

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
          className="btn-brutal-pink text-xs py-2 px-4 inline-flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          <span>{saving ? 'Menyimpan...' : 'Simpan Konten Video'}</span>
        </button>
      </div>

      {/* Header Info Banner */}
      <div className="card-brutal bg-white p-5 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="badge-brutal bg-retro-pink text-white font-bold">AKTIVITAS 2</span>
            <span className="text-neutral-500">{courseTitle} &gt; {subCourseTitle}</span>
          </div>
          <h1 className="text-xl font-black text-black">
            Editor Video Tutorial YouTube (Privacy-Compliant)
          </h1>
        </div>

        <div className="hidden sm:flex items-center gap-1.5 badge-brutal bg-retro-green text-black text-[11px] py-1">
          <ShieldCheck className="w-4 h-4" />
          <span>youtube-nocookie.com</span>
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

      {/* Main Form & Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input Form */}
        <form onSubmit={handleSave} className="card-brutal bg-white p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-black uppercase tracking-wider">
              Tautan / URL Video YouTube *
            </label>
            <input
              type="text"
              required
              value={rawUrl}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="https://www.youtube.com/watch?v=kqtD5dpn9C8 atau https://youtu.be/..."
              className="input-brutal font-mono text-xs"
            />
            {videoId ? (
              <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 pt-1 font-mono">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Video ID terdeteksi: <span className="bg-neutral-100 px-1.5 py-0.5 border border-black rounded">{videoId}</span>
              </p>
            ) : rawUrl ? (
              <p className="text-[11px] text-rose-600 font-bold flex items-center gap-1 pt-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Format URL YouTube tidak dikenali. Pastikan memasukkan tautan YouTube yang benar.
              </p>
            ) : null}
          </div>

          {/* Privacy Note Box */}
          <div className="p-3.5 card-brutal bg-[#FAF7EE] space-y-1 text-xs text-neutral-800">
            <p className="font-bold flex items-center gap-1.5 text-black">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              Kepatuhan Privasi PRD (Anak Usia SD)
            </p>
            <p className="text-[11px] text-neutral-600 leading-relaxed">
              Sesuai spesifikasi PRD Section 4.2: URL otomatis diubah dan disimpan sebagai domain <code className="font-bold text-black">youtube-nocookie.com</code> guna mencegah pelacakan dan iklan bertarget pada perangkat siswa.
            </p>
          </div>

          {/* Fallback Text Description */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-black uppercase tracking-wider">
                Deskripsi Cadangan (Fallback Description) *
              </label>
              <span className="text-[10px] font-bold text-neutral-500 font-mono">Wajib PRD</span>
            </div>
            <textarea
              rows={5}
              required
              value={fallbackText}
              onChange={(e) => setFallbackText(e.target.value)}
              placeholder="Tulis ringkasan penjelasan video ini. Jika YouTube diblokir oleh filter jaringan sekolah, teks ini akan dibaca siswa agar materi tidak macet..."
              className="input-brutal resize-none text-xs leading-relaxed"
            />
            <p className="text-[11px] text-neutral-500 italic">
              Mitigasi PRD: Memastikan siswa tetap bisa belajar jika akses YouTube di sekolah terblokir firewall.
            </p>
          </div>

          <button
            type="submit"
            disabled={saving || !videoId}
            className="btn-brutal-pink w-full text-xs py-3 mt-4"
          >
            {saving ? 'Menyimpan...' : 'Simpan & Validasi Video'}
          </button>
        </form>

        {/* Right: Live Embed Preview */}
        <div className="card-brutal bg-[#FAF7EE] p-6 flex flex-col justify-between space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b-2 border-black pb-2">
              <span className="badge-brutal bg-black text-white font-mono text-[10px]">
                PRATINJAU VIDEO EMBED (NO-COOKIE)
              </span>
              <span className="text-xs font-bold text-neutral-600 font-mono">
                {videoId || 'NO VIDEO'}
              </span>
            </div>

            {embedUrl ? (
              <div className="space-y-3">
                <div className="relative aspect-video w-full rounded-xl border-2 border-black bg-black overflow-hidden shadow-brutal">
                  <iframe
                    src={embedUrl}
                    title="Pratinjau Video Pembelajaran"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                    className="w-full h-full"
                  />
                </div>

                <div className="p-3 bg-white border-2 border-black rounded-lg text-xs space-y-1">
                  <p className="font-bold text-black flex items-center gap-1.5 text-[11px]">
                    <FileText className="w-3.5 h-3.5 text-retro-pink" />
                    Pratinjau Teks Cadangan untuk Siswa:
                  </p>
                  <p className="text-neutral-700 text-xs leading-relaxed">
                    {fallbackText || '(Belum ada teks cadangan diisi)'}
                  </p>
                </div>
              </div>
            ) : (
              <div className="aspect-video w-full rounded-xl border-2 border-dashed border-black/30 bg-neutral-100 flex flex-col items-center justify-center text-center p-6 text-neutral-500">
                <Video className="w-10 h-10 mb-2 opacity-40 text-black" />
                <p className="font-bold text-xs text-black">Pratinjau Video Belum Tersedia</p>
                <p className="text-[11px]">Masukkan tautan YouTube di sebelah kiri untuk melihat pemutar video.</p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t-2 border-black/10 flex items-center gap-2 text-xs text-neutral-600 font-medium">
            <Info className="w-4 h-4 text-black shrink-0" />
            <span>Tampilan pemutar video ini akan langsung diuji oleh siswa saat membuka Aktivitas 2.</span>
          </div>
        </div>
      </div>
    </div>
  )
}
