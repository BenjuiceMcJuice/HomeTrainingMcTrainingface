import { useState, useEffect, useCallback } from 'react'
import Storage from '../lib/storage'

/**
 * Hook for managing friends — time-boxed codes, add/remove, profile fetching.
 *
 * ## Live while open (2026-09-18)
 *
 * Until now the friends' profiles were fetched once, when the app started,
 * and every opening of the sheet reused them until the refresh button was
 * tapped — on a phone that keeps the PWA in memory for days, a stale board.
 * Now the friend *list* is read on mount and again on every open, and while
 * the sheet is open each friend's profile document is watched with a
 * Firestore listener, so a friend's session shows on the board within a
 * second of their phone syncing it. The listeners are dropped when the sheet
 * closes; nothing is watched in the background.
 *
 * @param {string|null} userId - current Firebase user UID
 * @param {boolean} [open] - whether the friends screen is showing
 */
export default function useFriends(userId, open) {
  var [friendCode, setFriendCode]     = useState(null)   // the code string
  var [codeExpired, setCodeExpired]    = useState(true)   // whether current code is expired
  var [codeExpiresAt, setCodeExpiresAt] = useState(null)  // ISO string
  var [uids, setUids]                 = useState([])     // who my friends are
  var [friends, setFriends]           = useState([])     // their profiles, live while open
  var [loading, setLoading]           = useState(true)
  var [error, setError]               = useState(null)

  var loadFriends = useCallback(function () {
    if (!userId) return Promise.resolve()
    return Storage.getFriendsList(userId).then(function (list) {
      setUids(list)
      if (!list.length) { setFriends([]); setLoading(false) }
    }).catch(function (err) {
      console.warn('loadFriends error:', err.message)
      setLoading(false)
    })
  }, [userId])

  // Fetch friend code + friends list on mount
  useEffect(function () {
    if (!userId) { setLoading(false); return }

    setLoading(true)
    Storage.getFriendCode(userId).then(function (result) {
      setFriendCode(result.code)
      setCodeExpired(result.expired)
      setCodeExpiresAt(result.expiresAt)
      return loadFriends()
    }).catch(function (err) {
      console.warn('useFriends init error:', err.message)
      setLoading(false)
    })
  }, [userId, loadFriends])

  // Re-read who my friends are each time the sheet opens — a friend added
  // from another device, or one who removed me, shows without a restart.
  useEffect(function () {
    if (open && userId) loadFriends()
  }, [open, userId, loadFriends])

  // Watch their profiles while the sheet is open. A new `uids` array (from
  // loadFriends, add or refresh) re-subscribes; close unsubscribes.
  useEffect(function () {
    if (!open || !userId || !uids.length) return undefined
    setLoading(true)
    var unsubscribe = Storage.watchFriendProfiles(uids, function (profiles) {
      setFriends(profiles)
      setLoading(false)
    })
    return unsubscribe
  }, [open, userId, uids])

  var generateNewCode = useCallback(function () {
    if (!userId) return Promise.resolve()
    return Storage.generateFriendCode(userId).then(function (result) {
      setFriendCode(result.code)
      setCodeExpired(false)
      setCodeExpiresAt(result.expiresAt)
    }).catch(function (err) {
      setError(err.message || 'Failed to generate code')
    })
  }, [userId])

  var addFriend = useCallback(function (code) {
    setError(null)
    if (!userId) { setError('Not signed in'); return Promise.resolve() }

    var normalised = code.trim().toUpperCase()
    if (normalised.indexOf('BL-') !== 0) normalised = 'BL-' + normalised

    // Validate format: BL-XXXXX-DDMMYY
    if (!/^BL-[A-Z0-9]{5}-[0-9]{6}$/.test(normalised)) {
      setError('Invalid code format')
      return Promise.resolve()
    }

    return Storage.lookupFriendCode(normalised).then(function (result) {
      if (!result) {
        setError('Code not found')
        return
      }
      if (result.expired) {
        setError('Code has expired')
        return
      }
      if (result.uid === userId) {
        setError("That's your own code!")
        return
      }
      var alreadyFriend = uids.indexOf(result.uid) !== -1
      if (alreadyFriend) {
        setError('Already friends!')
        return
      }
      return Storage.addFriend(userId, result.uid).then(function () {
        return loadFriends()
      })
    }).catch(function (err) {
      setError(err.message || 'Failed to add friend')
    })
  }, [userId, uids, loadFriends])

  var removeFriend = useCallback(function (theirUid) {
    if (!userId) return Promise.resolve()
    return Storage.removeFriend(userId, theirUid).then(function () {
      setUids(function (prev) { return prev.filter(function (u) { return u !== theirUid }) })
      setFriends(function (prev) { return prev.filter(function (f) { return f.uid !== theirUid }) })
    }).catch(function (err) {
      setError(err.message || 'Failed to remove friend')
    })
  }, [userId])

  return {
    friendCode: friendCode,
    codeExpired: codeExpired,
    codeExpiresAt: codeExpiresAt,
    friends: friends,
    loading: loading,
    error: error,
    generateNewCode: generateNewCode,
    addFriend: addFriend,
    removeFriend: removeFriend,
    refreshFriends: loadFriends,
  }
}
