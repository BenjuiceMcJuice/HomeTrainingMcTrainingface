import { useEffect } from 'react'

/**
 * Puts the window back after the iOS on-screen keyboard closes.
 *
 * In an installed iOS web app, focusing a field can scroll the *window* to
 * bring it into view — even though the app shell is one viewport tall and only
 * `<main>` is meant to scroll (BTL-B127) — and dismissing the keyboard can
 * leave it there, the whole shell shifted up by the keyboard's height with
 * page showing beneath the tabs (BTL-B101). The document's correct scroll
 * position is always 0, so when focus leaves a text field (and does not move
 * to another one), and when the visual viewport grows back, put it there.
 * Before B127 this nudged a `position: fixed` bar by a pixel and back; there
 * are no fixed bars now, so the reset is the whole job.
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
        if (window.scrollX || window.scrollY) window.scrollTo(0, 0)
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
