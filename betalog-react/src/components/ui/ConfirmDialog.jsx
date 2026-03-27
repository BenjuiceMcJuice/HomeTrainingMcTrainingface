/**
 * ConfirmDialog — styled in-app replacement for window.confirm().
 *
 * Renders as a centred card over a backdrop. Matches the app's visual language.
 * Always rendered above other modals (z-[60]).
 *
 * @param {{
 *   open: boolean,
 *   title: string,
 *   message?: string,
 *   confirmLabel?: string,
 *   danger?: boolean,
 *   onConfirm: () => void,
 *   onCancel: () => void,
 * }} props
 */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  onConfirm,
  onCancel,
}) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />

      {/* Card */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
        <div className="px-5 pt-5 pb-4 text-center">
          <p
            className="font-black text-[#1a1d2e]"
            style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '18px' }}
          >
            {title}
          </p>
          {message && (
            <p className="text-sm text-[#7a8299] mt-1.5 leading-snug">{message}</p>
          )}
        </div>

        {/* Button row — iOS-style split */}
        <div className="flex border-t border-[#e5e7ef]">
          <button
            onClick={onCancel}
            className="flex-1 py-3.5 text-sm font-semibold text-[#7a8299] border-r border-[#e5e7ef] hover:bg-[#f8f9fc] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3.5 text-sm font-bold transition-colors ${
              danger
                ? 'text-[#e11d48] hover:bg-[#fff5f5]'
                : 'text-[#4f7ef8] hover:bg-[#eef1ff]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
