/**
 * Fetch candidate climbing walls from OpenStreetMap for the walls table
 * (docs/specs/betalog_walls_spec.md §5, BTL-B118).
 *
 *   cd betalog-react
 *   node scripts/fetch-walls.mjs                 # all areas
 *   node scripts/fetch-walls.mjs bristol swansea # some
 *
 * Writes scripts/walls.candidates.json and prints the list. It never touches
 * src/lib/walls.json — that file is the reviewed table, edited by hand from
 * these candidates. Needs the network (Overpass); run it from the laptop.
 * OSM data is ODbL: the app carries "© OpenStreetMap contributors".
 */
import { writeFileSync } from 'fs'
import { fileURLToPath } from 'url'
import path from 'path'

// Bounding boxes: south, west, north, east. Generous, so an out-of-town wall
// is caught; the review drops what is not wanted.
const AREAS = {
  bristol: { city: 'Bristol', bbox: [51.35, -2.75, 51.56, -2.45] },
  cardiff: { city: 'Cardiff', bbox: [51.40, -3.35, 51.60, -3.05] },
  swansea: { city: 'Swansea', bbox: [51.55, -4.05, 51.75, -3.80] },
}

const OVERPASS = 'https://overpass-api.de/api/interpreter'

function query(bbox) {
  const b = bbox.join(',')
  return `[out:json][timeout:60];
(
  nwr["sport"="climbing"]["leisure"="sports_centre"](${b});
  nwr["climbing"="gym"](${b});
  nwr["sport"="climbing"]["indoor"="yes"](${b});
  nwr["leisure"="climbing"](${b});
);
out center tags;`
}

function slug(name, city) {
  const s = (name + ' ' + city).toLowerCase().replace(/&/g, 'and').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return s
}

async function fetchArea(key) {
  const area = AREAS[key]
  const res = await fetch(OVERPASS, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'BetaLog walls fetch (betalog.co.uk)' },
    body: 'data=' + encodeURIComponent(query(area.bbox)),
  })
  if (!res.ok) throw new Error(`Overpass ${res.status} for ${key}`)
  const json = await res.json()
  const seen = new Set()
  const out = []
  for (const el of json.elements || []) {
    const t = el.tags || {}
    if (!t.name) continue
    const lat = el.lat ?? el.center?.lat
    const lng = el.lon ?? el.center?.lon
    if (typeof lat !== 'number' || typeof lng !== 'number') continue
    const k = t.name.toLowerCase() + '@' + lat.toFixed(3) + ',' + lng.toFixed(3)
    if (seen.has(k)) continue
    seen.add(k)
    out.push({
      id: slug(t.name, area.city),
      name: t.name,
      city: area.city,
      lat: Number(lat.toFixed(5)),
      lng: Number(lng.toFixed(5)),
      source: 'osm',
      osm: `${el.type}/${el.id}`,
      address: [t['addr:housenumber'], t['addr:street'], t['addr:city'], t['addr:postcode']].filter(Boolean).join(' '),
      website: t.website || t['contact:website'] || '',
      tags: { sport: t.sport, leisure: t.leisure, climbing: t.climbing, indoor: t.indoor },
    })
  }
  return out.sort((a, b) => a.name.localeCompare(b.name))
}

const wanted = process.argv.slice(2).filter(Boolean)
const keys = wanted.length ? wanted : Object.keys(AREAS)
const all = []
for (const key of keys) {
  if (!AREAS[key]) { console.error('unknown area', key, '— one of', Object.keys(AREAS).join(', ')); process.exit(1) }
  const list = await fetchArea(key)
  console.log(`\n${AREAS[key].city} — ${list.length} candidate${list.length === 1 ? '' : 's'}`)
  for (const w of list) console.log(`  ${w.name} | ${w.lat},${w.lng} | ${w.address || '—'} | ${w.website || '—'} | ${w.osm}`)
  all.push(...list)
  // Overpass asks for a pause between queries.
  await new Promise(r => setTimeout(r, 2000))
}

const here = path.dirname(fileURLToPath(import.meta.url))
const file = path.join(here, 'walls.candidates.json')
writeFileSync(file, JSON.stringify(all, null, 2) + '\n')
console.log(`\n${all.length} candidates → ${path.relative(process.cwd(), file)}. Review, then copy the keepers into src/lib/walls.json.`)
