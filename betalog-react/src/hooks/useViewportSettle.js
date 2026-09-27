import { useEffect } from 'react'

/**
 * Puts the page back after the iOS on-screen keyboard closes.
 *
 * In an installed iOS web app, dismissing the keyboard can leave the layout
 * viewport scrolled by the keyboard's height: every `position: fixed` bar —
 * the bottom tabs, the comp tabs — stays that far up the screen with page
 * showing beneath it, until the next scroll. BTL-B44's blur fix covered a
 * different trigger; this is the keyboard one (BTL-B101).
 *
 * When focus leaves a text field (and does not move to another one), and when
 * the visual viewport grows back, nudge the scroll by a pixel and back. That
 * makes WebKit recompute the fixed layer against the full-height viewport.
 * Harmless elsewhere: one pixel there and back, after the keyboard has gone.
 */
export default function useViewportSettle() {
  useEffect(function () {
    var timer = null

    function isField(el) {
      if (!el) return false
      var tag = el.tagName
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
    }

    function settle() {
      clearTimeout(timer)
      timer = setTimeout(function () {
        if (isField(document.activeElement)) return
        var x = window.scrollX, y = window.scrollY
        window.scrollTo(x, y > 0 ? y - 1 : y + 1)
        window.scrollTo(x, y)
      }, 120)
    }

    var vv = window.visualViewport
    var lastHeight = vv ? vv.height : 0
    function onResize() {
      if (vv.height > lastHeight) settle()
      lastHeight = vv.height
    }

    document.addEventListener('focusout', settle)
    if (vv) vv.addEventListener('resize', onResize)
    return function () {
      clearTimeout(timer)
      document.removeEventListener('focusout', settle)
      if (vv) vv.removeEventListener('resize', onResize)
    }
  }, [])
}
