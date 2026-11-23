// Undo and redo for what the person changed in this tab: each step knows how to put things back and how to do them again.
export interface Step<T> { label: string; undo: T; redo: T }
export class History<T> {
  private done: Step<T>[] = []
  private undone: Step<T>[] = []
  push(step: Step<T>) {
    this.done.push(step)
    this.undone = []
  }
  undo(): Step<T> | null {
    const s = this.done.pop() ?? null
    if (s) this.undone.push(s)
    return s
  }
  redo(): Step<T> | null {
    const s = this.undone.pop() ?? null
    if (s) this.done.push(s)
    return s
  }
}
