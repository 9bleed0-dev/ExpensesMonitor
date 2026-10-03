import { useSyncExternalStore } from 'react'

export type ThemePref = 'system' | 'light' | 'dark'
export type Theme = 'light' | 'dark'

const KEY = 'theme'
const media = window.matchMedia('(prefers-color-scheme: light)')
const listeners = new Set<() => void>()

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'light' || v === 'dark' ? v : 'system'
  } catch {
    return 'system'
  }
}

let pref = readPref()
const resolve = (p: ThemePref): Theme => (p === 'system' ? (media.matches ? 'light' : 'dark') : p)

function apply() {
  const theme = resolve(pref)
  const root = document.documentElement
  root.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f3f2f9' : '#0b0b14')
  listeners.forEach((l) => l())
}

media.addEventListener('change', () => pref === 'system' && apply())
apply()

export function setThemePref(p: ThemePref) {
  pref = p
  try {
    if (p === 'system') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, p)
  } catch {
    /* storage non disponibile: il tema vale solo per questa sessione */
  }
  // Transizione morbida dei colori solo durante il cambio di tema
  const root = document.documentElement
  root.classList.add('theme-anim')
  apply()
  window.setTimeout(() => root.classList.remove('theme-anim'), 450)
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, () => resolve(pref))
  const current = useSyncExternalStore(subscribe, () => pref)
  return { theme, pref: current, setPref: setThemePref }
}

/**
 * Le tinte di categoria predefinite sono calibrate per la superficie scura;
 * in tema chiaro si usa il gradino della stessa tinta validato per la superficie chiara.
 */
const LIGHT_STEPS: Record<string, string> = {
  '#3987e5': '#2a78d6',
  '#d95926': '#eb6834',
  '#199e70': '#1baf7a',
  '#c98500': '#eda100',
  '#d55181': '#e87ba4',
  '#9085e9': '#4a3aa7',
  '#e66767': '#e34948',
  '#5c5c66': '#a3a3ab',
}

export const themed = (color: string, theme: Theme) => (theme === 'light' ? (LIGHT_STEPS[color.toLowerCase()] ?? color) : color)
