import { describe, it, expect } from 'vitest'
import {
  FIREBASE_AUTH_DOMAIN, PROXIED_AUTH_HOSTS, authDomainFor, isStandalone, googleFlow,
  markRedirect, takeRedirect, clearRedirect, REDIRECT_KEY, REDIRECT_TTL_MS, googleErrorMessage,
} from '../googleSignIn'

function memStorage(initial) {
  var m = Object.assign({}, initial)
  return {
    getItem: function (k) { return Object.prototype.hasOwnProperty.call(m, k) ? m[k] : null },
    setItem: function (k, v) { m[k] = String(v) },
    removeItem: function (k) { delete m[k] },
    dump: function () { return m },
  }
}
var broken = {
  getItem: function () { throw new Error('denied') },
  setItem: function () { throw new Error('denied') },
  removeItem: function () { throw new Error('denied') },
}

describe('authDomainFor', () => {
  it('uses the live site itself — it serves /__/auth', () => {
    expect(authDomainFor('betalog.co.uk')).toBe('betalog.co.uk')
    expect(authDomainFor('BETALOG.CO.UK')).toBe('betalog.co.uk')
  })

  it('uses the preview branch it was built on', () => {
    expect(authDomainFor('claude-pwa-google-signin.betalog.pages.dev')).toBe('claude-pwa-google-signin.betalog.pages.dev')
  })

  it('keeps firebaseapp.com everywhere else — Google does not know those hosts', () => {
    ;['localhost', '127.0.0.1', 'betalog.pages.dev', 'abc123.betalog.pages.dev', 'www.betalog.co.uk',
      'evil-betalog.co.uk', 'betalog.co.uk.evil.com', '', undefined, null].forEach(function (h) {
      expect(authDomainFor(h)).toBe(FIREBASE_AUTH_DOMAIN)
    })
  })

  it('every proxied host is lower case, with no scheme or port', () => {
    PROXIED_AUTH_HOSTS.forEach(function (h) { expect(h).toMatch(/^[a-z0-9.-]+$/) })
  })
})

describe('isStandalone', () => {
  function win(standalone, displayStandalone) {
    return {
      navigator: { standalone: standalone },
      matchMedia: function (q) { return { matches: q === '(display-mode: standalone)' && displayStandalone } },
    }
  }
  it('reads iOS navigator.standalone', () => { expect(isStandalone(win(true, false))).toBe(true) })
  it('reads the display-mode media query', () => { expect(isStandalone(win(undefined, true))).toBe(true) })
  it('a browser tab is not standalone', () => { expect(isStandalone(win(false, false))).toBe(false) })
  it('copes with no window or no matchMedia', () => {
    expect(isStandalone(undefined)).toBe(false)
    expect(isStandalone({ navigator: {} })).toBe(false)
  })
})

describe('googleFlow', () => {
  it('a browser tab always uses the popup', () => {
    expect(googleFlow(false, 'betalog.co.uk')).toBe('popup')
    expect(googleFlow(false, 'localhost')).toBe('popup')
  })
  it('the installed app on the live site goes by redirect', () => {
    expect(googleFlow(true, 'betalog.co.uk')).toBe('redirect')
  })
  it('the installed app on a host without the proxy is blocked, not hung', () => {
    expect(googleFlow(true, 'localhost')).toBe('blocked')
    expect(googleFlow(true, 'betalog.pages.dev')).toBe('blocked')
  })
})

describe('the redirect note', () => {
  it('a return within the window is read once', () => {
    var s = memStorage()
    markRedirect(s, 1000)
    expect(s.getItem(REDIRECT_KEY)).toBe('1000')
    expect(takeRedirect(s, 1000 + 5000)).toBe(true)
    expect(takeRedirect(s, 1000 + 6000)).toBe(false)
    expect(s.getItem(REDIRECT_KEY)).toBe(null)
  })

  it('no note, no redirect — an ordinary load stays off the redirect machinery', () => {
    expect(takeRedirect(memStorage(), 5)).toBe(false)
  })

  it('an old or odd note is cleared and ignored', () => {
    var s = memStorage()
    markRedirect(s, 0)
    expect(takeRedirect(s, REDIRECT_TTL_MS)).toBe(false)
    expect(s.getItem(REDIRECT_KEY)).toBe(null)
    expect(takeRedirect(memStorage({ [REDIRECT_KEY]: 'nonsense' }), 10)).toBe(false)
    expect(takeRedirect(memStorage({ [REDIRECT_KEY]: '5000' }), 10)).toBe(false) // from the future
  })

  it('clearRedirect forgets one that never left', () => {
    var s = memStorage()
    markRedirect(s, 1)
    clearRedirect(s)
    expect(takeRedirect(s, 2)).toBe(false)
  })

  it('storage that throws never throws out of here', () => {
    expect(function () { markRedirect(broken, 1) }).not.toThrow()
    expect(function () { clearRedirect(broken) }).not.toThrow()
    expect(takeRedirect(broken, 1)).toBe(false)
  })
})

describe('googleErrorMessage', () => {
  it('says nothing when the climber backed out', () => {
    expect(googleErrorMessage({ code: 'auth/popup-closed-by-user' })).toBe(null)
    expect(googleErrorMessage({ code: 'auth/cancelled-popup-request' })).toBe(null)
    expect(googleErrorMessage({ code: 'auth/redirect-cancelled-by-user' })).toBe(null)
  })
  it('words the ones a climber can act on', () => {
    expect(googleErrorMessage({ code: 'auth/network-request-failed' })).toMatch(/connection/)
    expect(googleErrorMessage({ code: 'auth/unauthorized-domain' })).toMatch(/email login/)
    expect(googleErrorMessage({ code: 'auth/account-exists-with-different-credential' })).toMatch(/password/)
  })
  it('falls back to Firebase’s message, then a sentence', () => {
    expect(googleErrorMessage({ code: 'auth/x', message: 'boom' })).toBe('boom')
    expect(googleErrorMessage(null)).toMatch(/failed/)
  })
})
