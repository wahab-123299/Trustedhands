import React from 'react'
import ReactDOM from 'react-dom/client'
import './index.css'

import App from './App'

// PWA: Register service worker
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onRegistered(r: ServiceWorkerRegistration | undefined) {
    console.log('✅ SW Registered:', r)
  },
  onRegisterError(error: Error) {
    console.log('❌ SW registration error', error)
  },
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
