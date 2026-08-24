/**
 * Stateless visual constants shared by the SVG renderer world and canvas exporters (AUD-06).
 * CSS custom properties cannot reach <canvas>, so anything both sides draw lives here.
 * Keep in sync with src/ui/tokens.css pitch/team values.
 */
export const VISUAL = {
  pitchGrass: '#4aab6d',
  pitchGrassAlt: '#45a266',
  pitchSurround: '#3a8f57',
  pitchLine: 'rgba(255,255,255,0.9)',
  teamHome: '#1f6df2',
  teamAway: '#e03e3e',
  // the BALL's own colours and panels live in `ballMark`, which both the SVG token and the canvas
  // exporter draw from — keeping a second set here is how the two ended up different balls
  tokenRadiusM: 1.35,
  ballRadiusM: 0.68,
} as const
