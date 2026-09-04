/**
 * Generate a VAPID keypair and set both Worker secrets in one step.
 *
 * Prefer this to `generate-vapid-keys.mjs` + two `wrangler secret put` calls by
 * hand. The manual route printed both halves and asked for them to be copied
 * into two more commands; on 4 September 2026 that shipped the literal
 * placeholder text into both secrets, and the failure surfaced only as
 * "Point is not on curve" from inside the push library, five minutes at a time.
 * Here the private half is piped straight to wrangler and never displayed.
 *
 *   node scripts/rotate-vapid-keys.mjs
 *
 * ROTATION IS NOT FREE once anyone has subscribed. The public key is baked into
 * each browser's subscription when it is created and into the app bundle at
 * build time, so after running this you must also:
 *   1. set VITE_VAPID_PUBLIC_KEY in the Pages dashboard (Production + Preview)
 *   2. rebuild the app so Vite inlines the new value
 *   3. turn notifications off and on again on every subscribed device
 * Skip any of those and sends fail against the stale key.
 */
import { spawnSync } from 'child_process'

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']
)
const publicKey = base64url(await crypto.subtle.exportKey('raw', pair.publicKey))
const privateKey = (await crypto.subtle.exportKey('jwk', pair.privateKey)).d

if (publicKey.length !== 87) throw new Error(`public key is ${publicKey.length} chars, expected 87`)
if (privateKey.length !== 43) throw new Error(`private key is ${privateKey.length} chars, expected 43`)

// `input` writes to the child's stdin with no trailing newline — a stray \r or
// \n inside a secret decodes to different bytes and yields an invalid curve point.
for (const [name, value] of [['VAPID_PUBLIC_KEY', publicKey], ['VAPID_PRIVATE_KEY', privateKey]]) {
  const r = spawnSync('npx', ['wrangler', 'secret', 'put', name], {
    input: value, encoding: 'utf8', shell: true,
  })
  if (r.status !== 0) throw new Error(`failed to set ${name}: ${r.stderr || r.stdout}`)
  console.log(`set ${name} (${value.length} chars)`)
}

console.log(`
Both secrets set. The private half was never printed.

Now set this in the Cloudflare Pages dashboard for BOTH Production and Preview,
then rebuild, then re-subscribe on each device:

VITE_VAPID_PUBLIC_KEY=${publicKey}
`)
