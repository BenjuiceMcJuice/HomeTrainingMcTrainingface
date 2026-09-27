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
export function onAuthStateChanged(auth, cb) { setTimeout(function () { cb(currentUser()) }, 0); return function () {} }
export function signOut() { return Promise.resolve() }
export function signInWithPopup() { return Promise.resolve({ user: currentUser() }) }
export function signInWithEmailAndPassword() { return Promise.resolve({ user: currentUser() }) }
export function createUserWithEmailAndPassword() { return Promise.resolve({ user: currentUser() }) }
export function deleteUser() { return Promise.resolve() }
export function reauthenticateWithPopup() { return Promise.resolve() }
export function reauthenticateWithCredential() { return Promise.resolve() }
export var EmailAuthProvider = { credential: function () { return {} } }
