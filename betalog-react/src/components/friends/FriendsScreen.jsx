import { useState, useMemo } from 'react'
import { X, ArrowLeft, Settings2, RefreshCw, Copy, Check, UserMinus, Flame, Mountain, Dumbbell } from 'lucide-react'
import useFriends from '../../hooks/useFriends'
import { LEVEL_COLOR, V_GRADES, FRENCH_GRADES, gradeColor } from '../../lib/stats'
import { buildPublicProfileWithBase } from '../../lib/goals'
import PyramidChart from '../ui/PyramidChart'
import { GradeChart, Legend } from '../dashboard/GradeChart'

var barlow = { fontFamily: "'Barlow Condensed', sans-serif" }
var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
function fmtDate(iso) { return iso.slice(8) + ' ' + MONTHS[parseInt(iso.slice(5, 7), 10) - 1] }

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

/**
 * The grade a profile says its owner owns. `base` since 2026-09-13 (Q3); a
 * profile published by an older build has no `base` key at all, and for those
 * the consistent grade it did publish is the honest fallback.
 */
function ownedGrade(stats) {
  if (!stats) return null
  return stats.base !== undefined ? stats.base : (stats.consistent || null)
}

/**
 * Days since a profile's last climb in a discipline, or null. The board marks a
 * row that has climbed within `ACTIVE_DAYS` — so a quiet friend reads as quiet.
 */
var ACTIVE_DAYS = 7
function daysSinceClimb(stats) {
  if (!stats || !stats.lastClimbedAt) return null
  var d = Math.floor((Date.now() - new Date(stats.lastClimbedAt + 'T00:00:00').getTime()) / 86400000)
  return d < 0 ? 0 : d
}

/**
 * Two boards, one question each (Ben, 2026-09-18: *"stoke competition between
 * friends on what they're climbing"*).
 *
 * - **level** — who climbs harder: the level word from the Base, then the Base
 *   grade, then the window's best. A base needs eight sends at one grade over
 *   180 days, so this order is fair and slow.
 * - **recent** — who is climbing hardest right now: the hardest send in the
 *   last 30 days, then how many sends. Plain counts, so the short window is
 *   honest, and it moves after every session — that is the point.
 *
 * A profile from an older build has no `recent` and sorts to the bottom of
 * that board rather than as a zero.
 */
function rankEntries(entries, discipline, board) {
  var gradeOrder = discipline === 'boulder' ? V_GRADES : FRENCH_GRADES
  function statsOf(e) { return discipline === 'boulder' ? e.boulderLevel : e.ropeLevel }
  function gradeIdx(g) { return g ? gradeOrder.indexOf(g) : -1 }

  if (board === 'recent') {
    return entries.slice().sort(function (a, b) {
      var ra = statsOf(a) && statsOf(a).recent, rb = statsOf(b) && statsOf(b).recent
      if (!ra || !rb) return (rb ? 1 : 0) - (ra ? 1 : 0)
      var ga = gradeIdx(ra.hardestSend), gb = gradeIdx(rb.hardestSend)
      if (gb !== ga) return gb - ga
      if (rb.sends !== ra.sends) return rb.sends - ra.sends
      return rb.sessions - ra.sessions
    })
  }

  return entries.slice().sort(function (a, b) {
    var aStats = statsOf(a), bStats = statsOf(b)
    var aRank = aStats && aStats.level ? (LEVEL_RANK[aStats.level] || 0) : 0
    var bRank = bStats && bStats.level ? (LEVEL_RANK[bStats.level] || 0) : 0
    if (bRank !== aRank) return bRank - aRank
    var d = gradeIdx(ownedGrade(bStats)) - gradeIdx(ownedGrade(aStats))
    if (d !== 0) return d
    return gradeIdx(bStats && bStats.project) - gradeIdx(aStats && aStats.project)
  })
}

// ---------------------------------------------------------------------------
// LeaderboardView
// ---------------------------------------------------------------------------

