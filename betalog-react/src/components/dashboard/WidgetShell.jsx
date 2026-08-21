import { ChevronDown, ChevronUp } from 'lucide-react'
import useProfile from '../../hooks/useProfile'
import { isCollapsed, toggleCollapsed } from '../../lib/widgetCollapse'

/**
 * Shared collapsible shell for dashboard widgets.
 *
 * The contract (docs/specs/betalog_ia_declutter_spec.md):
 *
 * 1. Collapsed still says something — the `header` stays visible, so folding
 *    hides detail, never the answer. A widget that goes blank when collapsed has
 *    its summary in the wrong place.
 * 2. State persists in `profile.widgetCollapsed`, beside `dashWidgets` and
 *    `widgetOrder`, so it syncs across devices for free.
 * 3. Chart-heavy widgets default collapsed, glanceable ones expanded.
 * 4. Collapse is disabled in edit mode, so a tap meant for the drag handle
 *    can't fold the card.
 *
 * The shell sits *inside* each card's own chrome rather than providing it —
 * the cards have different borders and padding, and unifying that is a visual
 * change this phase deliberately doesn't make.
 *
 * **The whole header row is the tap target** (widget system spec, phase A).
 * The 16px chevron with `p-1` around it was a ~24px target, well under the
 * ~44px wanted for touch; `ActivityCalendar` used to toggle from its whole
 * header and lost that in the declutter. The row is a real `<button>`, so
 * `header` must contain no interactive elements of its own — nested buttons are
 * invalid HTML and ambiguous to tap. Anything that changes the detail belongs
 * at the top of the body, next to what it changes.
 */

export default function WidgetShell({ widgetKey, header, editMode, headerClassName, className, children }) {
  var { profile, saveProfile } = useProfile()
  var collapsed = isCollapsed(profile, widgetKey)

  function toggle() {
    saveProfile({ widgetCollapsed: toggleCollapsed(profile, widgetKey) })
  }

  var rowClass = 'flex items-start gap-2 ' + (headerClassName || '')

  return (
    <div className={className || ''}>
      {editMode ? (
        <div className={rowClass}>
          <div className="flex-1 min-w-0">{header}</div>
        </div>
      ) : (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand' : 'Collapse'}
          className={'group w-full text-left min-h-[44px] ' + rowClass}
        >
          <div className="flex-1 min-w-0">{header}</div>
          {/* Decorative: the row around it is the control, so the chevron is a
              span. Hover still lights it up, from the row. */}
          <span className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-lg transition-colors group-hover:bg-[#f4f5f9]">
            {collapsed
              ? <ChevronDown size={16} className="text-[#bbbcc8]" />
              : <ChevronUp   size={16} className="text-[#bbbcc8]" />}
          </span>
        </button>
      )}
      {!collapsed && children}
    </div>
  )
}
