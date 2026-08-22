import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@snaprec/design-system/fonts'
import './index.css'
import App from './App.tsx'
// Analytics: started before render so the first pageview is not missed. No-ops
// entirely when VITE_POSTHOG_API_KEY is unset — see lib/analytics.ts.
import { initAnalytics } from './lib/analytics'

initAnalytics()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
