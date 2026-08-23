/**
 * Local stroke icons (PLAN-006 M2): one visual voice for shell controls, zero dependencies.
 * 24×24 viewBox, currentColor, round caps — sized by the consuming button.
 */
const PATHS: Record<string, string> = {
  undo: 'M9 14 4 9l5-5 M4 9h10a6 6 0 0 1 0 12h-3',
  redo: 'M15 14l5-5-5-5 M20 9H10a6 6 0 0 0 0 12h3',
  play: 'M8 5.5v13l11-6.5z',
  pause: 'M8 5v14 M16 5v14',
  fastForward: 'M4 6v12l8-6z M13 6v12l8-6z',
  home: 'M11 19V5 M11 12l8-7v14z',
  loop: 'M17 3l4 4-4 4 M21 7H8a5 5 0 0 0-5 5 M7 21l-4-4 4-4 M3 17h13a5 5 0 0 0 5-5',
  help: 'M9.2 9a3 3 0 1 1 4.1 2.8c-1 .5-1.3 1-1.3 2.2 M12 17.5v.01',
  pen: 'M17 3l4 4L8 20l-5 1 1-5L17 3z M14 6l4 4',
  eraser: 'M7 21h13 M5 15l9-9 5 5-7 7H8l-3-3z M11 9l5 5',
  close: 'M6 6l12 12 M18 6L6 18',
  cursor: 'M5 3l14 10-6.6 1.1L9.5 20z',
  trash: 'M4 7h16 M9 7V4h6v3 M6 7l1 13h10l1-13 M10 11v5 M14 11v5',
  // theme trio: sun (light), moon (dark), bisected disc (follow the system)
  sun: 'M12 8a4 4 0 1 1 0 8 4 4 0 0 1 0-8 M12 2.5v2 M12 19.5v2 M4.6 4.6l1.4 1.4 M18 18l1.4 1.4 M2.5 12h2 M19.5 12h2 M4.6 19.4L6 18 M18 6l1.4-1.4',
  moon: 'M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1z',
  // one sheet vs a stack of sheets: showing this step only, or every step at once
  layers: 'M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5z',
  layersAll: 'M12 3.5 3.5 8l8.5 4.5L20.5 8 12 3.5z M3.5 12.5 12 17l8.5-4.5 M3.5 16.5 12 21l8.5-4.5',
  themeAuto:
    'M12 3.2a8.8 8.8 0 1 0 0 17.6 8.8 8.8 0 0 0 0-17.6z M12 3.2v17.6 M12 6.4h5 M12 12h6 M12 17.6h5',
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
