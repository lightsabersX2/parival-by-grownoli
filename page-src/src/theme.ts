// Light, dark or follow the Mac; the choice is kept in this browser.
import { ref } from 'vue'

export type Theme = 'light' | 'dark' | 'auto'
const read = (): Theme => { try { return (localStorage.getItem('theme') as Theme) || 'auto' } catch { return 'auto' } }
export const theme = ref<Theme>(read())
export function setTheme(t: Theme) {
  theme.value = t
  if (t === 'auto') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = t
  try { localStorage.setItem('theme', t) } catch { /* the choice lasts this visit */ }
}
export const THEMES: [Theme, string][] = [['light', 'Light'], ['dark', 'Dark'], ['auto', 'Auto']]
