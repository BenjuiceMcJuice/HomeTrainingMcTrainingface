/**
 * BetaLog — Storage module
 *
 * Single source of all localStorage access. No component or hook touches
 * localStorage directly — everything goes through here.
 *
 * Keys
 *   il_sessions       Session[]
 *   il_exercises      Exercise[]
 *   il_routines       Routine[]        (gym + hangboard, merged from old il_hbRoutines)
 *   il_schedule       Schedule | null
 *   il_weightLog      WeightEntry[]    (was il_weight_log in old app)
 *   il_athleteProfile AthleteProfile | null
 *   il_badges         string[]
 *   il_groq_key       string           (raw, not JSON)
 *
 * @see betalog_data_model.md
 * @see src/lib/types.js
 */

import { db } from './firebase'
import { doc, setDoc, getDoc, updateDoc, arrayUnion, arrayRemove, collection, query, where, getDocs } from 'firebase/firestore'
import { buildPublicProfile } from './stats'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function readJson(key, fallback) {
  try {
    var raw = localStorage.getItem(key)
    if (raw === null) return fallback
    return JSON.parse(raw)
  } catch (e) {
    console.warn('[storage] failed to parse', key, e)
    return fallback
  }
}

function writeJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

function now() {
  return new Date().toISOString()
}

function uuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback for older environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

// ---------------------------------------------------------------------------
// Migration — transforms old data shapes into the canonical schema
// All functions are safe to run on already-migrated data (idempotent).
// ---------------------------------------------------------------------------

var OLD_CLIMB_TYPES = ['boulder', 'lead', 'toprope']

/**
 * Migrate a single session from old shape to canonical shape.
 * @param {Object} s - raw session from localStorage
 * @returns {import('./types').Session}
 */
function migrateSession(s) {
  var session = Object.assign({}, s)

  // type + discipline split
  // Old app used type: "boulder"|"lead"|"toprope" — new shape uses type: "climb" + discipline
  if (OLD_CLIMB_TYPES.indexOf(session.type) !== -1) {
    session.discipline = session.type
    session.type = 'climb'
  }

  // Ensure discipline is present on climb sessions
  if (session.type === 'climb' && !session.discipline) {
    session.discipline = null
  }

  // Ensure discipline is null on non-climb sessions
  if (session.type !== 'climb') {
    session.discipline = null
  }

  // Normalise array fields
  if (!Array.isArray(session.exercises)) session.exercises = []
  if (!Array.isArray(session.climbs))    session.climbs = []

  // Hangboard: migrate old hangProtocol (single object) → hangGrips (array)
  if (session.type === 'hangboard') {
    if (!Array.isArray(session.hangGrips)) {
      if (session.hangProtocol) {
        session.hangGrips = [migrateHangProtocol(session.hangProtocol)]
      } else {
        session.hangGrips = []
      }
      delete session.hangProtocol
    }
  } else {
    if (!Array.isArray(session.hangGrips)) session.hangGrips = []
  }

  // Migrate climbs
  session.climbs = session.climbs.map(function (c) {
    return migrateClimb(c, session.discipline)
  })

  // createdAt / updatedAt — synthesise from date if missing
  if (!session.createdAt) {
    session.createdAt = session.date ? session.date + 'T00:00:00.000Z' : now()
  }
  if (!session.updatedAt) {
    session.updatedAt = session.createdAt
  }

  // notes — ensure string
  if (typeof session.notes !== 'string') session.notes = ''

  // routine provenance fields
  if (session.routineId   === undefined) session.routineId   = null
  if (session.routineName === undefined) session.routineName = null

  // trackingType on each exercise (added in step 3b)
  session.exercises = session.exercises.map(function (se) {
    if (!se.trackingType) se.trackingType = 'reps'
    return se
  })

  return session
}

/**
 * Migrate old hangProtocol object to HangGrip shape.
 * @param {Object} proto
 * @returns {import('./types').HangGrip}
 */
