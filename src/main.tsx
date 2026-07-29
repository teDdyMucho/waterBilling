import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from '@/app/App'
import { initInstallCapture } from '@/features/pwa/install'
import '@/index.css'

// Saluhin ang `beforeinstallprompt` nang maaga — pwedeng pumutok bago mag-render.
initInstallCapture()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
