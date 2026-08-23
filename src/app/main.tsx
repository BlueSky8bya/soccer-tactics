import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import { applyTheme, loadThemePref } from '@/ui/theme'
import '@/ui/tokens.css'
import '@/ui/base.css'

// Before the first paint, not in a mount effect — a theme applied after React commits shows the
// wrong one for a frame, which on a dark preference is a full-screen white flash.
applyTheme(loadThemePref())

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('#root not found')

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
