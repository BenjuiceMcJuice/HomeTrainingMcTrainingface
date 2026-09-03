/**
 * Generate a VAPID keypair for betalog-push.
 *
 * Run once, ever. Regenerating invalidates every existing subscription: the
 * public key is baked into each browser's subscription at the moment it is
 * created, so a new pair silently stops every already-enabled device from
 * receiving anything until it re-subscribes.
 *
 *   node scripts/generate-vapid-keys.mjs
 *
 * The keys are P-256 (ES256), base64url-encoded, per RFC 8292. Uses only Node's
 * built-in WebCrypto — no dependencies, so this runs before any npm install.
 */

function base64url(buf) {
  return Buffer.from(buf).toString('base64')
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

var pair = await crypto.subtle.generateKey(
  { name: 'ECDSA', namedCurve: 'P-256' },
  true,
  ['sign', 'verify']
)

// The public key is the uncompressed point: 0x04 || X || Y, 65 bytes.
var publicKey = base64url(await crypto.subtle.exportKey('raw', pair.publicKey))

// The private key is the 32-byte scalar `d`, which is what the push library and
// RFC 8292 expect — not the PKCS#8 wrapper exportKey('pkcs8') would give.
var jwk = await crypto.subtle.exportKey('jwk', pair.privateKey)
var privateKey = jwk.d

console.log(`
VAPID keypair generated. Set the two secrets on the Worker:

  npx wrangler secret put VAPID_PUBLIC_KEY
  ${publicKey}

  npx wrangler secret put VAPID_PRIVATE_KEY
  ${privateKey}

And give the app the public half — betalog-react/.env.local for a local run,
and a Cloudflare Pages environment variable for the deployed site:

  VITE_VAPID_PUBLIC_KEY=${publicKey}

Keep the private key out of git. Generate this once: a new pair silently breaks
every device that has already subscribed.
`)
