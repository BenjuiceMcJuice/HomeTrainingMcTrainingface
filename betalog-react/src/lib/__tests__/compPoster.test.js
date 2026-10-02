import { describe, it, expect } from 'vitest'
import qrcode from 'qrcode-generator'
import { compPosterPdf, wrapText, textWidth } from '../compPoster'

function modulesFor(value) {
  var qr = qrcode(0, 'M')
  qr.addData(value)
  qr.make()
  var n = qr.getModuleCount()
  var rows = []
  for (var r = 0; r < n; r++) { var row = []; for (var c = 0; c < n; c++) row.push(qr.isDark(r, c)); rows.push(row) }
  return rows
}

function asText(bytes) { return Array.from(bytes, b => String.fromCharCode(b)).join('') }

var URL = 'https://betalog.co.uk/comp/CP-WUHSL'
var base = { name: 'Autumn Bloc Party', code: 'CP-WUHSL', url: URL, lines: ['Boulder · Sat 18 Oct 2026', 'Flashpoint Bristol'], modules: modulesFor(URL) }

describe('compPosterPdf', () => {
  it('is a one-page PDF with the name, the code and the link', () => {
    var s = asText(compPosterPdf(base))
    expect(s.startsWith('%PDF-1.4')).toBe(true)
    expect(s.trimEnd().endsWith('%%EOF')).toBe(true)
    expect(s).toContain('/Count 1')
    expect(s).toContain('(Autumn Bloc Party) Tj')
    expect(s).toContain('(CP-WUHSL) Tj')
    expect(s).toContain('(' + URL + ') Tj')
  })

  it('has an xref table whose offsets point at each object', () => {
    var s = asText(compPosterPdf(base))
    var start = Number(s.match(/startxref\n(\d+)/)[1])
    expect(s.slice(start, start + 4)).toBe('xref')
    var entries = s.slice(start).split('\n').slice(3).filter(l => / n $/.test(l))
    entries.forEach((l, i) => {
      var off = Number(l.slice(0, 10))
      expect(s.slice(off, off + String(i + 1).length + 6)).toBe((i + 1) + ' 0 obj')
    })
  })

  it('gives the content stream its true length', () => {
    var s = asText(compPosterPdf(base))
    var m = s.match(/<< \/Length (\d+) >>\nstream\n/)
    var at = m.index + m[0].length
    expect(s.slice(at + Number(m[1]), at + Number(m[1]) + 10)).toBe('\nendstream')
  })

  it('prints the notes, and shrinks the QR to keep everything on the page', () => {
    var long = Object.assign({}, base, {
      name: 'The Great South West Bouldering League Round Three Grand Finals Night',
      notes: 'Registration from 10, scoring 11 till 3, prizes at half past. Bring a pen in case the signal drops. Fancy dress encouraged for the final hour, prizes for the best costume too.',
    })
    var s = asText(compPosterPdf(long))
    expect(s).toContain('(Registration from 10,')
    var ys = Array.from(s.matchAll(/ ([\d.]+) re\n/g)).length
    expect(ys).toBeGreaterThan(50)
    var url = s.match(/ ([\d.]+) Td \(https:/)
    expect(Number(url[1])).toBeGreaterThanOrEqual(80)
  })

  it('draws the QR as filled squares', () => {
    var s = asText(compPosterPdf(base))
    expect((s.match(/ re\n/g) || []).length).toBeGreaterThan(50)
  })

  it('escapes brackets and maps what the fonts lack to ?', () => {
    var s = asText(compPosterPdf(Object.assign({}, base, { name: 'Bloc (night) \\ 攀岩' })))
    expect(s).toContain('(Bloc \\(night\\) \\\\ ??) Tj')
  })

  it('every byte is a byte', () => {
    compPosterPdf(Object.assign({}, base, { name: 'Café — “Comp”' })).forEach(b => expect(b).toBeLessThan(256))
  })
})

describe('wrapText', () => {
  it('keeps a short name on one line', () => {
    expect(wrapText('Autumn Bloc Party', 'F2', 34, 483, 3)).toEqual(['Autumn Bloc Party'])
  })

  it('breaks a long name across lines, each within the width', () => {
    var lines = wrapText('The Great South West Bouldering League Round Three Finals', 'F2', 34, 483, 3)
    expect(lines.length).toBeGreaterThan(1)
    lines.forEach(l => expect(textWidth(l, 'F2', 34)).toBeLessThanOrEqual(483))
  })

  it('ends with an ellipsis when it runs out of lines', () => {
    var lines = wrapText('one two three four five six seven eight nine ten eleven twelve', 'F2', 34, 200, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1].endsWith('…')).toBe(true)
  })

  it('cuts a single word too long for the line', () => {
    var lines = wrapText('Supercalifragilisticexpialidocious', 'F2', 34, 200, 3)
    expect(lines).toHaveLength(1)
    expect(textWidth(lines[0], 'F2', 34)).toBeLessThanOrEqual(200)
  })
})
