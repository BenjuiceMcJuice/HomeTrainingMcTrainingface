import { clsx } from "clsx";
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export const barlow = { fontFamily: "'Barlow Condensed', sans-serif" }

export const daysAgo = (n) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

export const capitalise = (str) => {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export const fmtDuration = (mins) => {
  const h = Math.floor(mins / 60)
  const m = mins % 60
  if (h > 0 && m > 0) return h + 'h ' + m + 'm'
  if (h > 0) return h + 'h'
  return m + 'm'
}

// Format a distance given in km into the user's preferred display unit.
// units: 'miles' (default) | 'km'
export const fmtDist = (km, units = 'miles') => {
  if (km == null) return ''
  if (units === 'miles') return (km / 1.609).toFixed(1) + ' mi'
  if (km >= 1) return km.toFixed(1) + ' km'
  return Math.round(km * 1000) + ' m'
}

export const sessionDistKm = (s) => {
  if (!s.cardioQuantity || !s.cardioUnit) return null
  if (s.cardioUnit === 'km')    return s.cardioQuantity
  if (s.cardioUnit === 'miles') return +(s.cardioQuantity * 1.609).toFixed(2)
  if (s.cardioUnit === 'm')     return +(s.cardioQuantity / 1000).toFixed(2)
  if (s.cardioUnit === 'lengths' && s.cardioPoolLength)
    return +((s.cardioQuantity * s.cardioPoolLength) / 1000).toFixed(2)
  return null
}

export const jsToScheduleDay = (jsDay) => jsDay === 0 ? 7 : jsDay
