import { useState, useMemo } from 'react'
import { X, ArrowLeft, Settings2, Copy, Check, UserMinus, Flame, Mountain, Dumbbell } from 'lucide-react'
import useFriends from '../../hooks/useFriends'
import { LEVEL_COLOR, V_GRADES, FRENCH_GRADES, buildPublicProfile } from '../../lib/stats'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

var LEVEL_RANK = {
  'Beginner': 1, 'Intermediate': 2, 'Advanced': 3,
  'Expert': 4, 'Elite': 5, 'Pro': 6, 'World Class': 7,
}

var TYPE_ICON = {
  climb:     { icon: Mountain, color: '#c0622a' },
  gym:       { icon: Dumbbell, color: '#2a9d5c' },
  hangboard: { icon: Flame,    color: '#8b5cf6' },
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function rankEntries(entries, discipline) {
  var gradeOrder = discipline === 'boulder' ? V_GRADES : FRENCH_GRADES
  return entries.slice().sort(function (a, b) {
    var aStats = discipline === 'boulder' ? a.boulderLevel : a.ropeLevel
    var bStats = discipline === 'boulder' ? b.boulderLevel : b.ropeLevel
    var aRank = aStats && aStats.level ? (LEVEL_RANK[aStats.level] || 0) : 0
    var bRank = bStats && bStats.level ? (LEVEL_RANK[bStats.level] || 0) : 0
    if (bRank !== aRank) return bRank - aRank
    var aIdx = aStats && aStats.consistent ? gradeOrder.indexOf(aStats.consistent) : -1
    var bIdx = bStats && bStats.consistent ? gradeOrder.indexOf(bStats.consistent) : -1
    return bIdx - aIdx
  })
}

// ---------------------------------------------------------------------------
// LeaderboardView
// ---------------------------------------------------------------------------

function LeaderboardView({ entries, discipline, onDisciplineChange, onSelectPerson, onManage, onClose }) {
  var ranked = rankEntries(entries, discipline)

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '24px' }}>Friends</p>
        <div className="flex items-center gap-1">
          <button
            onClick={onManage}
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#7a8299', background: 'rgba(0,0,0,0.05)' }}
            aria-label="Manage friends"
          >
            <Settings2 size={18} />
          </button>
          <button
            onClick={onClose}
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#7a8299', background: 'rgba(0,0,0,0.05)' }}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>
      </div>

      {/* Discipline toggle */}
      <div className="px-4 mb-4 shrink-0">
        <div className="flex bg-[#eef1ff] rounded-xl p-1 gap-1">
          {[
            { key: 'boulder', label: 'Boulder' },
            { key: 'rope',    label: 'Rope' },
          ].map(function (d) {
            var active = discipline === d.key
            return (
              <button
                key={d.key}
                onClick={function () { onDisciplineChange(d.key) }}
                className="flex-1 py-2.5 rounded-lg font-bold transition-all"
                style={active
                  ? { background: '#fff', color: '#3730a3', ...barlow, fontSize: '14px', boxShadow: '0 1px 4px rgba(0,0,0,0.10)' }
                  : { color: '#7a8299', ...barlow, fontSize: '14px' }
                }
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Ranked list */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {ranked.length <= 1 && !ranked[0] && (
          <div className="text-center py-16">
            <p className="text-sm text-[#bbbcc8]">No friends yet</p>
            <p className="text-[11px] text-[#bbbcc8] mt-1">Tap the settings icon to add friends</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {ranked.map(function (person, idx) {
            var stats = discipline === 'boulder' ? person.boulderLevel : person.ropeLevel
            var level = stats ? stats.level : null
            var grade = stats ? stats.consistent : null
            var lc    = level ? (LEVEL_COLOR[level] || LEVEL_COLOR.Beginner) : null
            var rank  = idx + 1
            var medals = ['🥇', '🥈', '🥉']

            return (
              <button
                key={person.uid}
                onClick={function () { onSelectPerson(person) }}
                className="w-full text-left rounded-2xl px-4 flex items-center gap-3 transition-all active:scale-[0.98]"
                style={{
                  minHeight: '60px',
                  background:   person.isMe ? '#eef1ff' : '#fff',
                  border:       person.isMe ? '1.5px solid #c7d2fe' : '1.5px solid #e5e7ef',
                }}
              >
                {/* Rank */}
                <span
                  className="w-7 text-center shrink-0"
                  style={{ ...barlow, fontSize: rank <= 3 ? '20px' : '15px', fontWeight: 900, color: '#bbbcc8' }}
                >
                  {rank <= 3 ? medals[rank - 1] : rank}
                </span>

                {/* Avatar */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                  style={{ background: lc ? lc.bg : '#f4f5f9' }}
                >
                  <span className="font-black text-sm" style={{ ...barlow, color: lc ? lc.color : '#8892a4' }}>
                    {(person.displayName || '?').charAt(0).toUpperCase()}
                  </span>
                </div>

                {/* Name */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold text-[#1a1d2e]" style={{ ...barlow, fontSize: '15px' }}>
                      {person.displayName || 'Climber'}
                    </span>
                    {person.isMe && (
                      <span
                        className="text-[9px] font-black px-1.5 py-0.5 rounded-full"
                        style={{ background: '#c7d2fe', color: '#3730a3', ...barlow }}
                      >
                        YOU
                      </span>
                    )}
                  </div>
                  {person.streak > 0 && (
                    <div className="flex items-center gap-0.5 mt-0.5">
                      <Flame size={9} color="#ef4444" />
                      <span className="text-[10px] font-bold text-[#ef4444]" style={barlow}>{person.streak}w streak</span>
                    </div>
                  )}
                </div>

                {/* Level + grade */}
                <div className="flex flex-col items-end shrink-0">
                  {level && lc ? (
                    <>
                      <span
                        className="text-[10px] font-black px-2 py-0.5 rounded-lg"
                        style={{ ...barlow, background: lc.bg, color: lc.color }}
                      >
                        {level}
                      </span>
                      {grade && (
                        <span className="text-[12px] font-black mt-0.5" style={{ ...barlow, color: lc.color }}>
                          {grade}
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-[#bbbcc8]" style={barlow}>–</span>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// DetailView
// ---------------------------------------------------------------------------

function DetailView({ person, onBack, onRemove }) {
  var [confirmRemove, setConfirmRemove] = useState(false)

  var boulderLc = person.boulderLevel && person.boulderLevel.level
    ? (LEVEL_COLOR[person.boulderLevel.level] || LEVEL_COLOR.Beginner) : null
  var ropeLc = person.ropeLevel && person.ropeLevel.level
    ? (LEVEL_COLOR[person.ropeLevel.level] || LEVEL_COLOR.Beginner) : null

  var updatedText = ''
  if (person.updatedAt) {
    var diffDays = Math.floor((Date.now() - new Date(person.updatedAt).getTime()) / 86400000)
    if (diffDays === 0)      updatedText = 'Updated today'
    else if (diffDays === 1) updatedText = 'Updated yesterday'
    else                     updatedText = 'Updated ' + diffDays + 'd ago'
  }

  function handleRemove() {
    if (!confirmRemove) { setConfirmRemove(true); return }
    onRemove(person.uid)
    onBack()
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl transition-colors shrink-0"
          style={{ color: '#7a8299', background: 'rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={20} />
        </button>

        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ background: boulderLc ? boulderLc.bg : '#f4f5f9' }}
        >
          <span className="font-black" style={{ ...barlow, fontSize: '16px', color: boulderLc ? boulderLc.color : '#8892a4' }}>
            {(person.displayName || '?').charAt(0).toUpperCase()}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-black text-[#1a1d2e] truncate" style={{ ...barlow, fontSize: '18px' }}>
              {person.displayName || 'Climber'}
            </p>
            {person.isMe && (
              <span className="text-[9px] font-black px-1.5 py-0.5 rounded-full shrink-0" style={{ background: '#c7d2fe', color: '#3730a3', ...barlow }}>
                YOU
              </span>
            )}
          </div>
          {updatedText && <p className="text-[10px] text-[#bbbcc8]">{updatedText}</p>}
        </div>

        {!person.isMe && (
          <button
            onClick={handleRemove}
            className="p-2 rounded-xl transition-colors shrink-0"
            style={confirmRemove
              ? { background: '#fef2f2', color: '#ef4444' }
              : { color: '#bbbcc8' }
            }
            aria-label="Remove friend"
          >
            <UserMinus size={16} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {/* Level cards */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { label: 'Boulder', stats: person.boulderLevel, current: person.boulderCurrent, lc: boulderLc },
            { label: 'Rope',    stats: person.ropeLevel,    current: person.ropeCurrent,    lc: ropeLc },
          ].map(function (d) {
            return (
              <div key={d.label} className="bg-white rounded-2xl border border-[#e5e7ef] p-3">
                <p className="text-[9px] font-bold text-[#7a8299] uppercase tracking-wide mb-2" style={barlow}>{d.label}</p>
                {d.stats && d.lc ? (
                  <>
                    <span
                      className="inline-block text-[10px] font-black px-2 py-0.5 rounded-lg mb-1"
                      style={{ ...barlow, background: d.lc.bg, color: d.lc.color }}
                    >
                      {d.stats.level}
                    </span>
                    {d.stats.consistent && (
                      <p className="font-black" style={{ ...barlow, fontSize: '18px', color: d.lc.color, lineHeight: 1 }}>
                        {d.stats.consistent}
                      </p>
                    )}
                    {d.current && d.current.level && d.current.level !== d.stats.level && (
                      <p className="text-[9px] text-[#7a8299] mt-1" style={barlow}>
                        90d: <span style={{ color: d.lc.color, fontWeight: 700 }}>{d.current.level}</span>
                        {d.current.consistent && <span> · {d.current.consistent}</span>}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="text-[11px] text-[#bbbcc8]" style={barlow}>No data</p>
                )}
              </div>
            )
          })}
        </div>

        {/* Recent sessions */}
        {person.recentSessions && person.recentSessions.length > 0 ? (
          <>
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-2" style={barlow}>
              Recent Sessions
            </p>
            <div className="flex flex-col gap-2">
              {person.recentSessions.map(function (s, i) {
                var cfg  = TYPE_ICON[s.type] || TYPE_ICON.gym
                var Icon = cfg.icon
                return (
                  <div key={i} className="bg-white rounded-xl border border-[#e5e7ef] px-3 py-3 flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: cfg.color + '18' }}
                    >
                      <Icon size={14} color={cfg.color} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1a1d2e] truncate" style={barlow}>{s.headline}</p>
                      {s.discipline && (
                        <p className="text-[10px] text-[#7a8299] capitalize" style={barlow}>{s.discipline}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-[#bbbcc8] shrink-0" style={barlow}>{s.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <p className="text-xs text-[#bbbcc8] text-center py-8">No recent sessions</p>
        )}
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// ManageView — friend code + add friend
// ---------------------------------------------------------------------------

function ManageView({ friendCode, codeExpired, codeExpiresAt, error, generating, adding, addSuccess, codeInput, copied, onBack, onCopy, onGenerateCode, onCodeInputChange, onAdd }) {
  var expiryText = ''
  if (codeExpiresAt && !codeExpired) {
    var hoursLeft = Math.max(0, Math.ceil((new Date(codeExpiresAt).getTime() - Date.now()) / 3600000))
    expiryText = 'Expires in ' + hoursLeft + 'h'
  }

  return (
    <>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 shrink-0">
        <button
          onClick={onBack}
          className="p-2 rounded-xl transition-colors"
          style={{ color: '#7a8299', background: 'rgba(0,0,0,0.05)' }}
        >
          <ArrowLeft size={20} />
        </button>
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '20px' }}>Manage Friends</p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6">
        <div className="flex flex-col gap-3">

          {/* Your code */}
          <div className="bg-white rounded-2xl border border-[#e5e7ef] p-4">
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-3" style={barlow}>Your Friend Code</p>
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
                  onClick={onGenerateCode}
                  disabled={generating}
                  className="w-full py-3 rounded-xl text-white font-bold text-sm transition-colors"
                  style={{ background: generating ? '#7a8299' : '#4f7ef8', ...barlow }}
                >
                  {generating ? 'Generating…' : 'Generate New Code'}
                </button>
                <p className="text-[9px] text-[#bbbcc8] mt-1.5 text-center">Valid for 24 hours — share it with a friend</p>
              </div>
            ) : (
              <div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 px-3 py-2.5 rounded-xl bg-[#f8f9fc] border border-[#e5e7ef]">
                    <span className="font-black text-[#1a1d2e] tracking-widest" style={{ fontFamily: "'Courier New', monospace", fontSize: '15px' }}>
                      {friendCode}
                    </span>
                  </div>
                  <button
                    onClick={onCopy}
                    className="px-3 py-2.5 rounded-xl border text-xs font-bold transition-colors flex items-center gap-1.5"
                    style={copied
                      ? { background: '#ecfdf5', borderColor: '#0d9488', color: '#0d9488', ...barlow }
                      : { background: '#fff', borderColor: '#e5e7ef', color: '#7a8299', ...barlow }
                    }
                  >
                    {copied ? <Check size={13} /> : <Copy size={13} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <div className="flex items-center justify-between mt-1.5">
                  <p className="text-[9px] text-[#bbbcc8]">{expiryText}</p>
                  <button onClick={onGenerateCode} disabled={generating} className="text-[9px] font-bold text-[#4f7ef8]" style={barlow}>
                    New Code
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Add friend */}
          <div className="bg-white rounded-2xl border border-[#e5e7ef] p-4">
            <p className="text-[10px] font-bold text-[#7a8299] uppercase tracking-wide mb-3" style={barlow}>Add a Friend</p>
            <div className="flex gap-2">
              <input
                className="flex-1 px-3 py-2.5 rounded-xl border border-[#e5e7ef] text-sm text-[#1a1d2e] bg-white placeholder:text-[#bbbcc8] focus:outline-none focus:border-[#4f7ef8] transition-colors uppercase tracking-wider"
                value={codeInput}
                onChange={function (e) { onCodeInputChange(e.target.value) }}
                placeholder="BL-XXXXX-DDMMYY"
                maxLength={15}
                onKeyDown={function (e) { if (e.key === 'Enter') onAdd() }}
              />
              <button
                onClick={onAdd}
                disabled={adding || !codeInput.trim()}
                className="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-colors shrink-0"
                style={{ background: addSuccess ? '#2a9d5c' : adding ? '#7a8299' : '#4f7ef8', ...barlow }}
              >
                {addSuccess ? 'Added!' : adding ? '…' : 'Add'}
              </button>
            </div>
            {error && <p className="text-[10px] text-[#ef4444] mt-1.5" style={barlow}>{error}</p>}
          </div>

        </div>
      </div>
    </>
  )
}

// ---------------------------------------------------------------------------
// FriendsScreen
// ---------------------------------------------------------------------------

export default function FriendsScreen({ open, onClose, userId, data }) {
  var { friendCode, codeExpired, codeExpiresAt, friends, error, generateNewCode, addFriend, removeFriend } = useFriends(userId)

  var [view,       setView]       = useState('leaderboard')
  var [selected,   setSelected]   = useState(null)
  var [discipline, setDiscipline] = useState('boulder')
  var [codeInput,  setCodeInput]  = useState('')
  var [copied,     setCopied]     = useState(false)
  var [adding,     setAdding]     = useState(false)
  var [addSuccess, setAddSuccess] = useState(false)
  var [generating, setGenerating] = useState(false)

  // My profile in the same shape as a friend entry
  var myProfile = useMemo(function () {
    var p = buildPublicProfile(data ? data.sessions || [] : [], data ? data.athleteProfile : null)
    return Object.assign({}, p, { uid: userId, isMe: true })
  }, [data, userId])

  // Leaderboard: me + friends
  var entries = useMemo(function () {
    return [myProfile].concat(friends)
  }, [myProfile, friends])

  function handleCopy() {
    if (!friendCode || codeExpired) return
    function fallback() {
      var ta = document.createElement('textarea')
      ta.value = friendCode; ta.style.position = 'fixed'; ta.style.opacity = '0'
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta)
      setCopied(true); setTimeout(function () { setCopied(false) }, 1500)
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(friendCode).then(function () {
        setCopied(true); setTimeout(function () { setCopied(false) }, 1500)
      }).catch(fallback)
    } else { fallback() }
  }

  function handleGenerateCode() {
    if (generating) return
    setGenerating(true)
    generateNewCode().finally(function () { setGenerating(false) })
  }

  function handleAdd() {
    if (!codeInput.trim() || adding) return
    setAdding(true); setAddSuccess(false)
    addFriend(codeInput).then(function () {
      if (!error) { setCodeInput(''); setAddSuccess(true); setTimeout(function () { setAddSuccess(false) }, 2000) }
      setAdding(false)
    }).catch(function () { setAdding(false) })
  }

  function handleClose() {
    setView('leaderboard')
    onClose()
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col"
      style={{
        background:    '#f8f9fc',
        paddingTop:    'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft:   'env(safe-area-inset-left)',
        paddingRight:  'env(safe-area-inset-right)',
      }}
    >
      {view === 'leaderboard' && (
        <LeaderboardView
          entries={entries}
          discipline={discipline}
          onDisciplineChange={setDiscipline}
          onSelectPerson={function (p) { setSelected(p); setView('detail') }}
          onManage={function () { setView('manage') }}
          onClose={handleClose}
        />
      )}

      {view === 'detail' && selected && (
        <DetailView
          person={selected}
          onBack={function () { setView('leaderboard') }}
          onRemove={removeFriend}
        />
      )}

      {view === 'manage' && (
        <ManageView
          friendCode={friendCode}
          codeExpired={codeExpired}
          codeExpiresAt={codeExpiresAt}
          error={error}
          generating={generating}
          adding={adding}
          addSuccess={addSuccess}
          codeInput={codeInput}
          copied={copied}
          onBack={function () { setView('leaderboard') }}
          onCopy={handleCopy}
          onGenerateCode={handleGenerateCode}
          onCodeInputChange={setCodeInput}
          onAdd={handleAdd}
        />
      )}
    </div>
  )
}
