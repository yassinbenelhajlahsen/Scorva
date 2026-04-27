import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from "@vercel/speed-insights/react"
import { Analytics } from "@vercel/analytics/react"
import "@fontsource-variable/inter";
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
        <SpeedInsights />
        <Analytics />
  </StrictMode>
)

const appShell = document.getElementById("app-shell");
if (appShell) {
  appShell.classList.add("hidden");
  appShell.addEventListener("transitionend", () => appShell.remove(), { once: true });
}
