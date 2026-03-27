import { useState } from 'react'
import { X, Pencil, Trash2 } from 'lucide-react'
import useSessions from '../../hooks/useSessions'
import GymLogSheet from './GymLogSheet'
import ClimbEditSheet from './ClimbEditSheet'
import HangboardEditSheet from './HangboardEditSheet'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

var DIFFICULTY_LABEL = ['Easy', 'Moderate', 'Hard', 'Very Hard', 'Max']
var DIFFICULTY_COLOR = {
  1: { bg: '#dcfce7', color: '#16a34a' },
  2: { bg: '#fef9c3', color: '#a16207' },
  3: { bg: '#ffedd5', color: '#c2410c' },
  4: { bg: '#fee2e2', color: '#dc2626' },
  5: { bg: '#18181b', color: '#fff'    },
}
var OUTCOME_LABEL = {
  flashed: 'Flash',
  sent:    'Send',
  attempt: 'Attempt',
  project: 'Project',
}
var OUTCOME_COLOR = {
  flashed: '#2a9d5c',
  sent:    '#4f7ef8',
  attempt: '#7a8299',
  project: '#d4742a',
}

function formatDate(dateStr) {
  try {
    return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
  } catch (e) {
    return dateStr
  }
}

function SectionHeading({ children }) {
  return (
    <p
      className="text-[10px] font-bold text-[#bbbcc8] uppercase tracking-widest mb-2"
      style={{ fontFamily: "'Barlow Condensed', sans-serif" }}
    >
      {children}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Gym detail
// ---------------------------------------------------------------------------

function GymDetail({ session }) {
  var diff      = session.difficulty
  var diffStyle = DIFFICULTY_COLOR[diff] || DIFFICULTY_COLOR[3]

  return (
    <div className="flex flex-col gap-5">
      {/* Effort */}
      <div>
        <SectionHeading>Effort</SectionHeading>
        <span
          className="inline-flex items-center px-3 py-1 rounded-lg text-sm font-bold"
          style={{ background: diffStyle.bg, color: diffStyle.color, fontFamily: "'Barlow Condensed', sans-serif" }}
        >
          {diff} — {diff ? DIFFICULTY_LABEL[diff - 1] : '—'}
        </span>
      </div>

      {/* Exercises */}
      {session.exercises.length > 0 && (
        <div>
          <SectionHeading>Exercises</SectionHeading>
          <div className="flex flex-col gap-3">
            {session.exercises.map(function (se, i) {
              return (
                <div key={se.exerciseId + '-' + i} className="bg-[#f8f9fc] rounded-xl overflow-hidden border border-[#e5e7ef]">
                  <div className="px-3 py-2.5 border-b border-[#e5e7ef]">
                    <p className="text-sm font-semibold text-[#1a1d2e]">{se.name}</p>
                  </div>
                  <div className="px-3 pt-2 pb-1">
                    {/* Column headers */}
                    <div className="flex items-center gap-2 pb-1 text-[10px] font-bold text-[#bbbcc8] uppercase tracking-wide">
                      <span className="w-8 text-center">Set</span>
                      <span className="flex-1 text-center">{se.trackingType === 'time' ? 'Secs' : 'Reps'}</span>
                      <span className="w-20 text-center">Weight</span>
                    </div>
                    {se.sets.map(function (s, si) {
                      return (
                        <div key={si} className="flex items-center gap-2 py-1.5 border-t border-[#f0f1f5]">
                          <span className="w-8 text-xs font-bold text-[#7a8299] text-center shrink-0">{si + 1}</span>
                          <span className="flex-1 text-sm text-[#1a1d2e] text-center">{s.reps}</span>
                          <span className="w-20 text-sm text-center text-[#7a8299]">
                            {s.weight === 0 ? 'BW' : s.weight > 0 ? '+' + s.weight + ' kg' : s.weight + ' kg'}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Notes */}
      {session.notes ? (
        <div>
          <SectionHeading>Notes</SectionHeading>
          <p className="text-sm text-[#1a1d2e] leading-relaxed">{session.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Climb detail
// ---------------------------------------------------------------------------

function ClimbDetail({ session }) {
  return (
    <div className="flex flex-col gap-5">
      {session.location && (
        <p className="text-xs text-[#7a8299]">
          <span className="font-semibold">📍</span> {session.location}
        </p>
      )}
      {session.climbs.length > 0 ? (
        <div>
          <SectionHeading>Climbs</SectionHeading>
          <div className="bg-[#f8f9fc] rounded-xl overflow-hidden border border-[#e5e7ef]">
            {session.climbs.map(function (c, i) {
              return (
                <div key={c.id || i} className="flex items-center gap-3 px-3 py-2.5 border-b border-[#f0f1f5] last:border-0">
                  <span className="text-sm font-bold text-[#1a1d2e] w-12 shrink-0">{c.grade}</span>
                  <span className="flex-1 text-xs font-semibold" style={{ color: OUTCOME_COLOR[c.outcome] }}>
                    {OUTCOME_LABEL[c.outcome] || c.outcome}
                  </span>
                  {c.attempts > 1 && (
                    <span className="text-xs text-[#bbbcc8]">{c.attempts} att</span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#7a8299]">No climbs logged.</p>
      )}

      {session.notes ? (
        <div>
          <SectionHeading>Notes</SectionHeading>
          <p className="text-sm text-[#1a1d2e] leading-relaxed">{session.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Hangboard detail
// ---------------------------------------------------------------------------

function HangboardDetail({ session }) {
  return (
    <div className="flex flex-col gap-5">
      {session.hangGrips.length > 0 ? (
        <div>
          <SectionHeading>Grips</SectionHeading>
          <div className="flex flex-col gap-2">
            {session.hangGrips.map(function (g, i) {
              return (
                <div key={g.id || i} className="bg-[#f8f9fc] rounded-xl border border-[#e5e7ef] px-3 py-2.5">
                  <p className="text-sm font-semibold text-[#1a1d2e] mb-1">{g.gripName || g.grip}</p>
                  <p className="text-xs text-[#7a8299]">
                    {g.sets} sets × {g.reps} reps · {g.activeSecs}s on / {g.restSecs}s off
                    {g.weightKg > 0 ? ' · +' + g.weightKg + 'kg' : ''}
                    {g.weightMode === 'assisted' && g.weightKg > 0 ? ' (assisted)' : ''}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <p className="text-sm text-[#7a8299]">No grips logged.</p>
      )}

      {session.notes ? (
        <div>
          <SectionHeading>Notes</SectionHeading>
          <p className="text-sm text-[#1a1d2e] leading-relaxed">{session.notes}</p>
        </div>
      ) : null}
    </div>
  )
}

// ---------------------------------------------------------------------------
// SessionDetailSheet — public component
// ---------------------------------------------------------------------------

/**
 * @param {{ session: import('../../lib/types').Session | null, open: boolean, onClose: () => void }} props
 */
export default function SessionDetailSheet({ session, open, onClose }) {
  const { deleteSession } = useSessions()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editOpen, setEditOpen]           = useState(false)

  if (!open || !session) return null

  var heading = session.type === 'gym'
    ? (session.routineName || (session.exercises.length > 0 ? session.exercises[0].name : 'Gym session'))
    : session.type === 'hangboard'
      ? (session.routineName || 'Hangboard')
      : session.type === 'climb'
        ? ({ boulder: 'Bouldering', lead: 'Lead climbing', toprope: 'Top rope' }[session.discipline] || 'Climbing')
        : 'Session'

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    deleteSession(session.id)
    setConfirmDelete(false)
    onClose()
  }

  function handleEdit() {
    setEditOpen(true)
  }

  function handleEditSaved() {
    setEditOpen(false)
    onClose()
  }

  var canEdit = session.type === 'gym' || session.type === 'climb' || session.type === 'hangboard'

  return (
    <>
      <div className="fixed inset-0 z-50 flex flex-col justify-end">
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/40"
          onClick={function () { setConfirmDelete(false); onClose() }}
        />

        {/* Sheet */}
        <div
          className="relative bg-white rounded-t-2xl flex flex-col"
          style={{ maxHeight: '92vh' }}
        >
          {/* Header */}
          <div className="flex items-start justify-between px-4 py-4 border-b border-[#e5e7ef] shrink-0">
            <div>
              <p
                className="font-black text-[#1a1d2e] leading-tight"
                style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '20px' }}
              >
                {heading}
              </p>
              <p className="text-xs text-[#7a8299] mt-0.5">{formatDate(session.date)}</p>
            </div>
            <button
              onClick={function () { setConfirmDelete(false); onClose() }}
              className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors shrink-0"
            >
              <X size={20} />
            </button>
          </div>

          {/* Body — scrollable */}
          <div className="overflow-y-auto flex-1 px-4 py-4">
            {session.type === 'gym'       && <GymDetail       session={session} />}
            {session.type === 'climb'     && <ClimbDetail     session={session} />}
            {session.type === 'hangboard' && <HangboardDetail session={session} />}
          </div>

          {/* Footer */}
          <div className="shrink-0 border-t border-[#e5e7ef] bg-white px-4 pt-3 pb-6 flex gap-2">
            {/* Edit */}
            <button
              onClick={handleEdit}
              disabled={!canEdit}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
              style={canEdit
                ? { borderColor: '#e5e7ef', color: '#1a1d2e', background: '#f8f9fc' }
                : { borderColor: '#f0f1f5', color: '#bbbcc8', background: '#fafafa', cursor: 'not-allowed' }
              }
            >
              <Pencil size={14} />
              Edit
            </button>

            {/* Spacer */}
            <div className="flex-1" />

            {/* Delete */}
            <button
              onClick={handleDelete}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border text-sm font-semibold transition-colors"
              style={confirmDelete
                ? { background: '#e11d48', borderColor: '#e11d48', color: '#fff' }
                : { borderColor: '#fee2e2', color: '#e11d48', background: '#fff5f5' }
              }
            >
              <Trash2 size={14} />
              {confirmDelete ? 'Confirm delete' : 'Delete'}
            </button>
          </div>
        </div>
      </div>

      {/* Edit sheet — gym */}
      {session.type === 'gym' && (
        <GymLogSheet
          source={null}
          open={editOpen}
          onClose={function () { setEditOpen(false) }}
          onSaved={handleEditSaved}
          initialSession={session}
        />
      )}

      {/* Edit sheet — climb */}
      {session.type === 'climb' && (
        <ClimbEditSheet
          session={session}
          open={editOpen}
          onClose={function () { setEditOpen(false) }}
          onSaved={handleEditSaved}
        />
      )}

      {/* Edit sheet — hangboard */}
      {session.type === 'hangboard' && (
        <HangboardEditSheet
          session={session}
          open={editOpen}
          onClose={function () { setEditOpen(false) }}
          onSaved={handleEditSaved}
        />
      )}
    </>
  )
}
