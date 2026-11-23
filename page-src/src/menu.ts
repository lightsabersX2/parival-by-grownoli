// The one "…" menu, also on right-click: a page opens it with the items for what was clicked.
import { ref } from 'vue'

export type MenuItem = { label: string; action: () => void; checked?: boolean } | { separator: true }
export const menu = ref<{ x: number; y: number; items: MenuItem[] } | null>(null)

export function openMenu(e: MouseEvent, items: MenuItem[]) {
  e.preventDefault()
  e.stopPropagation()
  // from a button: under it, not at the pointer
  const r = e.type === 'click' ? (e.currentTarget as HTMLElement | null)?.getBoundingClientRect() : null
  menu.value = { x: r ? r.left : e.clientX, y: r ? r.bottom + 4 : e.clientY, items }
}
export const closeMenu = () => (menu.value = null)