function LeaderboardView({ entries, discipline, onDisciplineChange, board, onBoardChange, onSelectPerson, onManage, onRefresh, onClose }) {
  var ranked = rankEntries(entries, discipline, board)
  var system = discipline === 'boulder' ? 'v' : 'french'

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3 shrink-0">
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '24px' }}>Friends</p>
        <div className="flex items-center gap-1">
          <button
            onClick={onRefresh}
            className="p-2 rounded-xl transition-colors"
            style={{ color: '#7a8299', background: 'rgba(0,0,0,0.05)' }}
            aria-label="Refresh"
          >
            <RefreshCw size={17} />
          </button>
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

      {/* Which board, and exactly what it ranks on — the window is always
          said, so no number on this screen is bare. */}
      <div className="px-4 mb-3 shrink-0">
        <div className="flex items-center gap-1 mb-1.5">
          {[
            { key: 'level',  label: 'Level' },
            { key: 'recent', label: 'Last 30 days' },
          ].map(function (b) {
            var active = board === b.key
            return (
              <button
                key={b.key}
                onClick={function () { onBoardChange(b.key) }}
                className="px-3 py-1 rounded-lg text-[11px] font-bold transition-colors"
                style={active
                  ? { background: '#1a1d2e', color: '#fff', ...barlow }
                  : { background: '#f4f5f9', color: '#7a8299', ...barlow }
                }
              >
                {b.label}
              </button>
            )
          })}
          <a
            href="/pyramid.html"
            target="_blank"
            rel="noopener"
            className="ml-auto shrink-0 text-[9px] font-bold"
            style={{ ...barlow, color: '#7a8299' }}
          >
            How this works ↗
          </a>
        </div>
        <p className="text-[10px] text-[#7a8299]" style={barlow}>
          {board === 'recent'
            ? 'Ranked on the hardest send in the last 30 days, then sends. Plain counts, no base needed.'
            : 'Ranked on the grade owned — Base, 8 sends at one grade in the last 180 days — then Best, the hardest send in that window.'}
        </p>
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
            var grade = ownedGrade(stats)
            var lc    = level ? (LEVEL_COLOR[level] || LEVEL_COLOR.Beginner) : null
            var recent = stats ? stats.recent : null
            var sinceClimb = daysSinceClimb(stats)
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
                  <div className="flex items-center gap-2 mt-0.5">
                    {person.streak > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Flame size={9} color="#ef4444" />
                        <span className="text-[10px] font-bold text-[#ef4444]" style={barlow}>{person.streak}w streak</span>
                      </span>
                    )}
                    {sinceClimb !== null && (
                      <span
                        className="text-[10px] font-bold"
                        style={{ ...barlow, color: sinceClimb <= ACTIVE_DAYS ? '#2a9d5c' : '#bbbcc8' }}
                      >
                        {sinceClimb === 0 ? 'climbed today' : sinceClimb === 1 ? 'climbed yesterday' : 'climbed ' + sinceClimb + 'd ago'}
                      </span>
                    )}
                  </div>
                </div>

                {/* The right-hand block answers the board's question and nothing else */}
                {board === 'recent' ? (
                  <div className="flex flex-col items-end shrink-0">
                    {recent && recent.hardestSend ? (
                      <>
                        <span className="text-[18px] font-black" style={{ ...barlow, color: gradeColor(recent.hardestSend, system), lineHeight: 1 }}>
                          {recent.hardestSend}
                        </span>
                        <span className="text-[9px] text-[#7a8299] mt-1" style={barlow}>
                          {recent.sends} {recent.sends === 1 ? 'send' : 'sends'} · {recent.sessions} {recent.sessions === 1 ? 'session' : 'sessions'}
                          {recent.flashes > 0 ? ' · ' + recent.flashes + ' flash' : ''}
                        </span>
                      </>
                    ) : recent ? (
                      <span className="text-[10px] text-[#bbbcc8]" style={barlow}>
                        {recent.sessions > 0 ? recent.sessions + (recent.sessions === 1 ? ' session' : ' sessions') + ', no sends' : 'nothing in 30 days'}
                      </span>
                    ) : (
                      <span className="text-[10px] text-[#bbbcc8]" style={barlow}>not shared yet</span>
                    )}
                  </div>
                ) : (
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
                      {(stats.project || stats.flash) && (
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {stats.project && (
                            <span className="text-[9px] text-[#7a8299]" style={barlow}>
                              Best <span style={{ color: gradeColor(stats.project, discipline === 'boulder' ? 'v' : 'french'), fontWeight: 900 }}>{stats.project}</span>
                            </span>
                          )}
                          {stats.flash && (
                            <span className="text-[9px] text-[#7a8299]" style={barlow}>
                              Flash <span style={{ color: gradeColor(stats.flash, discipline === 'boulder' ? 'v' : 'french'), fontWeight: 900 }}>{stats.flash}</span>
                            </span>
                          )}
                        </div>
                      )}
                    </>
                  ) : (
                    <span className="text-[10px] text-[#bbbcc8]" style={barlow}>no base yet</span>
                  )}
                </div>
                )}
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

