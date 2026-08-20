/**
 * Firestore rules check — run against the local emulator.
 *
 *   cd betalog-react
 *   npm install --no-save firebase-tools @firebase/rules-unit-testing
 *   npx firebase emulators:exec --only firestore --project betalog-rules-test \
 *     "node ./scripts/check-firestore-rules.mjs"
 *
 * NOT part of `npm test` — it needs the emulator (Java) and two packages that
 * aren't project dependencies. Run it by hand whenever firestore.rules changes,
 * before `firebase deploy --only firestore:rules`.
 *
 * To confirm a case really bites, flip the rule and re-run: with `allow read`
 * instead of `allow get` on friendCodes, the enumeration case fails as it should.
 */
import { readFileSync } from 'fs'
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore'

const env = await initializeTestEnvironment({
  projectId: 'betalog-rules-test',
  firestore: {
    host: '127.0.0.1', port: 8080,
    rules: readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8'),
  },
})

// Seed two codes belonging to two different users, bypassing rules.
await env.withSecurityRulesDisabled(async (ctx) => {
  const db = ctx.firestore()
  await setDoc(doc(db, 'friendCodes', 'BL-AAAAA-200826'), { uid: 'alice', expiresAt: '2099-01-01' })
  await setDoc(doc(db, 'friendCodes', 'BL-BBBBB-200826'), { uid: 'bob',   expiresAt: '2099-01-01' })
})

const mallory = env.authenticatedContext('mallory').firestore()
const anon    = env.unauthenticatedContext().firestore()
let pass = 0, fail = 0
const check = async (name, p) => {
  try { await p; console.log('  PASS  ' + name); pass++ }
  catch (e) { console.log('  FAIL  ' + name + ' — ' + e.message.split('\n')[0]); fail++ }
}

console.log('\nfriendCodes rule:')
// The lookup the feature actually needs must still work.
await check('signed-in user CAN get a known code by id',
  assertSucceeds(getDoc(doc(mallory, 'friendCodes', 'BL-AAAAA-200826'))))
// The hole this change closes.
await check('signed-in user CANNOT list the collection',
  assertFails(getDocs(collection(mallory, 'friendCodes'))))
await check('signed-out user CANNOT get a code',
  assertFails(getDoc(doc(anon, 'friendCodes', 'BL-AAAAA-200826'))))
await check('signed-out user CANNOT list the collection',
  assertFails(getDocs(collection(anon, 'friendCodes'))))
// Write rules unchanged — re-verified so this change didn't loosen them.
await check('user CAN create a code carrying their own uid',
  assertSucceeds(setDoc(doc(mallory, 'friendCodes', 'BL-CCCCC-200826'), { uid: 'mallory', expiresAt: '2099-01-01' })))
await check('user CANNOT create a code claiming another uid',
  assertFails(setDoc(doc(mallory, 'friendCodes', 'BL-DDDDD-200826'), { uid: 'alice', expiresAt: '2099-01-01' })))
await check('user CANNOT overwrite an existing code',
  assertFails(setDoc(doc(mallory, 'friendCodes', 'BL-AAAAA-200826'), { uid: 'mallory', expiresAt: '2099-01-01' })))

console.log(`\n${pass} passed, ${fail} failed\n`)
await env.cleanup()
process.exit(fail ? 1 : 0)
