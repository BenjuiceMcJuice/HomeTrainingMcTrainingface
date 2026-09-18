import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

// Register the service worker, and run the new build as soon as it has one.
//
// The worker is cache-first and precaches index.html, so the first launch after
// a release ran the *old* bundle while the new worker installed behind it, and
// only the launch after that ran the new code. Everything that happens on
// sign-in (the public profile republish among it) was therefore a launch late,
// and an app kept in memory for days never checked for a release at all.
// Two hooks close that (2026-09-18, Ben: "I want it automatic"):
//
// - When a new worker takes control of a page an older one was already
//   controlling, reload once. sw.js calls skipWaiting() and clients.claim(), so
//   this fires within seconds of a release being found. A page with no
//   controller yet (a first-ever install, or a hard refresh) is not reloaded:
//   it is already running the bundle it just fetched.
// - When the app returns to the foreground, ask the browser to check for a new
//   worker. Browsers check on navigation, and an installed app that is only
//   ever resumed from the switcher never navigates.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    var hadController = !!navigator.serviceWorker.controller
    var reloaded = false
    navigator.serviceWorker.addEventListener('controllerchange', function () {
      if (!hadController || reloaded) return
      reloaded = true
      window.location.reload()
    })
    navigator.serviceWorker.register('/sw.js').then(function (reg) {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') reg.update().catch(function () {})
      })
    }).catch(function () {})
  })
}
