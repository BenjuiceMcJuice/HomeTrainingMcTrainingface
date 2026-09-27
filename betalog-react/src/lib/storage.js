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
 *   il_calendarFeed   CalendarFeed | null
 *   il_pushSub        PushSub | null   (device-local, deliberately NOT synced)
 *   il_compEntries    CompEntryRef[]   (competitions entered or organised)
 *   il_compDraft      Competition | null  (the draft being built; device-local, not synced)
 *
 * @see betalog_data_model.md
 * @see src/lib/types.js
 */

import { db } from './firebase'
import { doc, setDoc, getDoc, getDocFromServer, deleteDoc, onSnapshot, arrayUnion, arrayRemove, collection, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { buildPublicProfileWithBase, PUBLIC_PROFILE_VERSION } from './goals'
import { COMP_SCHEMA_VERSION, makeCode, revealGrades, splitHiddenGrades, applyAmend, emptyResult, normaliseResult, compClockFields } from './competition'

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
    // Weight log key changed from snake_case to camelCase — migrate on first load
    var weightLog = readJson('il_weightLog', null)
    if (weightLog === null) {
      weightLog = readJson('il_weight_log', [])
      if (weightLog.length > 0) {
        writeJson('il_weightLog', weightLog)
        localStorage.removeItem('il_weight_log')
      }
    }
    var profile      = readJson('il_athleteProfile', null)
    var badges       = readJson('il_badges',    [])
    var groqKey      = localStorage.getItem('il_groq_key') || ''
    // Device-local, like the Groq key: headphones belong to a phone, not an account
    var audioOffsetMs  = parseInt(localStorage.getItem('il_audioOffsetMs'), 10)
    var audioLatencyMs = parseInt(localStorage.getItem('il_audioLatencyMs'), 10)
    var goals        = readJson('il_goals', [])
    var drinkLog     = readJson('il_drinkLog', [])
    var calendarFeed = readJson('il_calendarFeed', null)
    var pushSub      = readJson('il_pushSub', null)
    var weekScores   = readJson('il_weekScores', [])
    var compEntries  = readJson('il_compEntries', [])

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
      audioOffsetMs:  isNaN(audioOffsetMs)  ? 0    : audioOffsetMs,
      audioLatencyMs: isNaN(audioLatencyMs) ? null : audioLatencyMs,
      goals:          goals,
      drinkLog:       drinkLog,
      calendarFeed:   calendarFeed,
      pushSub:        pushSub,
      weekScores:     weekScores,
      compEntries:    compEntries,
    }
  },

  /** @param {import('./types').CompEntryRef[]} refs */
  saveCompEntries: function (refs) {
    writeJson('il_compEntries', refs)
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

  /** @param {import('./types').CalendarFeed | null} feed */
  saveCalendarFeed: function (feed) {
    writeJson('il_calendarFeed', feed)
  },

  /**
   * The push reminder subscription for THIS device.
   *
   * Deliberately absent from SYNC_KEYS. A calendar feed is one URL per user and
   * is meant to be shared between their devices; a push subscription is the
   * opposite — the endpoint is issued by this browser on this device, and
   * syncing it would hand the phone's endpoint to the laptop, where revoking on
   * one would silently break the other. Each device subscribes for itself.
   * @param {object | null} sub
   */
  savePushSub: function (sub) {
    writeJson('il_pushSub', sub)
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

  /** @param {import('./types').Goal[]} goals */
  saveGoals: function (goals) {
    writeJson('il_goals', goals)
  },

  /** @param {import('./types').DrinkEntry[]} entries */
  saveDrinkLog: function (entries) {
    writeJson('il_drinkLog', entries)
  },

  /** @param {import('./types').WeekScore[]} records */
  saveWeekScores: function (records) {
    writeJson('il_weekScores', records)
  },

  /** @param {string} key */
  saveGroqKey: function (key) {
    localStorage.setItem('il_groq_key', key)
  },

  /** Settings › Beep timing — how far ahead the hangboard cues play, ms. Device-local. */
  saveAudioOffsetMs: function (ms) {
    localStorage.setItem('il_audioOffsetMs', String(ms || 0))
  },

  /** What the audio context last reported as its own latency, ms — shown in Settings so the offset can be judged. */
  saveAudioLatencyMs: function (ms) {
    localStorage.setItem('il_audioLatencyMs', String(ms || 0))
  },

  /** Returns true if il_exercises has never been written (new user / fresh install) */
  hasNoExercises: function () {
    return localStorage.getItem('il_exercises') === null
  },
}

// ---------------------------------------------------------------------------
// Firestore sync — write to cloud alongside localStorage
// ---------------------------------------------------------------------------

var SYNC_KEYS = ['sessions', 'exercises', 'routines', 'schedule', 'weightLog', 'athleteProfile', 'goals', 'drinkLog', 'calendarFeed', 'weekScores', 'compEntries']

/**
 * Write all syncable data to Firestore for the given user.
 * Called after every localStorage save. Fire-and-forget (no await).
 * @param {string} userId
 * @param {object} [data] - already-computed data object; falls back to Storage.load() if omitted
 * @param {function} [onError] - called with the Error if the Firestore write fails
 * @param {{ email?: string, displayName?: string }} [authMeta] - Firebase auth metadata to store for admin visibility
 */
Storage.syncToFirestore = function (userId, data, onError, authMeta) {
  if (!userId) return
  var d = data || Storage.load()
  var payload = {}
  SYNC_KEYS.forEach(function (key) {
    payload[key] = d[key] != null ? d[key] : null
  })
  payload.updatedAt = now()
  if (authMeta) {
    if (authMeta.email)       payload.email           = authMeta.email
    if (authMeta.displayName) payload.authDisplayName = authMeta.displayName
  }
  // Fire main doc and public profile in parallel — don't gate one on the other
  setDoc(doc(db, 'users', userId), payload, { merge: true }).catch(function (err) {
    console.warn('Firestore sync failed:', err.message)
    if (onError) onError(err)
  })
  // With the pyramid's base on it — Q3, 2026-09-13: friends see what you see.
  var profile = buildPublicProfileWithBase(d.sessions || [], d.athleteProfile)
  Storage.updatePublicProfile(userId, profile)
  writeJson(PROFILE_VERSION_KEY, PUBLIC_PROFILE_VERSION)
}

var PROFILE_VERSION_KEY = 'il_publicProfileVersion'

/**
 * Republish the public profile once after an update that changed its shape.
 *
 * The profile is otherwise written only when the log changes, so a climber who
 * updates the app and then rests would keep the old document up and read as
 * *not shared yet* to their friends until their next session. Called on
 * sign-in after the cloud merge, so it reads the merged log. The whole log is
 * on the device already; nothing older needs fetching.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
Storage.republishProfileIfStale = function (userId) {
  if (!userId) return Promise.resolve()
  if (readJson(PROFILE_VERSION_KEY, 0) === PUBLIC_PROFILE_VERSION) return Promise.resolve()
  var d = Storage.load()
  var profile = buildPublicProfileWithBase(d.sessions || [], d.athleteProfile)
  return Storage.updatePublicProfile(userId, profile).then(function () {
    writeJson(PROFILE_VERSION_KEY, PUBLIC_PROFILE_VERSION)
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
  if (cloudData.goals)          Storage.saveGoals(cloudData.goals)
  if (cloudData.drinkLog)       Storage.saveDrinkLog(cloudData.drinkLog)
  if (cloudData.calendarFeed != null) Storage.saveCalendarFeed(cloudData.calendarFeed)
  if (cloudData.compEntries)    Storage.saveCompEntries(cloudData.compEntries)

  // Week scores are unioned by week, not replaced. A sealed week is a record of
  // what happened, so whichever device wrote it first wins and nothing is lost
  // when two devices sealed different weeks while offline. Replacing the way
  // every other key does would drop weeks this device sealed but never synced.
  if (cloudData.weekScores) {
    var localWeeks = readJson('il_weekScores', [])
    var byWeek = {}
    cloudData.weekScores.forEach(function (r) { if (r && r.weekStart) byWeek[r.weekStart] = r })
    localWeeks.forEach(function (r) {
      if (!r || !r.weekStart) return
      var existing = byWeek[r.weekStart]
      if (!existing || (r.sealedAt && existing.sealedAt && r.sealedAt < existing.sealedAt)) {
        byWeek[r.weekStart] = r
      }
    })
    Storage.saveWeekScores(Object.keys(byWeek).sort().map(function (k) { return byWeek[k] }))
  }
}

// ---------------------------------------------------------------------------
// Admin — cross-user reads (requires admin UID bypass in firestore.rules)
// ---------------------------------------------------------------------------

/**
 * Fetch all user documents. Only succeeds when called by the admin UID
 * (enforced server-side by Firestore rules).
 * @returns {Promise<object[]>} array of user data objects with `uid` set to doc ID
 */
Storage.getAllUsersForAdmin = function () {
  return getDocs(collection(db, 'users')).then(function (snap) {
    return snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()) })
  }).catch(function (err) {
    console.warn('Admin users fetch failed:', err.message)
    return []
  })
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

  function tryGenerate(attemptsLeft) {
    if (attemptsLeft <= 0) return Promise.reject(new Error('Could not generate a unique friend code'))
    return getDoc(codeRef).then(function (snap) {
      if (snap.exists()) {
        code = 'BL-' + makeRandom() + '-' + suffix
        codeRef = doc(db, 'friendCodes', code)
        return tryGenerate(attemptsLeft - 1)
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
  return tryGenerate(5)
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
  return getDocFromServer(doc(db, 'users', friendUid, 'public', 'profile')).then(function (snap) {
    if (!snap.exists()) return null
    return Object.assign({ uid: friendUid }, snap.data())
  }).catch(function (err) {
    console.warn('Failed to read friend profile:', friendUid, err.message)
    return null
  })
}

/**
 * Watch friends' public profiles while the friends screen is open, so the
 * board moves when a friend logs a session — within a second of their sync,
 * not on the next app start (Ben, 2026-09-18: *"remains current / live"*).
 *
 * `onChange` gets the full list, in `uids` order, once every profile has
 * reported at least once — so the list never briefly shrinks while the first
 * snapshots arrive — and again on every change after that. A friend with no
 * profile document is left out, as `getFriendProfile` leaves them out.
 *
 * @param {string[]} uids
 * @param {function(object[]): void} onChange
 * @returns {function(): void} unsubscribe
 */
Storage.watchFriendProfiles = function (uids, onChange) {
  var profiles = {}
  var pending = uids.length
  function emit() {
    if (pending > 0) return
    onChange(uids.map(function (u) { return profiles[u] }).filter(function (p) { return p !== null }))
  }
  var unsubs = uids.map(function (uid) {
    var seen = false
    return onSnapshot(doc(db, 'users', uid, 'public', 'profile'), function (snap) {
      profiles[uid] = snap.exists() ? Object.assign({ uid: uid }, snap.data()) : null
      if (!seen) { seen = true; pending-- }
      emit()
    }, function (err) {
      console.warn('Failed to watch friend profile:', uid, err.message)
      profiles[uid] = null
      if (!seen) { seen = true; pending-- }
      emit()
    })
  })
  return function () { unsubs.forEach(function (u) { u() }) }
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

// ---------------------------------------------------------------------------
// Competitions — docs/specs/betalog_competitions_spec.md §10
//
// competitions/{code}            the comp; the join code is the document id
// competitions/{code}/private/grades   hidden grades, organisers only
// competitions/{code}/entries/{uid}    one card per entrant
//
// Everything here is a thin door to Firestore. The maths — scoring, the
// card reducer, the climbs a card implies — is in lib/competition.js, and
// the entrant's own card lives on their session in il_sessions; these calls
// only mirror it. Nothing here touches il_sessions.
// ---------------------------------------------------------------------------

var COMP_DRAFT_KEY = 'il_compDraft'

/** The one draft being built on this device — not synced (spec §9). */
Storage.loadCompDraft = function () { return readJson(COMP_DRAFT_KEY, null) }
Storage.saveCompDraft = function (comp) { writeJson(COMP_DRAFT_KEY, comp) }
Storage.clearCompDraft = function () { localStorage.removeItem(COMP_DRAFT_KEY) }

function compRef(code) { return doc(db, 'competitions', code) }
function compGradesRef(code) { return doc(db, 'competitions', code, 'private', 'grades') }
function compEntryRef(code, uid) { return doc(db, 'competitions', code, 'entries', uid) }

/**
 * The document for Firestore: the comp less its code (which is the id), with
 * the clock stamped on as epoch ms so the rules can open and lock cards on
 * it (spec §7d).
 */
function compPayload(comp) {
  var out = Object.assign({}, comp, compClockFields(comp))
  delete out.code
  return out
}

/**
 * The comp as the app holds it: the document's data plus its code. The code
 * goes on last — a draft carries `code: null`, and the first walkthrough
 * navigated to /comp/null because it came first.
 */
export function withCode(code, data) {
  return Object.assign({}, data, { code: code })
}

/**
 * Create the comp document under a fresh join code. Called by *Open entries*
 * on a draft that has no code yet: the draft lives only on the organiser's
 * device until then. Tries five codes against collisions, as friend codes do.
 *
 * The comp is written with `status: 'draft'` (the rules insist on it) and
 * then moved to `open` in the same call, so a comp that exists in Firestore
 * is always joinable or beyond.
 *
 * @param {import('./types').Competition} comp - as edited, hidden grades present on `problems`
 * @returns {Promise<import('./types').Competition>} the comp as stored, with its code
 */
Storage.createComp = function (comp) {
  var split = splitHiddenGrades(comp.problems)
  var ts = now()
  var base = Object.assign({}, comp, {
    schemaVersion: COMP_SCHEMA_VERSION,
    status: 'draft',
    problems: split.problems,
    createdAt: comp.createdAt || ts,
    updatedAt: ts,
  })

  function tryCreate(attemptsLeft) {
    if (attemptsLeft <= 0) return Promise.reject(new Error('Could not find a free competition code'))
    var code = makeCode()
    return getDoc(compRef(code)).then(function (snap) {
      if (snap.exists()) return tryCreate(attemptsLeft - 1)
      return setDoc(compRef(code), compPayload(base)).then(function () {
        var batch = writeBatch(db)
        batch.set(compGradesRef(code), split.grades)
        batch.update(compRef(code), { status: 'open', updatedAt: now() })
        return batch.commit()
      }).then(function () {
        return withCode(code, Object.assign({}, base, { status: 'open' }))
      })
    })
  }
  return tryCreate(5)
}

/**
 * Read a comp by its code — the join step, and every cold open. Resolves
 * null when there is no such comp. A newer schema than this build knows
 * rejects with a message the UI shows as it is.
 * @param {string} code
 * @returns {Promise<import('./types').Competition|null>}
 */
Storage.getComp = function (code) {
  return getDoc(compRef(code)).then(function (snap) {
    if (!snap.exists()) return null
    var data = snap.data()
    if (typeof data.schemaVersion === 'number' && data.schemaVersion > COMP_SCHEMA_VERSION) {
      throw new Error('Update BetaLog to see this competition')
    }
    return withCode(code, data)
  })
}

/**
 * Watch a comp while a screen shows it — status changes, a problem added,
 * grades revealed at close. `onChange(null)` if it is deleted.
 * @returns {function(): void} unsubscribe
 */
Storage.watchComp = function (code, onChange, onError) {
  return onSnapshot(compRef(code), function (snap) {
    onChange(snap.exists() ? withCode(code, snap.data()) : null)
  }, function (err) {
    console.warn('watchComp failed:', code, err.message)
    if (onError) onError(err)
  })
}

/**
 * Organiser saves an existing comp. Hidden grades are split off to the
 * private document and both are written in one batch, so the public copy
 * never carries a grade the setter hid.
 * @param {import('./types').Competition} comp - as edited, grades present
 * @returns {Promise<import('./types').Competition>}
 */
Storage.saveComp = function (comp) {
  if (!comp.code) return Promise.reject(new Error('This competition has no code yet'))
  var split = splitHiddenGrades(comp.problems)
  var stored = Object.assign({}, comp, { problems: split.problems, updatedAt: now() })
  // The stage is not the editor's to write: the clock or a Manage button may
  // have moved it on while the editor was open. Merge, without status.
  var payload = compPayload(stored)
  delete payload.status
  delete payload.closedAt
  var batch = writeBatch(db)
  batch.set(compRef(comp.code), payload, { merge: true })
  batch.set(compGradesRef(comp.code), split.grades)
  return batch.commit().then(function () { return stored })
}

/** The private grades document, organisers only. `{}` when there is none. */
Storage.getCompGrades = function (code) {
  return getDoc(compGradesRef(code)).then(function (snap) { return snap.exists() ? snap.data() : {} })
}

/**
 * The organiser's own view: the comp with hidden grades put back, so the
 * editor shows what the setter typed. Entrants cannot read the private
 * document, so this is organiser-only by the rules, not by this code.
 * @returns {Promise<import('./types').Competition|null>}
 */
Storage.getCompForOrganiser = function (code) {
  return Promise.all([Storage.getComp(code), getDoc(compGradesRef(code))]).then(function (res) {
    var comp = res[0]
    if (!comp) return null
    var grades = res[1].exists() ? res[1].data() : {}
    return Object.assign({}, comp, { problems: revealGrades(comp.problems, grades) })
  })
}

/**
 * A new end for scoring — *Change end time* while running, or *Reopen
 * scoring* from judging (which also puts the comp back to running). The
 * automatic end goes back on: a picked end is an end.
 * @param {import('./types').Competition} comp - as now stored
 * @param {{endDate: string|null, endAt: string}} fields
 * @param {boolean} reopen
 * @returns {Promise<void>}
 */
Storage.setCompEnd = function (comp, fields, reopen) {
  var next = Object.assign({}, comp, fields, { autoClose: true })
  var patch = {
    endDate: next.endDate || null,
    endAt: next.endAt,
    autoClose: true,
    endMs: compClockFields(next).endMs,
    updatedAt: now(),
  }
  if (reopen) patch.status = 'live'
  return setDoc(compRef(comp.code), patch, { merge: true })
}

/**
 * Move a comp along: open → live → judging → closed. Close copies the hidden grades
 * onto the comp document and empties the private one, in one batch — the
 * moment the results are final is the moment the grades are public.
 * @param {string} code
 * @param {'open'|'live'|'judging'|'closed'} status
 * @returns {Promise<void>}
 */
Storage.setCompStatus = function (code, status) {
  var ts = now()
  if (status !== 'closed') {
    return setDoc(compRef(code), { status: status, updatedAt: ts }, { merge: true })
  }
  return Promise.all([getDoc(compRef(code)), getDoc(compGradesRef(code))]).then(function (res) {
    if (!res[0].exists()) throw new Error('Competition not found')
    var comp = res[0].data()
    var grades = res[1].exists() ? res[1].data() : {}
    var batch = writeBatch(db)
    batch.update(compRef(code), {
      status: 'closed',
      closedAt: ts,
      updatedAt: ts,
      problems: revealGrades(comp.problems || [], grades),
    })
    batch.set(compGradesRef(code), {})
    return batch.commit()
  })
}

/**
 * Organiser deletes a comp — its entries and private grades with it, in
 * batches of 400 (Firestore's limit is 500 writes per batch).
 * @returns {Promise<void>}
 */
Storage.deleteComp = function (code) {
  return getDocs(collection(db, 'competitions', code, 'entries')).then(function (snap) {
    var docs = snap.docs
    var batches = []
    for (var i = 0; i < docs.length; i += 400) {
      var b = writeBatch(db)
      docs.slice(i, i + 400).forEach(function (d) { b.delete(d.ref) })
      batches.push(b.commit())
    }
    return Promise.all(batches)
  }).then(function () {
    var b = writeBatch(db)
    b.delete(compGradesRef(code))
    b.delete(compRef(code))
    return b.commit()
  })
}

/**
 * The comps this account organises, from Firestore — rebuilds the local
 * `compEntries` list when it is lost. Entrants' comps cannot be listed this
 * way (no query is allowed on entries); they come from the local list.
 * @returns {Promise<import('./types').Competition[]>}
 */
Storage.listOrganised = function (uid) {
  var q = query(collection(db, 'competitions'), where('organisers', 'array-contains', uid))
  return getDocs(q).then(function (snap) {
    return snap.docs.map(function (d) { return withCode(d.id, d.data()) })
  })
}

/**
 * Enter a comp: create the entry document. The rules allow this only while
 * the comp is open or live, and only for one's own uid.
 * @param {string} code
 * @param {string} uid
 * @param {{displayName: string, category: string}} details
 * @returns {Promise<import('./types').CompEntry>}
 */
Storage.enterComp = function (code, uid, details) {
  var ts = now()
  var entry = {
    displayName: details.displayName,
    category: details.category,
    card: {},
    voids: [],
    enteredAt: ts,
    updatedAt: ts,
  }
  return setDoc(compEntryRef(code, uid), entry).then(function () { return entry })
}

/**
 * Change name or category before scoring starts (the rules refuse it after).
 */
Storage.saveEntryDetails = function (code, uid, details) {
  return setDoc(compEntryRef(code, uid), {
    displayName: details.displayName,
    category: details.category,
    updatedAt: now(),
  }, { merge: true })
}

/**
 * Mirror the entrant's card. The whole card every time, so a lost write is
 * repaired by the next one and a reconnect can re-push without knowing
 * what was missed. Only `card` and `updatedAt` change — the rules insist.
 * @param {string} code
 * @param {string} uid
 * @param {Object<string, import('./types').ProblemResult>} card
 * @returns {Promise<void>}
 */
Storage.saveEntryCard = function (code, uid, card) {
  return setDoc(compEntryRef(code, uid), { card: card || {}, updatedAt: now() }, { merge: true })
}

/** Withdraw before scoring starts. */
Storage.withdrawEntry = function (code, uid) {
  return deleteDoc(compEntryRef(code, uid))
}

/**
 * One entry, once. Null if the account has not entered. The rules let an
 * entry be read only by someone already entered (or an organiser), so for an
 * account that has not entered the read of its own entry is refused rather
 * than empty — that refusal is the "not entered" answer (BTL-B82).
 */
Storage.getEntry = function (code, uid) {
  return getDoc(compEntryRef(code, uid)).then(function (snap) {
    return snap.exists() ? Object.assign({ uid: uid }, snap.data()) : null
  }, function (err) {
    if (err && err.code === 'permission-denied') return null
    throw err
  })
}

/**
 * Watch one entry — the entrant's own, for voids arriving from the
 * organiser while the card is open. `onChange(null)` if it is deleted.
 * @returns {function(): void} unsubscribe
 */
Storage.watchEntry = function (code, uid, onChange, onError) {
  return onSnapshot(compEntryRef(code, uid), function (snap) {
    onChange(snap.exists() ? Object.assign({ uid: uid }, snap.data()) : null)
  }, function (err) {
    console.warn('watchEntry failed:', code, err.message)
    if (onError) onError(err)
  })
}

/**
 * Watch every entry — the leaderboard. One subscription while the board is
 * on screen; the caller throttles how often it redraws (spec §10).
 * @param {string} code
 * @param {function(object[]): void} onChange - every entry, each with `uid`
 * @returns {function(): void} unsubscribe
 */
Storage.watchEntries = function (code, onChange, onError) {
  return onSnapshot(collection(db, 'competitions', code, 'entries'), function (snap) {
    onChange(snap.docs.map(function (d) { return Object.assign({ uid: d.id }, d.data()) }))
  }, function (err) {
    console.warn('watchEntries failed:', code, err.message)
    if (onError) onError(err)
  })
}

/**
 * Organiser voids one problem on one card: the result goes back to no goes
 * and `voids` records what it was, who, when and why. Read-then-write, not
 * a transaction: two organisers voiding the same problem at once is not a
 * failure mode worth the code.
 * @param {string} code
 * @param {string} uid - the entrant
 * @param {string} problemId
 * @param {{by: string, note: string}} who
 * @returns {Promise<void>}
 */
Storage.voidProblem = function (code, uid, problemId, who) {
  return Storage.amendProblem(code, uid, problemId, emptyResult(), who)
}

/**
 * Organiser sets one problem on one card to `result` - a void is the
 * amendment to no goes. `voids` records before and after, who, when and why;
 * the climber's phone applies the record's `after` (BTL-B85). The same
 * read-then-write as the void always was.
 * @param {string} code
 * @param {string} uid - the entrant
 * @param {string} problemId
 * @param {import('./types').ProblemResult} result
 * @param {{by: string, note: string, scoring?: object}} who
 * @returns {Promise<void>}
 */
Storage.amendProblem = function (code, uid, problemId, result, who) {
  return getDoc(compEntryRef(code, uid)).then(function (snap) {
    if (!snap.exists()) throw new Error('No card for that entrant')
    var entry = snap.data()
    var ts = now()
    var scoring = who.scoring || null
    var before = normaliseResult((entry.card || {})[problemId], scoring)
    var card = applyAmend(entry.card || {}, problemId, result, scoring, ts)
    var after = Object.assign({}, card[problemId], { at: null })
    var kind = after.attempts > 0 ? 'amend' : 'void'
    var voids = (entry.voids || []).concat([{ problemId: problemId, by: who.by, at: ts, note: who.note || '', before: before, after: after, kind: kind }])
    return setDoc(compEntryRef(code, uid), {
      card: card,
      voids: voids,
      updatedAt: ts,
    }, { merge: true })
  })
}

// ---------------------------------------------------------------------------
// Account deletion — Settings › Account › Delete account (BTL-B32)
// ---------------------------------------------------------------------------

/**
 * Every localStorage key BetaLog owns. All of them start `il_` (the prefix
 * predates the name); Firebase's own auth keys do not, and are cleared by
 * deleting the user. Pure so the prefix rule can be tested.
 * @param {string[]} keys - every key currently in localStorage
 * @returns {string[]}
 */
export function betalogKeys(keys) {
  return keys.filter(function (k) { return typeof k === 'string' && k.indexOf('il_') === 0 })
}

/** Remove everything BetaLog keeps on this device. */
Storage.clearLocal = function () {
  var keys = []
  for (var i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i))
  betalogKeys(keys).forEach(function (k) { localStorage.removeItem(k) })
}

/**
 * Delete everything this user has in Firestore, in the order that leaves
 * nothing reachable if it stops part-way: first take them off every friend's
 * list (so no friend is left pointing at them), then the friend-visible
 * profile, then the friend code, then the main document.
 *
 * The friend code step can fail on rules that predate owner deletion of
 * `friendCodes`; that is tolerated, because an expired code pointing at a
 * uid with no documents behind it reveals nothing. Every other step must
 * succeed, or the promise rejects and the caller keeps the account.
 *
 * @param {string} userId
 * @returns {Promise<void>}
 */
Storage.deleteCloudData = function (userId) {
  var userRef = doc(db, 'users', userId)
  return getDoc(userRef).then(function (snap) {
    var d = snap.exists() ? snap.data() : {}
    var friends = Array.isArray(d.friends) ? d.friends : []
    var code = d.friendCode || localStorage.getItem('il_friendCode')

    return Promise.all(friends.map(function (f) {
      // A friend whose own account is gone has no document to update — fine.
      return setDoc(doc(db, 'users', f), { friends: arrayRemove(userId) }, { merge: true }).catch(function (err) {
        console.warn('Could not unlink friend', f, err.message)
      })
    }))
      .then(function () { return deleteDoc(doc(db, 'users', userId, 'public', 'profile')) })
      .then(function () {
        if (!code) return
        return deleteDoc(doc(db, 'friendCodes', code)).catch(function (err) {
          console.warn('Friend code not deleted:', err.message)
        })
      })
      .then(function () { return deleteDoc(userRef) })
  })
}

export default Storage
export { uuid, now }