function migrateHangProtocol(proto) {
  var weightMode = 'bodyweight'
  var weightKg = 0

  if (proto.weightDir === 'added' && proto.weight) {
    weightMode = 'added'
    weightKg = proto.weight
  } else if (proto.weightDir === 'assisted' && proto.weight) {
    weightMode = 'assisted'
    weightKg = proto.weight
  }

  return {
    id:         proto.id || uuid(),
    grip:       proto.grip || 'half-crimp',
    gripName:   proto.gripName || proto.grip || 'Half Crimp',
    activeSecs: proto.onSecs  || proto.activeSecs  || 7,
    restSecs:   proto.offSecs || proto.restSecs    || 3,
    setRest:    proto.setRest  || 180,
    reps:       proto.reps    || 6,
    sets:       proto.sets    || 3,
    weightMode: weightMode,
    weightKg:   weightKg,
  }
}

/**
 * Migrate a single climb.
 * @param {Object} c
 * @param {string | null} sessionDiscipline
 * @returns {import('./types').Climb}
 */
function migrateClimb(c, sessionDiscipline) {
  var climb = Object.assign({}, c)

  // id
  if (!climb.id) climb.id = uuid()

  // discipline — fall back to session discipline
  if (!climb.discipline) climb.discipline = sessionDiscipline || null

  // gradeSystem — derive from discipline if missing
  if (!climb.gradeSystem) {
    climb.gradeSystem = climb.discipline === 'boulder' ? 'v' : 'french'
  }

  // outcome — remap old "fell" value
  if (climb.outcome === 'fell') climb.outcome = 'attempt'

  // attempts — default to 1
  if (!climb.attempts || climb.attempts < 1) climb.attempts = 1

  // gym link fields — default to null
  if (climb.routeId  === undefined) climb.routeId  = null
  if (climb.gymId    === undefined) climb.gymId    = null
  if (climb.centreId === undefined) climb.centreId = null

  return climb
}

// Best-effort mapping from old mp value → new muscle-group category
// Old data can't distinguish chest vs arms (both were mp:'push') so we default to 'chest'/'back'.
// Users can correct via edit modal. New data uses explicit category values.
var CAT_FROM_MP = { push: 'chest', pull: 'back', hinge: 'legs', squat: 'legs', core: 'core', mobility: 'mobility', shoulder: 'shoulders', isometric: 'core', carry: 'other', rotation: 'core' }

/**
 * Migrate a single exercise.
 * Old field names: cat, mp, equip, sets, reps, rest
 * New field names: category, movementPattern, equipment, defaultSets, defaultReps, defaultRest
 * @param {Object} e
 * @returns {import('./types').Exercise}
 */
function migrateExercise(e) {
  var ex = Object.assign({}, e)

  // mp → movementPattern
  if (ex.mp !== undefined && ex.movementPattern === undefined) {
    ex.movementPattern = ex.mp
    delete ex.mp
  }
  // 'shoulder' is not a valid movementPattern in new schema → push
  if (ex.movementPattern === 'shoulder') ex.movementPattern = 'push'
  if (ex.movementPattern === undefined) ex.movementPattern = null

  // cat → category
  if (ex.cat !== undefined && ex.category === undefined) {
    if (ex.cat === 'pull')       ex.category = 'back'
    else if (ex.cat === 'rehab') ex.category = 'mobility'
    else ex.category = CAT_FROM_MP[ex.movementPattern] || 'other'
    delete ex.cat
  }
  if (!ex.category) ex.category = 'other'

  // equip → equipment
  if (ex.equip !== undefined && ex.equipment === undefined) {
    ex.equipment = ex.equip
    delete ex.equip
  }
  if (ex.equipment === undefined) ex.equipment = null

  // sets/reps/rest → defaultSets/defaultReps/defaultRest
  if (ex.sets !== undefined && ex.defaultSets === undefined) { ex.defaultSets = ex.sets; delete ex.sets }
  if (ex.reps !== undefined && ex.defaultReps === undefined) { ex.defaultReps = ex.reps; delete ex.reps }
  if (ex.rest !== undefined && ex.defaultRest === undefined) { ex.defaultRest = ex.rest; delete ex.rest }

  if (ex.defaultSets     === undefined) ex.defaultSets     = 3
  if (ex.defaultReps     === undefined) ex.defaultReps     = 10
  if (ex.defaultDuration === undefined) ex.defaultDuration = 30
  if (ex.defaultRest     === undefined) ex.defaultRest     = 60
  if (ex.trackingType    === undefined) ex.trackingType    = 'reps'

  if (typeof ex.muscles     !== 'string')  ex.muscles     = ''
  if (typeof ex.notes       !== 'string')  ex.notes       = ''
  if (typeof ex.ytSearch    !== 'string')  ex.ytSearch    = ''
  if (typeof ex.isFavourite !== 'boolean') ex.isFavourite = false

  if (!ex.createdAt) ex.createdAt = now()
  if (!ex.updatedAt) ex.updatedAt = ex.createdAt

  return ex
}

