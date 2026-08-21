import useProfile from './useProfile'
import { getWindow, setWindow, WINDOW_OPTIONS } from '../lib/widgetWindow'

/**
 * The selected timeframe for one dashboard widget, persisted in the profile.
 *
 * Mirrors how `WidgetShell` handles collapse state — the component asks for its
 * own key and gets back a value and a setter, with the storage detail and the
 * default living in `lib/widgetWindow.js`.
 *
 * @param {string} widgetKey
 * @returns {{ window: string, options: string[], setWindow: (w: string) => void }}
 */
export default function useWidgetWindow(widgetKey) {
  var { profile, saveProfile } = useProfile()

  function choose(value) {
    saveProfile({ widgetWindow: setWindow(profile, widgetKey, value) })
  }

  return {
    window:    getWindow(profile, widgetKey),
    options:   WINDOW_OPTIONS[widgetKey] || [],
    setWindow: choose,
  }
}
