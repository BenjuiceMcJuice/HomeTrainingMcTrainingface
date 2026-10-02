// A signed-in user, always. `localStorage.fakeUser` (JSON) overrides it.
function currentUser() {
  try {
    var raw = localStorage.getItem('fakeUser')
    if (raw) return JSON.parse(raw)
  } catch { /* default below */ }
  return { uid: 'dev-uid', email: 'dev@example.com', displayName: 'Dev Climber', providerData: [{ providerId: 'password' }] }
}
export function initializeAuth() { return { fake: true, currentUser: currentUser() } }
export function GoogleAuthProvider() {}
export var browserLocalPersistence = {}
export var browserPopupRedirectResolver = {}
var listeners = []
export function onAuthStateChanged(auth, cb) {
  listeners.push(cb)
  setTimeout(function () { cb(currentUser()) }, 0)
  return function () { listeners = listeners.filter(function (l) { return l !== cb }) }
}
export function signOut() { return Promise.resolve() }
export function signInWithPopup() { return Promise.resolve({ user: currentUser() }) }
export function signInWithEmailAndPassword() { return Promise.resolve({ user: currentUser() }) }
export function createUserWithEmailAndPassword() { return Promise.resolve({ user: currentUser() }) }
// A reset request always "sends"; `localStorage.fakeResetError` (an auth code) makes it fail.
export function sendPasswordResetEmail() {
  var code = localStorage.getItem('fakeResetError')
  return code ? Promise.reject(Object.assign(new Error('Firebase: Error (' + code + ').'), { code: code })) : Promise.resolve()
}
export function deleteUser() { return Promise.resolve() }
export function reauthenticateWithPopup() { return Promise.resolve() }
export function reauthenticateWithCredential() { return Promise.resolve() }
export var EmailAuthProvider = { credential: function () { return {} } }

// Google by redirect (the installed app). signInWithRedirect leaves the page —
// here it notes the call and reloads. On the way back getRedirectResult reads
// `localStorage.fakeRedirectResult`: 'user' signs the dev user in, 'lost'
// comes back empty (iOS lost the state), anything else is an auth error code.
export function signInWithRedirect() {
  localStorage.setItem('fakeRedirectCalls', String(Number(localStorage.getItem('fakeRedirectCalls') || 0) + 1))
  setTimeout(function () { window.location.reload() }, 50)
  return new Promise(function () {})
}
export function getRedirectResult() {
  localStorage.setItem('fakeRedirectReads', String(Number(localStorage.getItem('fakeRedirectReads') || 0) + 1))
  var mode = localStorage.getItem('fakeRedirectResult') || 'user'
  if (mode === 'lost') return Promise.resolve(null)
  if (mode !== 'user') return Promise.reject(Object.assign(new Error('Firebase: Error (' + mode + ').'), { code: mode }))
  localStorage.removeItem('fakeUser')
  var u = currentUser()
  listeners.forEach(function (cb) { cb(u) })
  return Promise.resolve({ user: u })
}
