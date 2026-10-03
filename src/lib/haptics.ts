/** Micro-feedback tattile (dove supportato: Android/Chrome). Silenzioso altrove. */
const PATTERNS = {
  tap: 8,
  select: 12,
  success: [12, 40, 18],
  warning: [30, 50, 30],
  threshold: 18,
} as const

export function haptic(kind: keyof typeof PATTERNS = 'tap') {
  try {
    navigator.vibrate?.(PATTERNS[kind] as number | number[])
  } catch {
    /* non supportato */
  }
}
