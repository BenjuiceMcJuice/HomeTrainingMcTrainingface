import { describe, it, expect } from 'vitest'
import { render, spec, ACTIVE_FINGERS, VIEW_BOX } from '../gripDiagram'

var GRIPS = ['open-hand', 'half-crimp', 'full-crimp', 'drag']
var FINGER_SETS = Object.keys(ACTIVE_FINGERS)

function draw(fingers, gt) { return render(spec(fingers, gt), '#ffffff', '#ffffff35', '#8b5cf6') }

describe('gripDiagram', function () {
  it('draws every finger setting × grip type the routine editor offers', function () {
    FINGER_SETS.forEach(function (fs) {
      GRIPS.forEach(function (gt) {
        var m = draw(fs, gt)
        expect(m.length).toBeGreaterThan(500)
        expect(m).not.toContain('NaN')
        expect(m).not.toContain('undefined')
      })
    })
    expect(VIEW_BOX).toBe('0 0 300 140')
  })

  it('the back of the hand does not change with grip type, only with the fingers', function () {
    // the left view is everything before the divider at x=140; the profile follows it
    function left(fs, gt) { return draw(fs, gt).split('x="140"')[0].replace(/fade\d+/g, 'fade') }
    expect(left('Front 3', 'half-crimp')).toBe(left('Front 3', 'drag'))
    expect(left('Front 3', 'half-crimp')).not.toBe(left('Back 3', 'half-crimp'))
  })

  it('the profile changes with grip type', function () {
    function right(fs, gt) { return draw(fs, gt).split('x="140"')[1] }
    var seen = new Set(GRIPS.map(function (gt) { return right('4 Finger', gt) }))
    expect(seen.size).toBe(4)
  })

  it('paints creases and the fade in the colours it is given', function () {
    var m = draw('4 Finger', 'full-crimp')
    expect(m).toContain('stroke="#8b5cf6"')          // creases and the thumb halo in the background colour
    expect(m).toContain('stop-color="#ffffff"')       // the fade is the foreground colour going transparent
  })

  it('falls back to four fingers for a setting it does not know', function () {
    expect(spec('Whatever', 'drag').act.size).toBe(4)
  })
})