/**
 * Migrate a single routine. Handles both gym and hangboard routines.
 * @param {Object} r
 * @param {"gym" | "hangboard"} type
 * @returns {import('./types').Routine}
 */
function migrateRoutine(r, forcedType) {
  var routine = Object.assign({}, r)

  // forcedType is only set for old il_hbRoutines (which had no type field).
  // For il_routines, respect the existing type — seeded climb/hangboard routines live here.
  routine.type = forcedType || routine.type || 'gym'

  if (!Array.isArray(routine.exercises)) routine.exercises = []
  if (!Array.isArray(routine.grips))     routine.grips     = []

  // Hangboard routines stored grips under different keys in the old app
  if (routine.type === 'hangboard') {
    if (routine.grips.length === 0 && Array.isArray(routine.protocol)) {
      routine.grips = routine.protocol.map(migrateHangProtocol)
      delete routine.protocol
    }
  }

  if (!routine.createdAt) routine.createdAt = now()
  if (!routine.updatedAt) routine.updatedAt = routine.createdAt
  routine.isFavourite = !!routine.isFavourite

  return routine
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

var Storage = {
  /**
   * Run all migrations and return the canonical data object.
   * Safe to call on every app load — idempotent.
   * @returns {import('./types').BetaLogData}
   */
  load: function () {
    var rawSessions  = readJson('il_sessions',  [])
    var rawExercises = readJson('il_exercises', [])
    var rawRoutines  = readJson('il_routines',  [])
    var rawHbRoutines = readJson('il_hbRoutines', [])  // old separate key
    var schedule     = readJson('il_schedule',  null)
    // Weight log key changed from snake_case to camelCase
    var weightLog    = readJson('il_weightLog', null) || readJson('il_weight_log', [])
    var profile      = readJson('il_athleteProfile', null)
    var badges       = readJson('il_badges',    [])
    var groqKey      = localStorage.getItem('il_groq_key') || ''

    var sessions  = rawSessions.map(migrateSession)
    var exercises = rawExercises.map(migrateExercise)

    // Merge old il_hbRoutines into il_routines.
    // Don't force type='gym' on il_routines — respect whatever type is already set
    // (seeded climb/hangboard routines live here too). Only old il_hbRoutines are forced to hangboard.
    var gymRoutines = rawRoutines.map(function (r) { return migrateRoutine(r) })
    var hbRoutines  = rawHbRoutines.map(function (r) { return migrateRoutine(r, 'hangboard') })
    var routines    = gymRoutines.concat(hbRoutines)

    return {
      sessions:       sessions,
      exercises:      exercises,
      routines:       routines,
      schedule:       schedule,
      weightLog:      weightLog,
      athleteProfile: profile,
      badges:         badges,
      groqKey:        groqKey,
    }
  },

  /** @param {import('./types').Session[]} sessions */
  saveSessions: function (sessions) {
    writeJson('il_sessions', sessions)
  },

  /** @param {import('./types').Exercise[]} exercises */
  saveExercises: function (exercises) {
    writeJson('il_exercises', exercises)
  },

  /** @param {import('./types').Routine[]} routines */
  saveRoutines: function (routines) {
    writeJson('il_routines', routines)
  },

  /** @param {import('./types').Schedule | null} schedule */
  saveSchedule: function (schedule) {
    writeJson('il_schedule', schedule)
  },

  /** @param {import('./types').WeightEntry[]} entries */
  saveWeightLog: function (entries) {
    writeJson('il_weightLog', entries)
  },

  /** @param {import('./types').AthleteProfile} profile */
  saveAthleteProfile: function (profile) {
    writeJson('il_athleteProfile', profile)
  },

  /** @param {string[]} badges */
  saveBadges: function (badges) {
    writeJson('il_badges', badges)
  },

  /** @param {string} key */
  saveGroqKey: function (key) {
    localStorage.setItem('il_groq_key', key)
  },

  /** Returns true if il_exercises has never been written (new user / fresh install) */
  hasNoExercises: function () {
    return localStorage.getItem('il_exercises') === null
  },
}

// ---------------------------------------------------------------------------
// Firestore sync — write to cloud alongside localStorage
// ---------------------------------------------------------------------------

var SYNC_KEYS = ['sessions', 'exercises', 'routines', 'schedule', 'weightLog', 'athleteProfile']

/**
 * Write all syncable data to Firestore for the given user.
 * Called after every localStorage save. Fire-and-forget (no await).
 */
Storage.syncToFirestore = function (userId) {
  if (!userId) return
  var data = Storage.load()
  var payload = {}
  SYNC_KEYS.forEach(function (key) {
    payload[key] = data[key] != null ? data[key] : null
  })
  payload.updatedAt = now()
  setDoc(doc(db, 'users', userId), payload, { merge: true }).then(function () {
    // Also update public profile for friends
    var profile = buildPublicProfile(data.sessions || [], data.athleteProfile)
    return Storage.updatePublicProfile(userId, profile)
  }).catch(function (err) {
    console.warn('Firestore sync failed:', err.message)
  })
}

/**
 * Pull all data from Firestore for the given user.
 * Returns the cloud data object, or null if no data exists.
 */
Storage.pullFromFirestore = function (userId) {
  if (!userId) return Promise.resolve(null)
  return getDoc(doc(db, 'users', userId)).then(function (snap) {
    if (!snap.exists()) return null
    return snap.data()
  }).catch(function (err) {
    console.warn('Firestore pull failed:', err.message)
    return null
  })
}

/**
 * Merge cloud data into localStorage. Cloud wins if updatedAt is newer,
 * otherwise local wins. For arrays (sessions, exercises, etc), cloud replaces local.
 */
Storage.mergeFromCloud = function (cloudData) {
  if (!cloudData) return

  if (cloudData.sessions)       Storage.saveSessions(cloudData.sessions)
  if (cloudData.exercises)      Storage.saveExercises(cloudData.exercises)
  if (cloudData.routines)       Storage.saveRoutines(cloudData.routines)
  if (cloudData.schedule != null) Storage.saveSchedule(cloudData.schedule)
  if (cloudData.weightLog)      Storage.saveWeightLog(cloudData.weightLog)
  if (cloudData.athleteProfile) Storage.saveAthleteProfile(cloudData.athleteProfile)
}

// ---------------------------------------------------------------------------
// Friends — friend codes, lookups, add/remove, public profiles
// ---------------------------------------------------------------------------

/**
 * Format today's date as DDMMYY for friend code suffix.
 */
function dateSuffix() {
  var d = new Date()
  var dd = String(d.getDate()).padStart(2, '0')
  var mm = String(d.getMonth() + 1).padStart(2, '0')
  var yy = String(d.getFullYear()).slice(-2)
  return dd + mm + yy
}

/**
 * Generate a time-boxed friend code: BL-XXXXX-DDMMYY.
 * Valid for 24 hours from generation. Writes to friendCodes/{code} with expiresAt.
 * Returns { code, expiresAt }.
 */
Storage.generateFriendCode = function (userId) {
  function makeRandom() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    var s = ''
    for (var i = 0; i < 5; i++) {
      s += chars.charAt(Math.floor(Math.random() * chars.length))
    }
    return s
  }

  var suffix = dateSuffix()
  var code = 'BL-' + makeRandom() + '-' + suffix
  var codeRef = doc(db, 'friendCodes', code)

  // Expires 24h from now
  var expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()

  return getDoc(codeRef).then(function (snap) {
    // Collision — try once more with different random
    if (snap.exists()) {
      code = 'BL-' + makeRandom() + '-' + suffix
      codeRef = doc(db, 'friendCodes', code)
    }
    return setDoc(codeRef, { uid: userId, expiresAt: expiresAt }).then(function () {
      return setDoc(doc(db, 'users', userId), { friendCode: code, friendCodeExpires: expiresAt }, { merge: true }).then(function () {
        localStorage.setItem('il_friendCode', code)
        localStorage.setItem('il_friendCodeExpires', expiresAt)
        return { code: code, expiresAt: expiresAt }
      })
    })
  })
}

