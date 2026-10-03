import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import App from './App'
import { startSync } from './lib/sync'
import './index.css'

registerSW({ immediate: true })

// Chiede al browser di non cancellare i dati locali sotto pressione di spazio
navigator.storage?.persist?.()

// Sincronizzazione con il server sul telefono, se configurato in Opzioni
startSync()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
