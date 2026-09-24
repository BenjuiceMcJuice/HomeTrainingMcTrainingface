import { useState, useEffect } from 'react'
import { X, BookOpen, MessageSquarePlus, ExternalLink } from 'lucide-react'
import { barlow } from '../../lib/utils'
import { buildLines, runningCacheName } from '../../lib/buildInfo'

// The Help sheet — two choices and nothing else (betalog_help_and_feedback_spec.md §3.3).
// Opened from the HELP chip in the header. The guide is a static page, so it opens in a
// new tab; feedback is the shared Benjuicey widget already loaded by index.html.

var barlowText = { fontFamily: "'Barlow', sans-serif" }

function HelpRow({ icon, accent, title, body, external, onClick }) {
  var Icon = icon
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left flex items-center gap-3 p-4 rounded-2xl border border-[#e5e7ef] hover:bg-[#f8f9fc] transition-colors"
    >
      <span
        className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
        style={{ background: accent + '18', color: accent }}
      >
        <Icon size={22} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-bold text-[#1a1d2e]" style={{ ...barlow, fontSize: '18px', letterSpacing: '-0.2px' }}>
          {title}
        </span>
        <span className="block text-xs text-[#7a8299] mt-0.5 leading-snug" style={barlowText}>
          {body}
        </span>
      </span>
      {external && <ExternalLink size={16} className="text-[#bbbcc8] shrink-0" />}
    </button>
  )
}

export default function HelpSheet({ open, onClose }) {
  var [cacheName, setCacheName] = useState(null)

  useEffect(function () {
    if (!open) return
    var alive = true
    runningCacheName().then(function (n) { if (alive) setCacheName(n) })
    return function () { alive = false }
  }, [open])

  if (!open) return null

  function openGuide() {
    window.open('/help.html', '_blank', 'noopener')
    onClose()
  }

  function openFeedback() {
    if (window.BenjuiceyFeedback && window.BenjuiceyFeedback.open) window.BenjuiceyFeedback.open()
    onClose()
  }

  var lines = buildLines(cacheName)

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6 max-h-[85vh] overflow-y-auto overscroll-contain">
        <div className="flex items-center justify-between mb-4">
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>Help</p>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <HelpRow
            icon={BookOpen}
            accent="#4f7ef8"
            title="How BetaLog works"
            body="Every screen and feature, in plain words. Grades, goals and the pyramid included."
            external
            onClick={openGuide}
          />
          <HelpRow
            icon={MessageSquarePlus}
            accent="#2a9d5c"
            title="Send feedback"
            body="Found a bug? Want something added? Tell us — it takes a minute."
            onClick={openFeedback}
          />
        </div>

        <p className="text-[10px] text-[#bbbcc8] text-center mt-5" style={barlowText}>
          {lines.map(function (l, i) {
            return (
              <span key={l.label}>
                {i > 0 && ' · '}
                {l.label} <span className="font-bold text-[#7a8299]">{l.value}</span>
              </span>
            )
          })}
        </p>
      </div>
    </div>
  )
}
