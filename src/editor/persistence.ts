/**
 * Persistence (M5): localStorage autosave, JSON file export/import, SVG/PNG export.
 * No backend (ADR-0001 §13). Schema guarded on import.
 */
import { SCHEMA_VERSION, type TacticDocument } from '@/domain/types'
import type { EditorCore } from './editorCore'

export const AUTOSAVE_KEY = 'st.autosave.v1'

export function isTacticDocument(x: unknown): x is TacticDocument {
  if (!x || typeof x !== 'object') return false
  const d = x as Record<string, unknown>
  return (
    d.schemaVersion === SCHEMA_VERSION &&
    typeof d.id === 'string' &&
    !!d.meta &&
    !!d.pitch &&
    Array.isArray(d.teams) &&
    Array.isArray(d.players) &&
    !!d.ball &&
    Array.isArray(d.drawings) &&
    Array.isArray(d.scenes) &&
    (d.scenes as unknown[]).length > 0
  )
}

export function serialize(doc: TacticDocument): string {
  return JSON.stringify(doc, null, 2)
}

export function parseDocument(json: string): TacticDocument {
  const parsed: unknown = JSON.parse(json)
  if (!isTacticDocument(parsed)) throw new Error('Not a Soccer Tactics document (schema mismatch)')
  return parsed
}

export function loadAutosave(): TacticDocument | null {
  try {
    const raw = localStorage.getItem(AUTOSAVE_KEY)
    if (!raw) return null
    return parseDocument(raw)
  } catch {
    return null
  }
}

export function saveAutosave(doc: TacticDocument): boolean {
  try {
    localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(doc))
    return true
  } catch {
    return false
  }
}

export function clearAutosave(): void {
  try {
    localStorage.removeItem(AUTOSAVE_KEY)
  } catch {
    /* ignore */
  }
}

/** Subscribe to an EditorCore and autosave (debounced). Returns unsubscribe. */
export function startAutosave(core: EditorCore, delayMs = 600): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  const flush = () => {
    timer = null
    if (core.inTransaction) return
    saveAutosave(core.getDocument())
  }
  const off = core.subscribe(() => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(flush, delayMs)
  })
  return () => {
    off()
    if (timer) clearTimeout(timer)
  }
}

// ---------- files ----------

function safeName(title: string): string {
  return (
    (title || 'tactic')
      .replace(/[^\w\-가-힣 ]+/g, '')
      .trim()
      .replace(/\s+/g, '-') || 'tactic'
  )
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function exportJson(doc: TacticDocument): void {
  const stamped = { ...doc, meta: { ...doc.meta, updatedAt: new Date().toISOString() } }
  downloadBlob(
    new Blob([serialize(stamped)], { type: 'application/json' }),
    `${safeName(doc.meta.title)}.tactic.json`,
  )
}

export function pickJsonFile(): Promise<string | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = 'application/json,.json'
    input.onchange = async () => {
      const f = input.files?.[0]
      if (!f) return resolve(null)
      resolve(await f.text())
    }
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/** Serialize the pitch <svg> with computed styles inlined enough for standalone viewing. */
export function svgMarkup(svg: SVGSVGElement, theme: 'light' | 'dark'): string {
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('class')
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  // Resolve CSS variables + class styles by copying computed styles for key props.
  const srcEls = svg.querySelectorAll<SVGElement>('*')
  const dstEls = clone.querySelectorAll<SVGElement>('*')
  const PROPS = [
    'fill',
    'stroke',
    'stroke-width',
    'stroke-dasharray',
    'opacity',
    'font-size',
    'font-weight',
    'font-family',
    'text-anchor',
    'dominant-baseline',
    'stroke-linecap',
    'stroke-linejoin',
    'paint-order',
    'pointer-events',
  ] as const
  srcEls.forEach((src, i) => {
    const dst = dstEls[i]
    if (!dst) return
    const cs = getComputedStyle(src)
    const style: string[] = []
    for (const p of PROPS) {
      const v = cs.getPropertyValue(p)
      if (v) style.push(`${p}:${v}`)
    }
    dst.setAttribute('style', style.join(';'))
    dst.removeAttribute('class')
  })
  const vb = svg.getAttribute('viewBox') ?? '0 0 105 68'
  const [, , w, h] = vb.split(/\s+/).map(Number)
  clone.setAttribute('width', String(Math.round((w ?? 115) * 12)))
  clone.setAttribute('height', String(Math.round((h ?? 78) * 12)))
  clone.setAttribute('data-theme', theme)
  return '<?xml version="1.0" encoding="UTF-8"?>\n' + clone.outerHTML
}

export function exportSvg(svg: SVGSVGElement, title: string, theme: 'light' | 'dark'): void {
  downloadBlob(
    new Blob([svgMarkup(svg, theme)], { type: 'image/svg+xml' }),
    `${safeName(title)}.svg`,
  )
}

export async function exportPng(
  svg: SVGSVGElement,
  title: string,
  theme: 'light' | 'dark',
  scale = 2,
): Promise<void> {
  const markup = svgMarkup(svg, theme)
  const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    await new Promise<void>((res, rej) => {
      img.onload = () => res()
      img.onerror = () => rej(new Error('svg load failed'))
      img.src = url
    })
    const canvas = document.createElement('canvas')
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    const ctx = canvas.getContext('2d')!
    ctx.fillStyle =
      getComputedStyle(document.documentElement).getPropertyValue('--st-pitch-surround') ||
      '#2f7e4b'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/png'))
    if (blob) downloadBlob(blob, `${safeName(title)}.png`)
  } finally {
    URL.revokeObjectURL(url)
  }
}
