import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Trophy, ChevronRight, Plus } from 'lucide-react'
import useCompetitions from '../../hooks/useCompetitions'
import { normaliseCode } from '../../lib/competition'
import { barlow } from '../../lib/utils'
import { Card, Eyebrow } from './CompLayout'
import { fmtCompDate } from '../../lib/compUi'

/**
 * /comp — Mine, Join, Organise (spec §9).
 */
export default function CompsHome() {
  var { mine, draft } = useCompetitions()
  var navigate = useNavigate()
  var [codeInput, setCodeInput] = useState('')
  var [codeError, setCodeError] = useState(null)

  function join(e) {
    if (e) e.preventDefault()
    var code = normaliseCode(codeInput)
    if (!code) { setCodeError('A code looks like CP-K7M2Q'); return }
    setCodeError(null)
    navigate('/comp/' + code)
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="font-black text-[#1a1d2e]" style={{ ...barlow, fontSize: '26px' }}>Competitions</p>
        <p className="text-xs text-[#7a8299]">A scoresheet on your phone instead of a card in your pocket.</p>
      </div>

      <Card>
        <Eyebrow>Join a competition</Eyebrow>
        <form onSubmit={join} className="flex gap-2">
          <input
            value={codeInput}
            onChange={function (e) { setCodeInput(e.target.value); setCodeError(null) }}
            placeholder="CP-K7M2Q"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            className="flex-1 px-3 py-2.5 rounded-xl border border-[#e5e7ef] bg-[#f8f9fc] font-black tracking-widest uppercase text-[#1a1d2e]"
            style={{ fontFamily: "'Courier New', monospace", fontSize: '15px' }}
          />
          <button type="submit" className="px-4 rounded-xl text-white font-bold text-sm" style={{ background: '#4f7ef8', ...barlow }}>
            Go
          </button>
        </form>
        {codeError && <p className="text-xs text-[#ef4444] mt-2">{codeError}</p>}
        <p className="text-[10px] text-[#bbbcc8] mt-2">The code is on the poster, or scan its QR code — that opens the comp straight away.</p>
      </Card>

      <Card>
        <Eyebrow>Organise</Eyebrow>
        <Link
          to="/comp/new"
          className="flex items-center gap-3 px-3 py-3 rounded-xl border border-dashed border-[#c9cfe3] text-[#4f7ef8] font-bold text-sm"
          style={barlow}
        >
          <Plus size={18} />
          {draft ? 'Resume your draft — ' + (draft.name || 'untitled') : 'Organise a competition'}
        </Link>
        <p className="text-[10px] text-[#bbbcc8] mt-2">Anyone can run one — a gym, a club, or four friends on a Saturday. Set the date, the venue and the scoresheet; entrants join by code.</p>
      </Card>

      <Card>
        <Eyebrow>Mine</Eyebrow>
        {mine.length === 0 ? (
          <p className="text-xs text-[#bbbcc8] text-center py-6">Nothing yet — join a comp with its code, or organise one.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[#f0f1f6]">
            {mine.map(function (r) {
              return (
                <Link key={r.code} to={'/comp/' + r.code} className="flex items-center gap-3 py-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ background: '#eef1ff', color: '#4f7ef8' }}>
                    <Trophy size={16} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-[#1a1d2e] truncate" style={barlow}>{r.name || r.code}</p>
                    <p className="text-[11px] text-[#7a8299] truncate">
                      {fmtCompDate(r.date)}{r.venueName ? ' · ' + r.venueName : ''}
                    </p>
                  </div>
                  {r.role === 'organiser' && (
                    <span className="text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ ...barlow, background: '#eef1ff', color: '#4f7ef8' }}>Organiser</span>
                  )}
                  <ChevronRight size={16} className="text-[#bbbcc8] shrink-0" />
                </Link>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}
