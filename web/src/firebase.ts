import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Public web SDK config — safe to include in client-side code.
// Access is controlled by Firestore Security Rules (not this key).
const firebaseConfig = {
  apiKey: 'AIzaSyA8ZG5vmwu_d3EqLwVoIQozfG7feN8mMxM',
  authDomain: 'jawg-a3271.firebaseapp.com',
  projectId: 'jawg-a3271',
  storageBucket: 'jawg-a3271.firebasestorage.app',
  messagingSenderId: '488781193877',
  appId: '1:488781193877:web:2123a5a52a109af73d319c',
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getFirestore(app)
