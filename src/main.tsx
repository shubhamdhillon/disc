import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { fitHomeScreenApp, trackViewportHeight } from './lib/device'
import './styles/index.css'
import App from './App'

fitHomeScreenApp()
trackViewportHeight()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
