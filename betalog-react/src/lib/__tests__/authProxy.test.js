import { describe, it, expect } from 'vitest'
// The Pages Function at the repo root (functions/__/auth/[[path]].js).
import { proxy, onRequest, UPSTREAM } from '../../../../functions/__/auth/[[path]].js'
import { FIREBASE_AUTH_DOMAIN } from '../googleSignIn'

function recorder(response) {
  var calls = []
  var f = function (url, init) {
    calls.push({ url: url, init: init })
    return Promise.resolve(typeof response === 'function' ? response() : response)
  }
  f.calls = calls
  return f
}

describe('the /__/auth proxy', () => {
  it('points at the same Firebase domain the app falls back to', () => {
    expect(UPSTREAM).toBe('https://' + FIREBASE_AUTH_DOMAIN)
  })

  it('forwards the path and query unchanged to firebaseapp.com', async () => {
    var f = recorder(new Response('<html>handler</html>', { status: 200, headers: { 'content-type': 'text/html' } }))
    var res = await proxy(new Request('https://betalog.co.uk/__/auth/handler?apiKey=k&appName=%5BDEFAULT%5D&authType=signInViaRedirect'), f)
    expect(f.calls[0].url).toBe(UPSTREAM + '/__/auth/handler?apiKey=k&appName=%5BDEFAULT%5D&authType=signInViaRedirect')
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe('text/html')
    expect(await res.text()).toBe('<html>handler</html>')
  })

  it('passes redirects back to the browser instead of following them', async () => {
    var f = recorder(new Response(null, { status: 302, headers: { location: 'https://accounts.google.com/o/oauth2/auth?x=1' } }))
    var res = await proxy(new Request('https://betalog.co.uk/__/auth/handler'), f)
    expect(f.calls[0].init.redirect).toBe('manual')
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://accounts.google.com/o/oauth2/auth?x=1')
  })

  it('keeps a redirect to the handler itself on this origin', async () => {
    var f = recorder(new Response(null, { status: 302, headers: { location: UPSTREAM + '/__/auth/handler?a=b' } }))
    var res = await proxy(new Request('https://betalog.co.uk/__/auth/handler'), f)
    expect(res.headers.get('location')).toBe('https://betalog.co.uk/__/auth/handler?a=b')
  })

  it('drops Host and Cloudflare’s headers, keeps the rest', async () => {
    var f = recorder(new Response('ok'))
    await proxy(new Request('https://betalog.co.uk/__/auth/iframe', {
      headers: { 'cf-connecting-ip': '1.2.3.4', 'cf-ray': 'abc', 'accept-language': 'en-GB', cookie: 'a=b' },
    }), f)
    var h = f.calls[0].init.headers
    expect(h.get('host')).toBe(null)
    expect(h.get('cf-connecting-ip')).toBe(null)
    expect(h.get('cf-ray')).toBe(null)
    expect(h.get('accept-language')).toBe('en-GB')
    expect(h.get('cookie')).toBe('a=b')
  })

  it('forwards a POST body and method', async () => {
    var f = recorder(new Response('ok'))
    await proxy(new Request('https://betalog.co.uk/__/auth/handler', { method: 'POST', body: 'id_token=xyz' }), f)
    expect(f.calls[0].init.method).toBe('POST')
    expect(new TextDecoder().decode(f.calls[0].init.body)).toBe('id_token=xyz')
  })

  it('sends no body with a GET', async () => {
    var f = recorder(new Response('ok'))
    await proxy(new Request('https://betalog.co.uk/__/auth/handler.js'), f)
    expect(f.calls[0].init.body).toBe(undefined)
  })

  it('passes upstream errors through as they are', async () => {
    var f = recorder(new Response('nope', { status: 404 }))
    var res = await proxy(new Request('https://betalog.co.uk/__/auth/missing'), f)
    expect(res.status).toBe(404)
  })

  it('answers 502, uncached, when firebaseapp.com cannot be reached', async () => {
    var res = await proxy(new Request('https://betalog.co.uk/__/auth/handler'), function () { return Promise.reject(new Error('down')) })
    expect(res.status).toBe(502)
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('onRequest uses the global fetch', async () => {
    var real = globalThis.fetch
    var f = recorder(new Response('ok'))
    globalThis.fetch = f
    try {
      var res = await onRequest({ request: new Request('https://betalog.co.uk/__/auth/iframe?x') })
      expect(res.status).toBe(200)
      expect(f.calls[0].url).toBe(UPSTREAM + '/__/auth/iframe?x')
    } finally {
      globalThis.fetch = real
    }
  })
})
