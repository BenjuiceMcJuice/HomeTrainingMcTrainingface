import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

var firebaseConfig = {
  apiKey: "AIzaSyBI_7DYt3g217YAx9y0JLf_3yxakLnnhUE",
  authDomain: "betalog.co.uk",
  projectId: "betalog-340b3",
  storageBucket: "betalog-340b3.firebasestorage.app",
  messagingSenderId: "332042526249",
  appId: "1:332042526249:web:3cad206c43aae877c58638"
}

var app = initializeApp(firebaseConfig)

export var auth = getAuth(app)
export var googleProvider = new GoogleAuthProvider()
export var db = getFirestore(app)