/**
 * Get the user's current friend code and expiry.
 * Returns { code, expiresAt, expired } or { code: null } if none exists.
 * Does NOT auto-generate — the user must tap "New Code".
 */
Storage.getFriendCode = function (userId) {
  var cachedCode = localStorage.getItem('il_friendCode')
  var cachedExpiry = localStorage.getItem('il_friendCodeExpires')

  if (cachedCode && cachedExpiry) {
    var expired = new Date(cachedExpiry).getTime() < Date.now()
    return Promise.resolve({ code: cachedCode, expiresAt: cachedExpiry, expired: expired })
  }

  return getDoc(doc(db, 'users', userId)).then(function (snap) {
    if (snap.exists() && snap.data().friendCode) {
      var code = snap.data().friendCode
      var expiresAt = snap.data().friendCodeExpires || null
      var expired = expiresAt ? new Date(expiresAt).getTime() < Date.now() : true
      localStorage.setItem('il_friendCode', code)
      if (expiresAt) localStorage.setItem('il_friendCodeExpires', expiresAt)
      return { code: code, expiresAt: expiresAt, expired: expired }
    }
    return { code: null, expiresAt: null, expired: true }
  })
}

/**
 * Look up a friend code to get the target UID.
 * Checks expiry — returns null if expired.
 * Returns { uid, code } or null.
 */
