// An in-memory Firestore: documents by path, collections by parent path,
// snapshot listeners, array sentinels, batches, array-contains queries.
// Enough for what storage.js does; no rules, no persistence.
// Kept in sessionStorage so a reload (or a page.goto in a test) does not
// forget the comp that was just created. One tab, one Firestore.
var SS_KEY = 'fakeFirestore'
var store = {}        // path -> data
try { store = JSON.parse(sessionStorage.getItem(SS_KEY) || '{}') || {} } catch { store = {} }
var listeners = []    // { path, isCollection, cb }
function persist() { try { sessionStorage.setItem(SS_KEY, JSON.stringify(store)) } catch { /* fine */ } }

if (typeof window !== 'undefined') window.__fakeFirestore = { store: store, seed: seed }

function seed(docs) { Object.keys(docs).forEach(function (p) { store[p] = clone(docs[p]) }); persist(); notify(null) }
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)) }
function parentOf(path) { return path.split('/').slice(0, -1).join('/') }
function idOf(path) { return path.split('/').pop() }

export function getFirestore() { return { fake: true } }
export function doc() { var segs = Array.prototype.slice.call(arguments, 1); return { kind: 'doc', path: segs.join('/') } }
export function collection() { var segs = Array.prototype.slice.call(arguments, 1); return { kind: 'collection', path: segs.join('/') } }
export function query(coll) { var cons = Array.prototype.slice.call(arguments, 1); return { kind: 'query', path: coll.path, where: cons } }
export function where(field, op, value) { return { field: field, op: op, value: value } }

var ARRAY_UNION = 'fake:arrayUnion', ARRAY_REMOVE = 'fake:arrayRemove'
export function arrayUnion() { return { __op: ARRAY_UNION, items: Array.prototype.slice.call(arguments) } }
export function arrayRemove() { return { __op: ARRAY_REMOVE, items: Array.prototype.slice.call(arguments) } }

function applySentinels(existing, data) {
  var out = {}
  Object.keys(data).forEach(function (k) {
    var v = data[k]
    if (v && v.__op === ARRAY_UNION) {
      var cur = Array.isArray(existing[k]) ? existing[k].slice() : []
      v.items.forEach(function (i) { if (cur.indexOf(i) === -1) cur.push(i) })
      out[k] = cur
    } else if (v && v.__op === ARRAY_REMOVE) {
      out[k] = (Array.isArray(existing[k]) ? existing[k] : []).filter(function (i) { return v.items.indexOf(i) === -1 })
    } else out[k] = clone(v)
  })
  return out
}

function snap(path) {
  var data = store[path]
  return {
    id: idOf(path), ref: { kind: 'doc', path: path },
    exists: function () { return data !== undefined },
    data: function () { return clone(data) },
  }
}

function matches(q, path) {
  if (parentOf(path) !== q.path) return false
  var d = store[path]
  return (q.where || []).every(function (w) {
    var v = d[w.field]
    if (w.op === 'array-contains') return Array.isArray(v) && v.indexOf(w.value) !== -1
    if (w.op === '==') return v === w.value
    return true
  })
}

function collectionSnap(q) {
  var docs = Object.keys(store).filter(function (p) { return matches(q, p) }).sort().map(snap)
  return { docs: docs, size: docs.length, empty: docs.length === 0 }
}

function notify(path) {
  listeners.slice().forEach(function (l) {
    if (l.isCollection) { if (path === null || parentOf(path) === l.path) l.cb(collectionSnap(l)) }
    else if (path === null || l.path === path) l.cb(snap(l.path))
  })
}

function write(path, data, merge) {
  var existing = store[path] || {}
  store[path] = merge ? Object.assign({}, existing, applySentinels(existing, data)) : applySentinels({}, data)
  persist()
  notify(path)
}

export function setDoc(ref, data, opts) { write(ref.path, data, !!(opts && opts.merge)); return Promise.resolve() }
export function updateDoc(ref, data) { if (store[ref.path] === undefined) return Promise.reject(new Error('No document to update')); write(ref.path, data, true); return Promise.resolve() }
export function deleteDoc(ref) { delete store[ref.path]; persist(); notify(ref.path); return Promise.resolve() }
export function getDoc(ref) { return Promise.resolve(snap(ref.path)) }
export function getDocFromServer(ref) { return getDoc(ref) }
export function getDocs(q) { return Promise.resolve(collectionSnap(q.kind === 'query' ? q : { path: q.path, where: [] })) }
export function onSnapshot(target, cb) {
  var l = { path: target.path, isCollection: target.kind !== 'doc', where: target.where || [], cb: cb }
  listeners.push(l)
  setTimeout(function () { l.cb(l.isCollection ? collectionSnap(l) : snap(l.path)) }, 0)
  return function () { listeners = listeners.filter(function (x) { return x !== l }) }
}
export function writeBatch() {
  var ops = []
  var b = {
    set: function (ref, data, opts) { ops.push(function () { write(ref.path, data, !!(opts && opts.merge)) }); return b },
    update: function (ref, data) { ops.push(function () { write(ref.path, data, true) }); return b },
    delete: function (ref) { ops.push(function () { delete store[ref.path]; persist(); notify(ref.path) }); return b },
    commit: function () { ops.forEach(function (f) { f() }); return Promise.resolve() },
  }
  return b
}
