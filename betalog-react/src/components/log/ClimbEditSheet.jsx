import { X } from 'lucide-react'
import ClimbLogger from './ClimbLogger'

// ---------------------------------------------------------------------------
// ClimbEditSheet — the climb logger, in a sheet, seeded from a session
// ---------------------------------------------------------------------------

/**
 * Edits a climb session with the same form used to log one: discipline
 * buttons, grade chips, the four outcome buttons, the climb list, feel,
 * location, notes and date. It used to be its own three-dropdown form
 * (Climb / Grade / Result selects behind "+ Add climb") — a second way to say
 * the same thing, and the worse one (2026-09-13). The logger is mounted only
 * while the sheet is open, so it reseeds from the session on every open.
 *
 * @param {{
 *   session: import('../../lib/types').Session | null,
 *   open: boolean,
 *   onClose: () => void,
 *   onSaved: () => void,
 * }} props
 */
export default function ClimbEditSheet({ session, open, onClose, onSaved }) {
  if (!open || !session) return null

  return (
    <div className="fixed inset-0 z-[60] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      <div className="relative bg-white rounded-t-2xl flex flex-col" style={{ maxHeight: '92vh' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-[#e5e7ef] bg-white rounded-t-2xl shrink-0">
          <p className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}>
            Edit Session
          </p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Scrollable body — the logger carries its own side padding */}
        <div className="overflow-y-auto flex-1 pt-4">
          <ClimbLogger initialSession={session} onSaved={onSaved} />
        </div>
      </div>
    </div>
  )
}
