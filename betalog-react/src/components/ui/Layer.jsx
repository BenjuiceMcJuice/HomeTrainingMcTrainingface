import { createPortal } from 'react-dom'

/**
 * A layer over the whole app — every sheet, modal, dialog and the timer.
 *
 * Renders its children into `document.body`, outside the app shell, so a
 * `fixed inset-0` overlay is placed against the viewport whatever its React
 * parent is. Inside the shell it is not: `<main>` is the scroller (BTL-B127),
 * and on iOS a sheet rendered inside it was placed and clipped by `<main>`'s
 * box — the header and tabs undimmed above and below it, a tall sheet's title
 * and footer cut off, nothing to tap (BTL-B129, Ben's History screenshots of
 * 2026-10-10; a short sheet fitted the box and worked, which is why the weigh-in
 * sheet did). In the body, after the shell in tree order, a layer also paints
 * above the shell's rows at any z-index.
 *
 * React events still bubble through the React tree, not the DOM, so a sheet
 * must not be rendered inside an element whose onClick it should not reach.
 */
export default function Layer({ children }) {
  return createPortal(children, document.body)
}
