import { initializeApp } from 'firebase/app'
import { initializeAuth, GoogleAuthProvider, browserLocalPersistence, browserPopupRedirectResolver } from 'firebase/auth'
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

// initializeAuth with explicit persistence avoids getAuth auto-registering
// browserPopupRedirectResolver globally — that causes "missing initial state"
// errors on Safari/in-app browsers with storage partitioning on page load.
// The resolver is instead passed explicitly to signInWithPopup in App.jsx,
// so popup sign-in works without the unsafe global redirect processing.
export var auth = initializeAuth(app, {
  persistence: browserLocalPersistence
})
export { browserPopupRedirectResolver }
export var googleProvider = new GoogleAuthProvider()
export var db = getFirestore(app)
