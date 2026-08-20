/**
 * Local stroke icons (PLAN-006 M2): one visual voice for shell controls, zero dependencies.
 * 24×24 viewBox, currentColor, round caps — sized by the consuming button.
 */
const PATHS: Record<string, string> = {
  undo: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5v14 M16 5v14',
  home: 'M11 19V5 M11 12l8-7v14z',
  loop: 'M17 3l4 4-4 4 M21 7H8a5 5 0 0 0-5 5 M7 21l-4-4 4-4 M3 17h13a5 5 0 0 0 5-5',
  help: 'M9.2 9a3 3 0 1 1 4.1 2.8c-1 .5-1.3 1-1.3 2.2 M12 17.5v.01',
  pen: 'M17 3l4 4L8 20l-5 1 1-5L17 3z M14 6l4 4',
  eraser: 'M7 21h13 M5 15l9-9 5 5-7 7H8l-3-3z M11 9l5 5',
  close: 'M6 6l12 12 M18 6L6 18',
  cursor: 'M5 3l14 10-6.6 1.1L9.5 20z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
}

export function UiIcon({
  name,
  size = 16,
  filled = false,
}: {
  name: keyof typeof PATHS
  size?: number
  filled?: boolean
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  )
}
