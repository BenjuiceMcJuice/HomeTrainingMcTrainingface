import { initializeApp } from 'firebase/app'
import { initializeAuth, GoogleAuthProvider, browserLocalPersistence } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

var firebaseConfig = {
  apiKey: "AIzaSyBI_7DYt3g217YAx9y0JLf_3yxakLnnhUE",
  authDomain: "betalog-340b3.firebaseapp.com",
  projectId: "betalog-340b3",
  storageBucket: "betalog-340b3.firebasestorage.app",
  messagingSenderId: "332042526249",
  appId: "1:332042526249:web:3cad206c43aae877c58638"
}

var app = initializeApp(firebaseConfig)

// Use initializeAuth with explicit persistence instead of getAuth.
// getAuth auto-registers browserPopupRedirectResolver which tries to process
// redirect results on page load — this fails on mobile browsers with storage
// partitioning (Safari, in-app browsers) causing "missing initial state" errors.
// browserLocalPersistence without the redirect resolver avoids this entirely.
export var auth = initializeAuth(app, {
  persistence: browserLocalPersistence
})
export var googleProvider = new GoogleAuthProvider()
export var db = getFirestore(app)
