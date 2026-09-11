import { useState, useEffect, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { supabase } from '../../../lib/supabase'
import {
  ArrowLeft,
  Save,
  Code,
  Heading1,
  Heading2,
  Bold,
  Italic,
  CheckCircle2,
  AlertCircle,
  X,
  Sparkles,
  Info
} from 'lucide-react'

export default function TextActivityEditor() {
  const { courseId, subcourseId } = useParams<{ courseId: string; subcourseId: string }>()

  const [courseTitle, setCourseTitle] = useState('')
  const [subCourseTitle, setSubCourseTitle] = useState('')
  const [content, setContent] = useState('')
  const [activityId, setActivityId] = useState<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewTab, setPreviewTab] = useState<'split' | 'edit' | 'preview'>('split')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const fetchActivity = useCallback(async () => {
    if (!supabase || !courseId || !subcourseId) return
    setLoading(true)
    setErrorMessage(null)

    try {
      // 1. Fetch titles
      const { data: cData } = await supabase.from('courses').select('title').eq('id', courseId).single()
      if (cData) setCourseTitle(cData.title)

      const { data: scData } = await supabase.from('sub_courses').select('title').eq('id', subcourseId).single()
      if (scData) setSubCourseTitle(scData.title)

      // 2. Fetch or initialize activity
      const { data: actData } = await supabase
        .from('activities')
        .select('*')
        .eq('subcourse_id', subcourseId)
        .eq('type', 'text')
        .maybeSingle()

      if (actData) {
        setActivityId(actData.id)
        setContent((actData.content_ref as { text?: string })?.text || '')
      } else {
        // Default template for coding instruction
        setContent(
`# Mengenal Variabel dalam Coding

Variabel adalah tempat di dalam komputer untuk **menyimpan data atau informasi**, seperti kotak ajaib yang diberi label nama!

## Contoh Variabel di Kehidupan Nyata
Bayangkan kamu punya sebuah kotak pensil:
- Nama kotak: \`kotak_pensil\`
- Isinya: 5 buah pensil

## Contoh Kode Program
Berikut cara membuat variabel dalam bahasa pemrograman:

\`\`\`python
# Membuat variabel bernama skor
skor = 100
nama_pemain = "Budi"

# Menampilkan isi variabel
print("Skor kamu adalah:", skor)
\`\`\`

> 💡 **Ingat!** Nama variabel tidak boleh menggunakan spasi dan harus jelas maknanya.`
        )
      }
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal memuat data aktivitas.')
    } finally {
      setLoading(false)
    }
  }, [courseId, subcourseId])

  useEffect(() => {
    fetchActivity()
  }, [fetchActivity])

  const insertSnippet = (prefix: string, suffix: string = '') => {
    const textarea = document.getElementById('content-textarea') as HTMLTextAreaElement
    if (!textarea) return

    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = content.substring(start, end)
    const replacement = `${prefix}${selected || 'teks'}${suffix}`

    const newContent = content.substring(0, start) + replacement + content.substring(end)
    setContent(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + (selected.length || 4))
    }, 50)
  }

  const handleSave = async () => {
    if (!supabase || !subcourseId) return
    setSaving(true)
    setErrorMessage(null)
    setSuccessMessage(null)

    try {
      const payload = {
        subcourse_id: subcourseId,
        type: 'text',
        order: 1,
        content_ref: {
          text: content,
          format: 'markdown',
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

      setSuccessMessage('Aktivitas teks berhasil disimpan!')
    } catch (err: unknown) {
      const e = err as Error
      setErrorMessage(e.message || 'Gagal menyimpan konten teks.')
    } finally {
      setSaving(false)
    }
  }

  // Simple Markdown renderer for live preview
  const renderFormattedPreview = (raw: string) => {
    const lines = raw.split('\n')
    const elements: React.ReactNode[] = []
    let inCodeBlock = false
    let codeBuffer: string[] = []
    let codeLang = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Code block start/end
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLang = line.replace('```', '').trim() || 'code'
          codeBuffer = []
        } else {
          inCodeBlock = false
          elements.push(
            <div key={`code-${i}`} className="my-4 card-brutal bg-[#1E1E1E] text-[#E0E0E0] p-4 overflow-x-auto">
              <div className="flex items-center justify-between text-[11px] text-neutral-400 font-mono pb-2 mb-2 border-b border-neutral-700">
                <span>{codeLang.toUpperCase()}</span>
                <span>KODE PROGRAM</span>
              </div>
              <pre className="font-mono text-xs leading-relaxed text-[#56B6C2]">
                {codeBuffer.join('\n')}
              </pre>
            </div>
          )
        }
        continue
      }

      if (inCodeBlock) {
        codeBuffer.push(line)
        continue
      }

      // Headings
      if (line.startsWith('# ')) {
        elements.push(
          <h1 key={i} className="text-2xl sm:text-3xl font-black tracking-tight text-black mt-6 mb-3 border-b-2 border-black pb-2">
            {line.replace('# ', '')}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        elements.push(
          <h2 key={i} className="text-xl sm:text-2xl font-black text-black mt-5 mb-2">
            {line.replace('## ', '')}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        elements.push(
          <h3 key={i} className="text-lg font-bold text-black mt-4 mb-1">
            {line.replace('### ', '')}
          </h3>
        )
      } else if (line.startsWith('> ')) {
        elements.push(
          <div key={i} className="my-3 p-3.5 card-brutal bg-retro-yellow border-2 border-black text-xs font-semibold text-black leading-relaxed">
            {line.replace('> ', '')}
          </div>
        )
      } else if (line.startsWith('- ')) {
        elements.push(
          <li key={i} className="ml-5 list-disc text-xs sm:text-sm text-neutral-800 my-1 font-medium">
            {line.replace('- ', '')}
          </li>
        )
      } else if (line.trim() === '') {
        elements.push(<div key={i} className="h-2" />)
      } else {
        // Paragraph with basic inline code handling
        elements.push(
          <p key={i} className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed my-1.5">
            {line}
          </p>
        )
      }
    }

    return elements
  }

  if (loading) {
    return (
      <div className="card-brutal p-16 text-center space-y-3">
        <div className="w-10 h-10 border-4 border-black border-t-retro-yellow rounded-full animate-spin mx-auto" />
        <p className="font-bold text-sm">Memuat editor materi teks...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          to={`/admin/courses/${courseId}`}
          className="btn-brutal-white text-xs py-2 px-3 inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Kembali ke {subCourseTitle || 'Sub-Materi'}</span>
        </Link>

        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-white border-2 border-black rounded-lg p-1 shadow-brutal-sm">
            <button
              type="button"
              onClick={() => setPreviewTab('edit')}
              className={`px-3 py-1 text-xs font-bold rounded ${
                previewTab === 'edit' ? 'bg-black text-white' : 'hover:bg-neutral-100'
              }`}
            >
              Editor Saja
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('split')}
              className={`px-3 py-1 text-xs font-bold rounded ${
                previewTab === 'split' ? 'bg-black text-white' : 'hover:bg-neutral-100'
              }`}
            >
              Split View
            </button>
            <button
              type="button"
              onClick={() => setPreviewTab('preview')}
              className={`px-3 py-1 text-xs font-bold rounded ${
                previewTab === 'preview' ? 'bg-black text-white' : 'hover:bg-neutral-100'
              }`}
            >
              Pratinjau Siswa
            </button>
          </div>

          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-brutal-green text-xs py-2 px-4 inline-flex items-center gap-2"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Konten Teks'}</span>
          </button>
        </div>
      </div>

      {/* Breadcrumb Info Card */}
      <div className="card-brutal bg-white p-5 flex items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 font-mono text-xs">
            <span className="badge-brutal bg-retro-yellow text-black font-bold">AKTIVITAS 1</span>
            <span className="text-neutral-500">{courseTitle} &gt; {subCourseTitle}</span>
          </div>
          <h1 className="text-xl font-black text-black">
            Editor Teks &amp; Konsep Pemrograman
          </h1>
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

      {/* Editor & Preview Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Editor with Markdown Toolbar */}
        {(previewTab === 'split' || previewTab === 'edit') && (
          <div className="card-brutal bg-white p-5 space-y-3 flex flex-col">
            {/* Formatting Toolbar */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 bg-[#FAF7EE] border-2 border-black rounded-lg">
              <button
                type="button"
                onClick={() => insertSnippet('# ')}
                className="p-1.5 hover:bg-neutral-200 rounded text-xs font-bold"
                title="Heading 1"
              >
                <Heading1 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('## ')}
                className="p-1.5 hover:bg-neutral-200 rounded text-xs font-bold"
                title="Heading 2"
              >
                <Heading2 className="w-4 h-4" />
              </button>
              <div className="h-4 w-[2px] bg-black/20 mx-1" />
              <button
                type="button"
                onClick={() => insertSnippet('**', '**')}
                className="p-1.5 hover:bg-neutral-200 rounded"
                title="Tebal (Bold)"
              >
                <Bold className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('*', '*')}
                className="p-1.5 hover:bg-neutral-200 rounded"
                title="Miring (Italic)"
              >
                <Italic className="w-4 h-4" />
              </button>
              <div className="h-4 w-[2px] bg-black/20 mx-1" />
              <button
                type="button"
                onClick={() => insertSnippet('`', '`')}
                className="p-1.5 hover:bg-neutral-200 rounded text-xs font-mono font-bold"
                title="Inline Code"
              >
                &lt;code&gt;
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('\n```python\n# Masukkan kode kamu di sini\n', '\n```\n')}
                className="px-2 py-1 bg-retro-yellow hover:bg-retro-yellow-hover border-2 border-black rounded text-[11px] font-bold inline-flex items-center gap-1 shadow-brutal-sm"
                title="Sisipkan Blok Kode (Syntax Highlighted)"
              >
                <Code className="w-3.5 h-3.5" />
                <span>Blok Kode</span>
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('> 💡 **Tips:** ')}
                className="px-2 py-1 bg-white hover:bg-neutral-100 border-2 border-black rounded text-[11px] font-bold inline-flex items-center gap-1 shadow-brutal-sm"
                title="Kotak Tips / Catatan Penting"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Tips</span>
              </button>
            </div>

            {/* Content Textarea */}
            <textarea
              id="content-textarea"
              rows={22}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Tulis materi pembelajaran coding di sini..."
              className="w-full flex-1 input-brutal font-mono text-xs leading-relaxed resize-y p-4"
            />

            <p className="text-[11px] text-neutral-500 font-mono">
              Tips: Gunakan triple backticks (```python) untuk menampilkan kotak kode berwarna.
            </p>
          </div>
        )}

        {/* Right: Live Preview */}
        {(previewTab === 'split' || previewTab === 'preview') && (
          <div className="card-brutal bg-[#FAF7EE] p-6 sm:p-8 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex items-center justify-between border-b-2 border-black pb-3 mb-4">
                <span className="badge-brutal bg-black text-white font-mono text-[10px]">
                  PRATINJAU TAMPILAN SISWA
                </span>
                <span className="text-xs font-bold text-neutral-500">
                  {content.length} karakter
                </span>
              </div>

              <div className="prose max-w-none">
                {renderFormattedPreview(content)}
              </div>
            </div>

            <div className="pt-4 border-t-2 border-black/10 flex items-center gap-2 text-xs text-neutral-600 font-medium">
              <Info className="w-4 h-4 text-black shrink-0" />
              <span>Pratinjau ini mencerminkan tampilan yang akan dibaca oleh siswa di portal belajar.</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
