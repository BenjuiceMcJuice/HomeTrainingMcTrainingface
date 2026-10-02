/**
 * The comp poster — an A4 PDF with the comp's name, date and venue, its QR
 * code and its join code, for the organiser to print and pin up (Manage ›
 * Join code › *Download poster (PDF)*).
 *
 * Built by hand rather than with a PDF library: one page, the PDF standard
 * fonts (Helvetica, Courier — every reader has them, nothing is embedded) and
 * the QR drawn as filled squares, so it prints sharp at any size. Pure — the
 * QR modules come in as a matrix; Manage gets them from `qrcode-generator`.
 */

var PAGE_W = 595.28
var PAGE_H = 841.89
var MARGIN = 56

// Advance widths (1/1000 em) for ASCII 32–126, from the Adobe AFM files.
// Anything outside ASCII is measured as 556, a typical lower-case width.
var HELVETICA = [
  278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556,
  556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584,
]
var HELVETICA_BOLD = [
  278, 333, 474, 556, 556, 889, 722, 238, 333, 333, 389, 584, 278, 333, 278, 278,
  556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 333, 333, 584, 584, 584, 611,
  975, 722, 722, 722, 722, 667, 611, 778, 722, 278, 556, 722, 611, 833, 722, 778,
  667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 333, 278, 333, 584, 556,
  333, 556, 611, 556, 611, 556, 333, 611, 611, 278, 278, 556, 278, 889, 611, 611,
  611, 611, 389, 556, 333, 611, 556, 778, 556, 556, 500, 389, 280, 389, 584,
]
var FONTS = { F1: HELVETICA, F2: HELVETICA_BOLD, F3: null } // F3 Courier-Bold: 600 throughout

// WinAnsiEncoding for the characters outside Latin-1 a name is likely to have.
var WIN_ANSI = {
  0x20AC: 0x80, 0x2026: 0x85, 0x2018: 0x91, 0x2019: 0x92, 0x201C: 0x93, 0x201D: 0x94,
  0x2022: 0x95, 0x2013: 0x96, 0x2014: 0x97, 0x2122: 0x99,
}

/** One character code in WinAnsiEncoding, or `?` (63) for one the fonts lack. */
function winAnsi(ch) {
  var c = ch.codePointAt(0)
  if (c >= 32 && c <= 126) return c
  if (c >= 160 && c <= 255) return c
  return WIN_ANSI[c] || 63
}

/** The width of `text` in points, in font `font` at `size`. */
export function textWidth(text, font, size) {
  var table = FONTS[font]
  var w = 0
  Array.from(text).forEach(function (ch) {
    var c = winAnsi(ch)
    w += table ? (c >= 32 && c <= 126 ? table[c - 32] : 556) : 600
  })
  return w * size / 1000
}

/** A PDF literal string: each character one byte, `( ) \` escaped. */
function pdfString(text) {
  var out = '('
  Array.from(text).forEach(function (ch) {
    var c = winAnsi(ch)
    if (c === 40 || c === 41 || c === 92) out += '\\' + String.fromCharCode(c)
    else out += String.fromCharCode(c)
  })
  return out + ')'
}

/**
 * `text` broken into lines no wider than `maxW`, at most `maxLines`; the last
 * line ends in an ellipsis if anything was cut. A word too long for a line on
 * its own is cut too.
 */
export function wrapText(text, font, size, maxW, maxLines) {
  var words = String(text || '').trim().split(/\s+/).filter(Boolean)
  var lines = []
  var line = ''
  var cut = false
  for (var i = 0; i < words.length; i++) {
    var next = line ? line + ' ' + words[i] : words[i]
    if (textWidth(next, font, size) <= maxW) { line = next; continue }
    if (line) lines.push(line)
    line = words[i]
    if (lines.length === maxLines) { cut = true; break }
  }
  if (!cut && line) lines.push(line)
  if (lines.length > maxLines) { lines = lines.slice(0, maxLines); cut = true }
  lines = lines.map(function (l) { return fitLine(l, font, size, maxW) })
  if (cut && lines.length) lines[lines.length - 1] = fitLine(lines[lines.length - 1] + '…', font, size, maxW, true)
  return lines
}

/** `l` shortened with an ellipsis until it fits `maxW`. */
function fitLine(l, font, size, maxW, ellipsised) {
  if (textWidth(l, font, size) <= maxW) return l
  var chars = Array.from(ellipsised ? l.slice(0, -1) : l)
  while (chars.length && textWidth(chars.join('') + '…', font, size) > maxW) chars.pop()
  return chars.join('').trimEnd() + '…'
}

function rgb(hex) {
  return [1, 3, 5].map(function (i) { return (parseInt(hex.substr(i, 2), 16) / 255).toFixed(3) }).join(' ')
}

