import { useState } from 'react'
import { X, Copy, Check, UserMinus, Flame, Mountain, Dumbbell } from 'lucide-react'
import useFriends from '../../hooks/useFriends'
import { LEVEL_COLOR, gradeColor } from '../../lib/stats'

var barlow   = { fontFamily: "'Barlow Condensed', sans-serif" }
var labelCls = 'text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-1'
var inputCls = 'w-full px-2.5 py-1.5 rounded-lg border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors'

// ---------------------------------------------------------------------------
// Session type config
// ---------------------------------------------------------------------------

var TYPE_ICON = {
  climb: { icon: Mountain, color: '#c0622a' },
  gym:   { icon: Dumbbell, color: '#2a9d5c' },
  hangboard: { icon: Flame, color: '#8b5cf6' },
}

// ---------------------------------------------------------------------------
// Friend card
// ---------------------------------------------------------------------------

function FriendCard({ friend, onRemove }) {
  var [confirmRemove, setConfirmRemove] = useState(false)

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return }
    onRemove(friend.uid)
  }

  // Determine grade system per discipline
  function sys(disc) { return disc === 'boulder' ? 'v' : 'french' }

  // Compact grade with level colour
  function ColorGrade({ grade, system }) {
    if (!grade) return null
    return (
      <span className="text-[11px] font-black" style={{ ...barlow, color: gradeColor(grade, system) }}>
        {grade}
      </span>
    )
  }

  // Level row: always shows peak and current (90d) side by side
  function LevelRow({ label, peak, current, system }) {
    if (!peak && !current) return null
    var peakLc = peak && peak.level ? (LEVEL_COLOR[peak.level] || LEVEL_COLOR.Beginner) : null
    var currentLc = current && current.level ? (LEVEL_COLOR[current.level] || LEVEL_COLOR.Beginner) : null
    // Use peak as fallback for current if no 90d data
    var show90 = current || peak

    return (
      <div className="flex items-center justify-between gap-1">
        <div className="flex items-center gap-1 min-w-0">
          <span className="text-[9px] font-bold text-[#7a8299] uppercase w-11 shrink-0" style={barlow}>{label}</span>
          {peak && peakLc && (
            <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ ...barlow, background: peakLc.bg, color: peakLc.color }}>
              {peak.level}
            </span>
          )}
          {peak && <ColorGrade grade={peak.consistent} system={system} />}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[8px] text-[#bbbcc8]" style={barlow}>90d</span>
          {show90 && (currentLc || peakLc) && (
            <span className="text-[8px] font-black px-1 py-0.5 rounded" style={{ ...barlow, background: (currentLc || peakLc).bg, color: (currentLc || peakLc).color }}>
              {(current && current.level) || (peak && peak.level)}
            </span>
          )}
          <ColorGrade grade={(current && current.consistent) || (peak && peak.consistent)} system={system} />
        </div>
      </div>
    )
  }

  // Days since updated
  var updatedText = ''
  if (friend.updatedAt) {
    var diffMs = Date.now() - new Date(friend.updatedAt).getTime()
    var diffDays = Math.floor(diffMs / 86400000)
    if (diffDays === 0) updatedText = 'Updated today'
    else if (diffDays === 1) updatedText = 'Updated yesterday'
    else updatedText = 'Updated ' + diffDays + 'd ago'
  }

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7ef] px-3 py-3">
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#4f7ef8] flex items-center justify-center shrink-0">
            <span className="text-white font-black text-sm" style={barlow}>
              {(friend.displayName || '?').charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-sm font-bold text-[#1a1d2e]" style={barlow}>{friend.displayName || 'Climber'}</p>
            {friend.streak > 0 && (
              <div className="flex items-center gap-0.5">
                <Flame size={10} className="text-[#ef4444]" />
                <span className="text-[10px] font-bold text-[#ef4444]" style={barlow}>{friend.streak}w streak</span>
              </div>
            )}
          </div>
        </div>
        <button
          onClick={handleRemove}
          className="p-1.5 rounded-lg transition-colors"
          style={confirmRemove
            ? { background: '#fef2f2', color: '#ef4444' }
            : { color: '#bbbcc8' }
          }
        >
          <UserMinus size={14} />
        </button>
      </div>

      {/* Levels + Recent sessions — side by side */}
      <div className="flex gap-3">
        {/* Left: levels (peak + current) */}
        <div className="flex flex-col gap-1 flex-1 min-w-0">
          <LevelRow label="Boulder" peak={friend.boulderLevel} current={friend.boulderCurrent} system="v" />
          <LevelRow label="Rope" peak={friend.ropeLevel} current={friend.ropeCurrent} system="french" />
          {!friend.boulderLevel && !friend.ropeLevel && (
            <p className="text-[10px] text-[#bbbcc8]">No climbing data yet</p>
          )}
        </div>

        {/* Right: last 3 sessions */}
        {friend.recentSessions && friend.recentSessions.length > 0 && (
          <div className="flex flex-col gap-0.5 shrink-0">
            {friend.recentSessions.slice(0, 3).map(function (s, i) {
              var cfg = TYPE_ICON[s.type] || TYPE_ICON.gym
              var Icon = cfg.icon
              return (
                <div key={i} className="flex items-center gap-1 justify-end">
                  <Icon size={9} style={{ color: cfg.color }} />
                  <span className="text-[9px] text-[#7a8299]" style={barlow}>{s.date.slice(5)}</span>
                  <span className="text-[9px] text-[#1a1d2e] font-semibold" style={barlow}>{s.headline}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Updated timestamp */}
      {updatedText && (
        <p className="text-[8px] text-[#bbbcc8] mt-1.5">{updatedText}</p>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// FriendsSheet
// ---------------------------------------------------------------------------

export default function FriendsSheet({ open, onClose, userId }) {
  var { friendCode, codeExpired, codeExpiresAt, friends, loading, error, generateNewCode, addFriend, removeFriend } = useFriends(userId)
  var [codeInput, setCodeInput] = useState('')
  var [copied, setCopied]       = useState(false)
  var [adding, setAdding]       = useState(false)
  var [addSuccess, setAddSuccess] = useState(false)
  var [generating, setGenerating] = useState(false)

  function handleCopy() {
    if (!friendCode || codeExpired) return
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(friendCode).then(function () {
        setCopied(true)
        setTimeout(function () { setCopied(false) }, 1500)
      }).catch(fallbackCopy)
    } else {
      fallbackCopy()
    }
    function fallbackCopy() {
      var ta = document.createElement('textarea')
      ta.value = friendCode
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
      setCopied(true)
      setTimeout(function () { setCopied(false) }, 1500)
    }
  }

  function handleGenerateCode() {
    if (generating) return
    setGenerating(true)
    generateNewCode().finally(function () { setGenerating(false) })
  }

  function handleAdd() {
    if (!codeInput.trim() || adding) return
    setAdding(true)
    setAddSuccess(false)
    addFriend(codeInput).then(function () {
      if (!error) {
        setCodeInput('')
        setAddSuccess(true)
        setTimeout(function () { setAddSuccess(false) }, 2000)
      }
      setAdding(false)
    }).catch(function () {
      setAdding(false)
    })
  }

  // Time remaining text
  var expiryText = ''
  if (codeExpiresAt && !codeExpired) {
    var hoursLeft = Math.max(0, Math.ceil((new Date(codeExpiresAt).getTime() - Date.now()) / 3600000))
    expiryText = 'Expires in ' + hoursLeft + 'h'
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[80] flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl px-4 pt-4 pb-6 max-h-[85vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>Friends</p>
          <button onClick={onClose} className="p-2 rounded-xl text-[#7a8299] hover:bg-[#f4f5f9] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Your code */}
          <div>
            <p className={labelCls} style={barlow}>Your Friend Code</p>
            {!friendCode || codeExpired ? (
              <div>
                {friendCode && codeExpired && (
                  <div className="flex items-center gap-2 mb-2 px-3 py-2 rounded-lg bg-[#f8f9fc] border border-[#e5e7ef]">
                    <span className="text-sm font-black text-[#bbbcc8] tracking-widest line-through" style={{ fontFamily: "'Courier New', monospace" }}>
                      {friendCode}
                    </span>
                    <span className="text-[9px] font-bold text-[#ef4444]" style={barlow}>Expired</span>
                  </div>
                )}
                <button
                  onClick={handleGenerateCode}
                  disabled={generating}
                  className="w-full py-2.5 rounded-xl text-white font-bold text-sm transition-colors"
                  style={{ background: generating ? '#7a8299' : '#4f7ef8', ...barlow }}
                >
                  {generating ? 'Generating...' : 'Generate New Code'}
                </button>
                <p className="text-[9px] text-[#bbbcc8] mt-1">Generates a code valid for 24 hours</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2 rounded-lg bg-[#f8f9fc] border border-[#e5e7ef]">
                    <span className="text-base font-black text-[#1a1d2e] tracking-widest" style={{ fontFamily: "'Courier New', monospace" }}>
                      {friendCode}
                    </span>
                  </div>
                  <button
                    onClick={handleCopy}
                    className="px-3 py-2 rounded-lg border border-[#e5e7ef] text-xs font-bold transition-colors flex items-center gap-1"
                    style={copied
                      ? { background: '#ecfdf5', borderColor: '#0d9488', color: '#0d9488', ...barlow }
                      : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
                    }
                  >
                    {copied ? <Check size={12} /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-[9px] text-[#bbbcc8]">Share this code — {expiryText}</p>
                  <button
                    onClick={handleGenerateCode}
                    disabled={generating}
                    className="text-[9px] font-bold text-[#4f7ef8]"
                    style={barlow}
                  >
                    New Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add friend */}
          <div>
            <p className={labelCls} style={barlow}>Add a Friend</p>
            <div className="flex gap-1.5">
              <input
                className={inputCls + ' flex-1 text-xs uppercase tracking-wider'}
                value={codeInput}
                onChange={function (e) { setCodeInput(e.target.value) }}
                placeholder="BL-XXXXX-DDMMYY"
                maxLength={15}
                onKeyDown={function (e) { if (e.key === 'Enter') handleAdd() }}
              />
              <button
                onClick={handleAdd}
                disabled={adding || !codeInput.trim()}
                className="px-4 py-1.5 rounded-lg text-xs font-bold text-white transition-colors shrink-0"
                style={{
                  background: addSuccess ? '#2a9d5c' : adding ? '#7a8299' : '#4f7ef8',
                  ...barlow,
                }}
              >
                {addSuccess ? 'Added!' : adding ? '...' : 'Add'}
              </button>
            </div>
            {error && <p className="text-[10px] text-[#ef4444] mt-1" style={barlow}>{error}</p>}
          </div>

          {/* Friends list */}
          <div className="border-t border-[#e5e7ef] pt-3 mt-1">
            <p className={labelCls} style={barlow}>
              {friends.length > 0 ? friends.length + ' Friend' + (friends.length !== 1 ? 's' : '') : 'Friends'}
            </p>

            {loading && (
              <p className="text-xs text-[#7a8299] text-center py-4">Loading...</p>
            )}

            {!loading && friends.length === 0 && (
              <div className="text-center py-6">
                <p className="text-xs text-[#bbbcc8]">No friends added yet</p>
                <p className="text-[10px] text-[#bbbcc8] mt-1">Share your code or enter a friend's code above</p>
              </div>
            )}

            <div className="flex flex-col gap-2">
              {friends.map(function (f) {
                return <FriendCard key={f.uid} friend={f} onRemove={removeFriend} />
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
