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
 */

export default function WidgetShell({ widgetKey, header, editMode, headerClassName, className, children }) {
  var { profile, saveProfile } = useProfile()
  var collapsed = isCollapsed(profile, widgetKey)

  function toggle() {
    saveProfile({ widgetCollapsed: toggleCollapsed(profile, widgetKey) })
  }

  return (
    <div className={className || ''}>
      <div className={'flex items-start gap-2 ' + (headerClassName || '')}>
        <div className="flex-1 min-w-0">{header}</div>
        {!editMode && (
          <button
            onClick={toggle}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand' : 'Collapse'}
            className="shrink-0 -mr-1 -mt-0.5 p-1 rounded-lg hover:bg-[#f4f5f9] transition-colors"
          >
            {collapsed
              ? <ChevronDown size={16} className="text-[#bbbcc8]" />
              : <ChevronUp   size={16} className="text-[#bbbcc8]" />}
          </button>
        )}
      </div>
      {!collapsed && children}
    </div>
  )
}