function num(n) { return (Math.round(n * 100) / 100).toString() }

/**
 * The poster as the bytes of a PDF file.
 * @param {{
 *   name: string, code: string, url: string,
 *   lines?: string[],          // under the name: type, date, venue
 *   notes?: string,            // the organiser's notes for the poster
 *   modules: boolean[][],      // the QR, row by row, true = dark
 * }} p
 * @returns {Uint8Array}
 */
export function compPosterPdf(p) {
  var ops = []
  var y = PAGE_H - MARGIN - 20
  var maxW = PAGE_W - 2 * MARGIN

  function text(s, font, size, colour, opts) {
    var spacing = (opts && opts.spacing) || 0
    var n = Array.from(s).length
    var w = textWidth(s, font, size) + spacing * Math.max(0, n - 1)
    var x = (PAGE_W - w) / 2
    ops.push('BT /' + font + ' ' + num(size) + ' Tf ' + rgb(colour) + ' rg ' + num(spacing) + ' Tc ' +
      num(x) + ' ' + num(y) + ' Td ' + pdfString(s) + ' Tj ET')
  }

  text('BETALOG · COMPETITION', 'F2', 11, '#7a8299', { spacing: 1.5 })
  y -= 46

  wrapText(p.name || p.code, 'F2', 34, maxW, 3).forEach(function (l, i) {
    if (i) y -= 38
    text(l, 'F2', 34, '#1a1d2e')
  })
  ;(p.lines || []).filter(Boolean).forEach(function (l, i) {
    y -= i ? 22 : 34
    text(wrapText(l, 'F1', 14, maxW, 1)[0] || '', 'F1', 14, '#7a8299')
  })

  wrapText(p.notes || '', 'F1', 13, maxW, 3).forEach(function (l, i) {
    y -= i ? 18 : 30
    text(l, 'F1', 13, '#1a1d2e')
  })

  // The QR, as big as fits between the text above and the code block below.
  var modules = p.modules || []
  var count = modules.length
  var qrTop = y - 36
  var qrSize = Math.min(340, qrTop - 212)
  if (count) {
    var cell = qrSize / count
    var x0 = (PAGE_W - qrSize) / 2
    ops.push('0 0 0 rg')
    for (var r = 0; r < count; r++) {
      var c = 0
      while (c < count) {
        if (!modules[r][c]) { c++; continue }
        var start = c
        while (c < count && modules[r][c]) c++
        // A hair of overlap so no seams show between cells in a viewer.
        ops.push(num(x0 + start * cell) + ' ' + num(qrTop - (r + 1) * cell) + ' ' +
          num((c - start) * cell + 0.05) + ' ' + num(cell + 0.05) + ' re')
      }
    }
    ops.push('f')
  }
  y = qrTop - qrSize - 44

  text('Scan to join, or enter the code', 'F2', 15, '#1a1d2e')
  y -= 58
  text(p.code, 'F3', 50, '#1a1d2e', { spacing: 6 })
  y -= 30
  text(p.url, 'F1', 12, '#7a8299')

  y = MARGIN
  text('Score your goes on your phone in BetaLog — betalog.co.uk', 'F1', 10, '#bbbcc8')

  var stream = ops.join('\n')
  var objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ' + PAGE_W + ' ' + PAGE_H + '] ' +
      '/Resources << /Font << /F1 4 0 R /F2 5 0 R /F3 6 0 R >> >> /Contents 7 0 R >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>',
    '<< /Length ' + stream.length + ' >>\nstream\n' + stream + '\nendstream',
  ]
  // The Info dictionary is PDFDocEncoding, not WinAnsi: keep its title to
  // ASCII and Latin-1, where the two agree.
  var title = pdfString(((p.name || p.code) + ' - poster')
    .replace(/[\u2013\u2014]/g, '-').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
    .replace(/[^\u0020-\u007E\u00A0-\u00FF]/g, '?'))
  objects.push('<< /Title ' + title + ' /Producer (BetaLog) >>')

  // Every character above is one byte, so string offsets are byte offsets.
  var out = '%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'
  var offsets = []
  objects.forEach(function (o, i) {
    offsets.push(out.length)
    out += (i + 1) + ' 0 obj\n' + o + '\nendobj\n'
  })
  var xref = out.length
  out += 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n'
  offsets.forEach(function (o) { out += String(o).padStart(10, '0') + ' 00000 n \n' })
  out += 'trailer\n<< /Size ' + (objects.length + 1) + ' /Root 1 0 R /Info ' + objects.length + ' 0 R >>\nstartxref\n' + xref + '\n%%EOF\n'

  var bytes = new Uint8Array(out.length)
  for (var i = 0; i < out.length; i++) bytes[i] = out.charCodeAt(i) & 0xff
  return bytes
}
