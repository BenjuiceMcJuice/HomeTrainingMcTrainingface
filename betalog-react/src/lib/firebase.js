import { initializeApp } from 'firebase/app'
import { initializeAuth, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { authDomainFor } from './googleSignIn'

var firebaseConfig = {
  apiKey: "AIzaSyBI_7DYt3g217YAx9y0JLf_3yxakLnnhUE",
  // betalog.co.uk serves Firebase's auth handler itself (functions/__/auth),
  // so sign-in state stays first-party — what lets Google sign-in work in the
  // installed iPhone app. Hosts without that set-up keep firebaseapp.com.
  authDomain: authDomainFor(typeof window !== 'undefined' ? window.location.hostname : ''),
  projectId: "betalog-340b3",
  storageBucket: "betalog-340b3.firebasestorage.app",
  messagingSenderId: "332042526249",
  appId: "1:332042526249:web:3cad206c43aae877c58638"
}

var app = initializeApp(firebaseConfig)

// initializeAuth with explicit persistence avoids getAuth auto-registering
// browserPopupRedirectResolver globally — that causes "missing initial state"
// errors on Safari/in-app browsers with storage partitioning on page load.
// The resolver is instead passed explicitly to signInWithPopup and
// signInWithRedirect in LoginScreen.jsx, and getRedirectResult is called only
// on the page load that returns from a redirect the app started.
export var auth = initializeAuth(app, {
  persistence: browserLocalPersistence
})
export { browserPopupRedirectResolver }
export var googleProvider = new GoogleAuthProvider()
export var db = getFirestore(app)
