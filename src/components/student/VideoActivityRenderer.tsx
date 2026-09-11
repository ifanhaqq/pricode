import { Video, FileText, Sparkles, ShieldCheck } from 'lucide-react'

interface VideoActivityRendererProps {
  videoId?: string
  fallbackText?: string
  title?: string
}

export default function VideoActivityRenderer({
  videoId,
  fallbackText,
  title
}: VideoActivityRendererProps) {
  const embedUrl = videoId
    ? `https://www.youtube-nocookie.com/embed/${videoId}?rel=0&modestbranding=1`
    : null

  return (
    <div className="card-brutal bg-white p-6 sm:p-10 space-y-6 shadow-brutal-lg max-w-4xl mx-auto">
      {/* Activity Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-retro-green border-2 border-black flex items-center justify-center shadow-brutal-sm">
            <Video className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <span className="badge-brutal text-[10px] bg-retro-green text-black font-black">
              AKTIVITAS #2
            </span>
            <h2 className="text-lg font-black text-black">
              {title || 'Video Penjelasan Materi'}
            </h2>
          </div>
        </div>

        <span className="badge-brutal text-xs bg-[#FAF7EE] text-black border-2 border-black font-mono">
          🎥 VIDEO
        </span>
      </div>

      {/* Video Player */}
      {embedUrl ? (
        <div className="space-y-4">
          <div className="relative aspect-video w-full rounded-2xl border-3 border-black bg-black overflow-hidden shadow-brutal">
            <iframe
              src={embedUrl}
              title="Video Pembelajaran PRICODE"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="w-full h-full"
            />
          </div>

          <div className="flex items-center justify-between text-xs text-neutral-600 font-mono pt-1">
            <span className="flex items-center gap-1.5 font-bold">
              <ShieldCheck className="w-4 h-4 text-retro-green" />
              Mode Aman Siswa (youtube-nocookie.com)
            </span>
            <span className="text-[11px] font-mono">ID: {videoId}</span>
          </div>
        </div>
      ) : (
        <div className="card-brutal bg-[#FAF7EE] p-12 text-center space-y-3">
          <Video className="w-12 h-12 mx-auto text-neutral-400 stroke-1" />
          <p className="text-base font-black text-black">Video Belum Dikonfigurasi</p>
          <p className="text-xs text-neutral-600 max-w-md mx-auto">
            Video untuk sub-materi ini belum dimasukkan oleh guru. Silakan membaca rangkuman materi di bawah ini.
          </p>
        </div>
      )}

      {/* Fallback Text Summary (PRD Mandated) */}
      <div className="card-brutal bg-[#FAF7EE] border-2 border-black p-5 sm:p-6 space-y-3">
        <div className="flex items-center gap-2 border-b-2 border-black/10 pb-2">
          <FileText className="w-4 h-4 text-retro-pink" />
          <h3 className="text-xs font-black uppercase tracking-wider text-black font-mono">
            Rangkuman Materi Video (Teks Cadangan)
          </h3>
        </div>

        {fallbackText ? (
          <p className="text-xs sm:text-sm text-neutral-800 font-medium leading-relaxed">
            {fallbackText}
          </p>
        ) : (
          <p className="text-xs text-neutral-500 italic">
            Belum ada ringkasan teks cadangan yang dicantumkan untuk video ini.
          </p>
        )}

        <div className="pt-2 flex items-center gap-2 text-[11px] text-neutral-600 font-medium border-t border-black/10">
          <Sparkles className="w-3.5 h-3.5 text-retro-yellow flex-shrink-0" />
          <span>
            Jika video tidak dapat diputar di komputer sekolah, rangkuman teks di atas dapat kamu pelajari secara lengkap!
          </span>
        </div>
      </div>
    </div>
  )
}
