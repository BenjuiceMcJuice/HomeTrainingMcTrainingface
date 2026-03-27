import { useState, useEffect, useCallback } from 'react'
import Storage from '../lib/storage'
import { buildPublicProfile } from '../lib/stats'

/**
 * Hook for managing friends — time-boxed codes, add/remove, profile fetching.
 *
 * @param {string|null} userId - current Firebase user UID
 */
export default function useFriends(userId) {
  var [friendCode, setFriendCode]     = useState(null)   // the code string
  var [codeExpired, setCodeExpired]    = useState(true)   // whether current code is expired
  var [codeExpiresAt, setCodeExpiresAt] = useState(null)  // ISO string
  var [friends, setFriends]           = useState([])
  var [loading, setLoading]           = useState(true)
  var [error, setError]               = useState(null)

  // Fetch friend code + friends list on mount
  useEffect(function () {
    if (!userId) { setLoading(false); return }

    setLoading(true)
    Storage.getFriendCode(userId).then(function (result) {
      setFriendCode(result.code)
      setCodeExpired(result.expired)
      setCodeExpiresAt(result.expiresAt)
      // Ensure public profile exists so friends can read it
      var data = Storage.load()
      var profile = buildPublicProfile(data.sessions || [], data.athleteProfile)
      Storage.updatePublicProfile(userId, profile)
      return loadFriends()
    }).catch(function (err) {
      console.warn('useFriends init error:', err.message)
      setLoading(false)
    })
  }, [userId])

  var loadFriends = useCallback(function () {
    if (!userId) return Promise.resolve()
    return Storage.getFriendsList(userId).then(function (uids) {
      if (!uids.length) {
        setFriends([])
        setLoading(false)
        return
      }
      var promises = uids.map(function (uid) {
        return Storage.getFriendProfile(uid)
      })
      return Promise.all(promises).then(function (profiles) {
        var valid = profiles.filter(function (p) { return p !== null })
        setFriends(valid)
        setLoading(false)
      })
    }).catch(function (err) {
      console.warn('loadFriends error:', err.message)
      setLoading(false)
    })
  }, [userId])

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
      var alreadyFriend = friends.some(function (f) { return f.uid === result.uid })
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
  }, [userId, friends, loadFriends])

  var removeFriend = useCallback(function (theirUid) {
    if (!userId) return Promise.resolve()
    return Storage.removeFriend(userId, theirUid).then(function () {
      setFriends(function (prev) {
        return prev.filter(function (f) { return f.uid !== theirUid })
      })
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
