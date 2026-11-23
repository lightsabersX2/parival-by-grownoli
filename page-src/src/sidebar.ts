// What the sidebar shows, kept between visits: the project list can fold away so other clients' names stay off a
// shared screen, and the whole sidebar can fold to a thin edge for a full-width gallery.
import { ref, watch } from 'vue'

function remembered(key: string) {
  let start = false
  try { start = localStorage.getItem(key) === '1' } catch { /* private window: start open */ }
  const r = ref(start)
  watch(r, (v) => { try { localStorage.setItem(key, v ? '1' : '0') } catch { /* not kept */ } })
  return r
}
export const projectsHidden = remembered('parival.sidebar.projectsHidden')
export const sidebarFolded = remembered('parival.sidebar.folded')
