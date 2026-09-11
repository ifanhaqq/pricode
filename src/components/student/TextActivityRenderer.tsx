import React from 'react'
import { Sparkles, Code, BookOpen } from 'lucide-react'

interface TextActivityRendererProps {
  content: string
  title?: string
}

export default function TextActivityRenderer({ content, title }: TextActivityRendererProps) {
  // Helper to parse inline styles: **bold**, *italic*, and `inline code`
  const renderInlineStyles = (text: string) => {
    const parts: React.ReactNode[] = []
    let remaining = text
    let keyIdx = 0

    while (remaining.length > 0) {
      // Inline code: `code`
      const codeMatch = remaining.match(/^(.*?)`([^`]+)`(.*)$/)
      // Bold: **bold**
      const boldMatch = remaining.match(/^(.*?)\*\*([^*]+)\*\*(.*)$/)
      // Italic: *italic*
      const italicMatch = remaining.match(/^(.*?)\*([^*]+)\*(.*)$/)

      // Find which comes first
      const matches = [
        { type: 'code', match: codeMatch, index: codeMatch ? codeMatch[1].length : Infinity },
        { type: 'bold', match: boldMatch, index: boldMatch ? boldMatch[1].length : Infinity },
        { type: 'italic', match: italicMatch, index: italicMatch ? italicMatch[1].length : Infinity }
      ].sort((a, b) => a.index - b.index)

      const first = matches[0]

      if (first.match && first.index !== Infinity) {
        // Add preceding normal text
        if (first.match[1]) {
          parts.push(<span key={keyIdx++}>{first.match[1]}</span>)
        }

        if (first.type === 'code') {
          parts.push(
            <code
              key={keyIdx++}
              className="bg-black text-retro-green px-2 py-0.5 rounded border border-black font-mono text-xs font-bold"
            >
              {first.match[2]}
            </code>
          )
        } else if (first.type === 'bold') {
          parts.push(
            <strong key={keyIdx++} className="font-black text-black">
              {first.match[2]}
            </strong>
          )
        } else if (first.type === 'italic') {
          parts.push(
            <em key={keyIdx++} className="italic text-neutral-800">
              {first.match[2]}
            </em>
          )
        }

        remaining = first.match[3]
      } else {
        parts.push(<span key={keyIdx++}>{remaining}</span>)
        break
      }
    }

    return parts
  }

  // Parse lines into structured blocks
  const renderFormattedContent = () => {
    if (!content || !content.trim()) {
      return (
        <div className="card-brutal bg-[#FAF7EE] p-8 text-center text-neutral-500 font-medium">
          Materi bacaan belum tersedia untuk aktivitas ini.
        </div>
      )
    }

    const lines = content.split('\n')
    const blocks: React.ReactNode[] = []
    let inCodeBlock = false
    let codeBuffer: string[] = []
    let codeLang = ''

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]

      // Handle Code Blocks: ```lang ... ```
      if (line.startsWith('```')) {
        if (!inCodeBlock) {
          inCodeBlock = true
          codeLang = line.replace('```', '').trim() || 'javascript'
          codeBuffer = []
        } else {
          inCodeBlock = false
          blocks.push(
            <div
              key={`code-${i}`}
              className="my-5 card-brutal bg-[#1E1E1E] border-3 border-black p-5 shadow-brutal text-[#E0E0E0] overflow-hidden"
            >
              <div className="flex items-center justify-between text-xs text-neutral-400 font-mono pb-2.5 mb-3 border-b border-neutral-700">
                <span className="flex items-center gap-1.5 text-retro-yellow font-black">
                  <Code className="w-4 h-4" />
                  {codeLang.toUpperCase()}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-neutral-800 rounded text-neutral-300">
                  CONTOH KODE
                </span>
              </div>
              <pre className="font-mono text-xs sm:text-sm text-retro-green leading-relaxed overflow-x-auto whitespace-pre">
                <code>{codeBuffer.join('\n')}</code>
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

      // Handle Headers
      if (line.startsWith('# ')) {
        blocks.push(
          <h1
            key={`h1-${i}`}
            className="text-2xl sm:text-3xl font-black text-black tracking-tight font-heading mt-6 mb-3 first:mt-0 pb-2 border-b-2 border-black/15"
          >
            {line.replace('# ', '').trim()}
          </h1>
        )
      } else if (line.startsWith('## ')) {
        blocks.push(
          <h2
            key={`h2-${i}`}
            className="text-xl sm:text-2xl font-black text-black tracking-tight font-heading mt-5 mb-2.5"
          >
            {line.replace('## ', '').trim()}
          </h2>
        )
      } else if (line.startsWith('### ')) {
        blocks.push(
          <h3
            key={`h3-${i}`}
            className="text-lg font-black text-black tracking-tight font-heading mt-4 mb-2"
          >
            {line.replace('### ', '').trim()}
          </h3>
        )
      } else if (line.startsWith('> ') || line.startsWith('> 💡')) {
        // Blockquote / Tips Box
        const quoteText = line.replace(/^>\s*(💡)?\s*/, '').trim()
        blocks.push(
          <div
            key={`quote-${i}`}
            className="my-4 p-4 rounded-xl border-2 border-black bg-retro-yellow/20 text-black flex items-start gap-3 shadow-brutal-sm"
          >
            <Sparkles className="w-5 h-5 text-retro-pink flex-shrink-0 mt-0.5" />
            <div className="text-xs sm:text-sm leading-relaxed font-semibold">
              {renderInlineStyles(quoteText)}
            </div>
          </div>
        )
      } else if (line.startsWith('- ') || line.startsWith('* ')) {
        // Bullet List
        const bulletText = line.replace(/^[-*]\s+/, '').trim()
        blocks.push(
          <div key={`bullet-${i}`} className="flex items-start gap-2.5 my-1.5 ml-2 text-sm text-neutral-800">
            <span className="w-2 h-2 rounded-full bg-black mt-2 flex-shrink-0" />
            <span className="leading-relaxed">{renderInlineStyles(bulletText)}</span>
          </div>
        )
      } else if (line.trim().length === 0) {
        // Spacer
        blocks.push(<div key={`space-${i}`} className="h-2" />)
      } else {
        // Normal paragraph
        blocks.push(
          <p
            key={`p-${i}`}
            className="text-sm sm:text-base text-neutral-800 font-medium leading-relaxed my-2"
          >
            {renderInlineStyles(line)}
          </p>
        )
      }
    }

    return blocks
  }

  return (
    <div className="card-brutal bg-white p-6 sm:p-10 space-y-6 shadow-brutal-lg max-w-4xl mx-auto">
      {/* Header Info */}
      <div className="flex items-center justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-retro-yellow border-2 border-black flex items-center justify-center shadow-brutal-sm">
            <BookOpen className="w-5 h-5 text-black stroke-[2.5]" />
          </div>
          <div>
            <span className="badge-brutal text-[10px] bg-retro-yellow text-black font-black">
              AKTIVITAS #1
            </span>
            <h2 className="text-lg font-black text-black">
              {title || 'Materi Bacaan & Konsep'}
            </h2>
          </div>
        </div>

        <span className="badge-brutal text-xs bg-[#FAF7EE] text-black border-2 border-black font-mono">
          📖 BACAAN
        </span>
      </div>

      {/* Main Formatted Reading Content */}
      <div className="space-y-1">{renderFormattedContent()}</div>
    </div>
  )
}
