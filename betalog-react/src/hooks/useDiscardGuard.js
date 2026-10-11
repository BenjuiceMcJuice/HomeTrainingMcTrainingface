import { useState, useEffect, useRef } from 'react'

/**
 * Asks before a sheet throws away what has been typed into it.
 *
 * The gym, cardio and drink sheets used to close on a backdrop tap with no
 * word — a climber trained by the climb logger's "nothing sits unsaved" lost a
 * whole gym session by swiping it away (review of 2026-10-11). The sheet marks
 * itself dirty on any change or button tap inside it (spread `guardProps` on
 * the panel), and `requestClose` asks first when it is. Buttons that must not
 * count — the close X, Save, Delete — carry `data-guard="skip"`.
 *
 * `close` is what Save and a confirmed discard call: it clears the flag and
 * closes. The flag also clears whenever the sheet is closed from outside.
 *
 * @param {boolean} open
 * @param {() => void} onClose
 */
export default function useDiscardGuard(open, onClose) {
  var dirty = useRef(false)
  var [asking, setAsking] = useState(false)

  useEffect(function () {
    if (!open) dirty.current = false
  }, [open])

  function skipped(e) {
    var t = e && e.target
    return !!(t && t.closest && t.closest('[data-guard="skip"]'))
  }

  function onChangeCapture(e) {
    if (!skipped(e)) dirty.current = true
  }

  function onClickCapture(e) {
    var t = e && e.target
    if (!skipped(e) && t && t.closest && t.closest('button')) dirty.current = true
  }

  function close() {
    dirty.current = false
    setAsking(false)
    onClose()
  }

  function requestClose() {
    if (dirty.current) setAsking(true)
    else close()
  }

  function keepEditing() {
    setAsking(false)
  }

  return {
    asking: asking,
    requestClose: requestClose,
    keepEditing: keepEditing,
    close: close,
    guardProps: { onChangeCapture: onChangeCapture, onClickCapture: onClickCapture },
  }
}