var BAR_ACCENT = '#c0622a'

/**
 * One discipline on a friend's page. Reads the shape `buildPublicProfileWithBase`
 * publishes; a profile from an older build has no `pyramid` key and the card
 * says so rather than drawing nothing.
 */
function DisciplineCard({ label, stats, system, order }) {
  var lc = stats && stats.level ? (LEVEL_COLOR[stats.level] || LEVEL_COLOR.Beginner) : null
  var owned = ownedGrade(stats)
  var pyr = stats ? stats.pyramid : undefined
  var grades = stats && stats.grades ? stats.grades : null
  var hasBars = grades && Object.keys(grades).length > 0

  return (
    <div className="bg-white rounded-2xl border border-[#e5e7ef] p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <p className="text-[9px] font-bold text-[#7a8299] uppercase tracking-wide" style={barlow}>{label}</p>
        {pyr && pyr.basis && (
          <span className="text-[9px] text-[#bbbcc8] ml-auto" style={barlow}>{pyr.basis}</span>
        )}
      </div>

      {!stats ? (
        <p className="text-[11px] text-[#bbbcc8]" style={barlow}>No data</p>
      ) : (
        <>
          {/* Last 30 days — the competitive board's numbers, plain counts */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...barlow, color: '#bbbcc8' }}>Last 30 days</span>
          </div>
          {stats.recent ? (
            <div className="flex items-end gap-2 mb-3">
              {stats.recent.hardestSend ? (
                <>
                  <p className="font-black" style={{ ...barlow, fontSize: '20px', color: gradeColor(stats.recent.hardestSend, system), lineHeight: 1 }}>
                    {stats.recent.hardestSend}
                  </p>
                  <span className="text-[9px] text-[#7a8299]" style={barlow}>hardest send</span>
                </>
              ) : (
                <span className="text-[10px] font-bold" style={{ ...barlow, color: '#bbbcc8' }}>No sends</span>
              )}
              <span className="text-[9px] text-[#7a8299] ml-auto" style={barlow}>
                {stats.recent.sends} {stats.recent.sends === 1 ? 'send' : 'sends'} · {stats.recent.flashes} {stats.recent.flashes === 1 ? 'flash' : 'flashes'} · {stats.recent.sessions} {stats.recent.sessions === 1 ? 'session' : 'sessions'}
              </span>
            </div>
          ) : (
            <p className="text-[10px] text-[#bbbcc8] mb-3" style={barlow}>Not shared yet — their app needs to sync on the latest version</p>
          )}

          {/* Last 180 days — the pyramid window: level badge, the grade owned, best, flash */}
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...barlow, color: '#bbbcc8' }}>Last 180 days</span>
            <span className="text-[9px]" style={{ ...barlow, color: '#bbbcc8' }}>Base is the grade owned, 8 sends</span>
          </div>
          <div className="flex items-end gap-2 flex-wrap">
            {lc ? (
              <span
                className="inline-block text-[10px] font-black px-2 py-0.5 rounded-lg"
                style={{ ...barlow, background: lc.bg, color: lc.color }}
              >
                {stats.level}
              </span>
            ) : (
              <span className="text-[10px] font-bold" style={{ ...barlow, color: '#bbbcc8' }}>No base yet</span>
            )}
            {owned && (
              <p className="font-black" style={{ ...barlow, fontSize: '20px', color: lc ? lc.color : '#1a1d2e', lineHeight: 1 }}>
                {owned}
              </p>
            )}
            <div className="flex items-center gap-1.5 ml-auto">
              {stats.project && (
                <span className="text-[9px] text-[#7a8299]" style={barlow}>
                  Best <span style={{ color: gradeColor(stats.project, system), fontWeight: 900 }}>{stats.project}</span>
                </span>
              )}
              {stats.flash && (
                <span className="text-[9px] text-[#7a8299]" style={barlow}>
                  Flash <span style={{ color: gradeColor(stats.flash, system), fontWeight: 900 }}>{stats.flash}</span>
                </span>
              )}
            </div>
          </div>

          {/* The pyramid for the next rung up — what their Dashboard draws with no goal set */}
          {pyr === undefined ? (
            <p className="text-[10px] text-[#bbbcc8] mt-2" style={barlow}>
              Pyramid not shared yet — their app needs to sync on the latest version
            </p>
          ) : pyr.target && pyr.tiers && pyr.tiers.length > 0 ? (
            <div className="mt-3 pt-3 border-t border-[#f0f1f5]">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...barlow, color: '#bbbcc8' }}>
                  Base for {pyr.target}
                </span>
                {pyr.label && (
                  <span className="text-[10px] font-bold" style={{ ...barlow, color: BAR_ACCENT }}>{pyr.label}</span>
                )}
                <span className="text-[9px]" style={{ ...barlow, color: '#bbbcc8' }}>next up</span>
              </div>
              <PyramidChart tiers={pyr.tiers} gradeSystem={system} compact />
            </div>
          ) : null}

          {/* Attempts / sends / flashes per grade over the same window */}
          {hasBars && (
            <div className="mt-3 pt-3 border-t border-[#f0f1f5]">
              <span className="block text-[9px] font-bold tracking-widest uppercase mb-1.5" style={{ ...barlow, color: '#bbbcc8' }}>Per grade, last 180 days</span>
              <GradeChart gradeMap={grades} gradeOrder={order} accentColor={BAR_ACCENT} gradeSystem={system} />
              <Legend accentColor={BAR_ACCENT} />
            </div>
          )}

          {/* All time — the one figure that is, said as such */}
          {stats.allTimeBest && (
            <div className="mt-3 pt-3 border-t border-[#f0f1f5] flex items-center gap-1.5">
              <span className="text-[9px] font-bold tracking-widest uppercase" style={{ ...barlow, color: '#bbbcc8' }}>All time</span>
              <span className="text-[9px] text-[#7a8299]" style={barlow}>
                hardest send <span style={{ color: gradeColor(stats.allTimeBest, system), fontWeight: 900, fontSize: '12px' }}>{stats.allTimeBest}</span>
              </span>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DetailView({ person, onBack, onRemove }) {
  var [confirmRemove, setConfirmRemove] = useState(false)

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

  // One window, the pyramid's. There was an All Time / Last 90 Days toggle
  // here until 2026-09-18; "All Time" showed the 180-day overlay Q3 added and
  // "Last 90 Days" showed the retired consistent grade with no base, so the
  // big number changed meaning between tabs and neither label was true.
  var boulderStats = person.boulderLevel
  var ropeStats    = person.ropeLevel

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
        {/* Climbing — one card per discipline: the level, the window's
            readings, then the pyramid and grade bars the Dashboard draws,
            with the basis line the data-honesty spec asks for. */}
        <div className="flex flex-col gap-2 mb-4">
          {[
            { label: 'Boulder', stats: boulderStats, system: 'v',      order: V_GRADES },
            { label: 'Rope',    stats: ropeStats,    system: 'french', order: FRENCH_GRADES },
          ].map(function (d) {
            return <DisciplineCard key={d.label} label={d.label} stats={d.stats} system={d.system} order={d.order} />
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
                    <span className="text-[10px] text-[#bbbcc8] shrink-0" style={barlow}>{fmtDate(s.date)}</span>
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
  var { friendCode, codeExpired, codeExpiresAt, friends, error, generateNewCode, addFriend, removeFriend, refreshFriends } = useFriends(userId, open)

  var [view,       setView]       = useState('leaderboard')
  var [selected,   setSelected]   = useState(null)
  var [discipline, setDiscipline] = useState('boulder')
  var [board,      setBoard]      = useState('level')
  var [codeInput,  setCodeInput]  = useState('')
  var [copied,     setCopied]     = useState(false)
  var [adding,     setAdding]     = useState(false)
  var [addSuccess, setAddSuccess] = useState(false)
  var [generating, setGenerating] = useState(false)

  // My profile in the same shape as a friend entry
  var myProfile = useMemo(function () {
    var p = buildPublicProfileWithBase(data ? data.sessions || [] : [], data ? data.athleteProfile : null)
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
          board={board}
          onBoardChange={setBoard}
          onSelectPerson={function (p) { setSelected(p); setView('detail') }}
          onManage={function () { setView('manage') }}
          onRefresh={refreshFriends}
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
