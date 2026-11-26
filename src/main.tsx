import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { fitHomeScreenApp, trackViewportHeight } from './lib/device'
import { keepUpToDate } from './lib/updates'
import './styles/index.css'
import App from './App'

fitHomeScreenApp()
trackViewportHeight()
keepUpToDate()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