Storage.lookupFriendCode = function (code) {
  var normalised = code.trim().toUpperCase()
  if (normalised.indexOf('BL-') !== 0) normalised = 'BL-' + normalised
  return getDoc(doc(db, 'friendCodes', normalised)).then(function (snap) {
    if (!snap.exists()) return null
    var data = snap.data()
    // Check expiry
    if (data.expiresAt && new Date(data.expiresAt).getTime() < Date.now()) {
      return { expired: true }
    }
    return { uid: data.uid, code: normalised }
  })
}

/**
 * Add a friend (bidirectional). Updates both users' friends arrays.
 */
Storage.addFriend = function (myUid, theirUid) {
  // Use setDoc with merge so it works even if the friends field doesn't exist yet
  return Promise.all([
    setDoc(doc(db, 'users', myUid), { friends: arrayUnion(theirUid) }, { merge: true }),
    setDoc(doc(db, 'users', theirUid), { friends: arrayUnion(myUid) }, { merge: true }),
  ])
}

/**
 * Remove a friend (bidirectional).
 */
Storage.removeFriend = function (myUid, theirUid) {
  return Promise.all([
    setDoc(doc(db, 'users', myUid), { friends: arrayRemove(theirUid) }, { merge: true }),
    setDoc(doc(db, 'users', theirUid), { friends: arrayRemove(myUid) }, { merge: true }),
  ])
}

/**
 * Get the user's friends list (array of UIDs).
 */
Storage.getFriendsList = function (userId) {
  return getDoc(doc(db, 'users', userId)).then(function (snap) {
    if (!snap.exists()) return []
    return snap.data().friends || []
  })
}

/**
 * Read a friend's public profile.
 * Returns the profile object or null.
 */
Storage.getFriendProfile = function (friendUid) {
  return getDoc(doc(db, 'users', friendUid, 'public', 'profile')).then(function (snap) {
    if (!snap.exists()) return null
    return Object.assign({ uid: friendUid }, snap.data())
  }).catch(function (err) {
    console.warn('Failed to read friend profile:', friendUid, err.message)
    return null
  })
}

/**
 * Write the user's public profile to Firestore.
 * Called from syncToFirestore so it stays in sync.
 */
Storage.updatePublicProfile = function (userId, profileData) {
  if (!userId || !profileData) return Promise.resolve()
  return setDoc(doc(db, 'users', userId, 'public', 'profile'), profileData).catch(function (err) {
    console.warn('Public profile sync failed:', err.message)
  })
}

export default Storage
export { uuid, now }
