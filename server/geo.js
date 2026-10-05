// Free location services, all without API keys:
//   India Post PIN API     api.postalpincode.in      -> district and mandal (block) for a PIN code
//   OpenStreetMap Nominatim nominatim.openstreetmap.org -> coordinates for a place
//   OpenStreetMap Overpass  overpass-api.de            -> real ITIs / polytechnics in a district
// Answers are cached in SQLite and requests are spaced out, as the services' usage policies ask.
import { getCache, setCache } from './db.js'
import { DISTRICTS, getDistrict } from '../src/data/districts.js'
import { MANDALS } from '../src/data/admin.js'

const UA = 'HunarSetu/0.2 (SIH26241 prototype; vocational counselling)'
const DAY = 864e5

async function getJson(url, { timeout = 20_000, init } = {}) {
  const ac = new AbortController()
  const timer = setTimeout(() => ac.abort(), timeout)
  try {
    const res = await fetch(url, { ...init, headers: { 'user-agent': UA, accept: 'application/json', ...(init?.headers ?? {}) }, signal: ac.signal })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '')
const ALIAS = { hanamkonda: 'hanumakonda', rayaparthy: 'raiparthy', bheemadevarpally: 'bheemadevarpalle', elkathurthi: 'elkathurthy', hasanparthi: 'hasanparthy' }
const canon = (s) => ALIAS[norm(s)] ?? norm(s)

function matchMandal(...names) {
  for (const n of names) {
    const c = canon(n)
    if (!c) continue
    const m = MANDALS.find((x) => canon(x.name) === c || (c.length >= 6 && canon(x.name).startsWith(c.slice(0, 6))))
    if (m) return m
  }
  return null
}

// India Post still lists the 2021 Hanumakonda district under "Warangal"; the mandal decides.
function matchDistrict(district, mandal) {
  const d = norm(district)
  if (['warangal', 'warangalurban', 'warangalrural', 'hanumakonda', 'hanamkonda'].includes(d)) return mandal?.district ?? 'warangal'
  if (d.startsWith('karimnagar')) return 'karimnagar'
  if (d.startsWith('khammam')) return 'khammam'
  if (d.startsWith('hyderabad') || d.startsWith('medchal') || d.startsWith('rangared')) return 'hyderabad'
  return null
}

// ---------- Nominatim (max one request per second) ----------
let nominatimQueue = Promise.resolve()
function throttled(fn) {
  const run = nominatimQueue.then(fn)
  nominatimQueue = run.catch(() => {}).then(() => new Promise((r) => setTimeout(r, 1100)))
  return run
}

// bbox [south, west, north, east] keeps the search inside one district, so "Karimnagar"
// finds Karimnagar town and not a village of the same name in another district.
export async function geocode(query, bbox) {
  const key = `geo2:${query.toLowerCase()}${bbox ? `@${bbox.join(',')}` : ''}`
  const hit = getCache(key, 30 * DAY)
  if (hit !== null && hit !== undefined) return hit
  let url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=in&q=${encodeURIComponent(query)}`
  if (bbox) {
    const [s, w, n, e] = bbox
    url += `&viewbox=${w},${n},${e},${s}&bounded=1`
  }
  const rows = await throttled(() => getJson(url))
  const r = rows?.[0]
  const value = r ? { lat: Number(r.lat), lon: Number(r.lon), label: r.display_name } : null
  setCache(key, value)
  return value
}

const pad = ([s, w, n, e], d) => [s - d, w - d, n + d, e + d]

// ---------- India Post PIN code ----------
export async function lookupPin(pin) {
  const key = `pin5:${pin}`
  const hit = getCache(key, 30 * DAY)
  if (hit) return hit
  const data = await getJson(`https://api.postalpincode.in/pincode/${pin}`)
  const offices = data?.[0]?.Status === 'Success' ? data[0].PostOffice ?? [] : []
  if (!offices.length) {
    const value = { pin, found: false }
    setCache(key, value)
    return value
  }
  const first = offices[0]
  const mandal = matchMandal(first.Block, ...offices.map((o) => o.Block), ...offices.map((o) => o.Name))
  const districtId = matchDistrict(first.District, mandal)
  let point = null
  const box = districtId ? pad(getDistrict(districtId).bbox, 0.05) : null
  // Where to put the pin: the block (mandal) most offices of this PIN belong to, else its main
  // post office (head, then sub office); branch offices are often small villages.
  const blocks = offices.map((o) => o.Block).filter((b) => b && b !== 'NA')
  const block = blocks.sort((a, b) => blocks.filter((x) => x === b).length - blocks.filter((x) => x === a).length)[0] ?? null
  const main = offices.find((o) => o.BranchType === 'Head Post Office') ?? offices.find((o) => o.BranchType === 'Sub Post Office') ?? first
  const place = block ?? main.Name.replace(/\s+(H\.?O|S\.?O|B\.?O)\.?$/i, '')
  try {
    point = (await geocode(`${place}, ${first.District}, ${first.State}`, box)) ?? (await geocode(`${place}, ${first.State}`, box)) ?? (box ? null : await geocode(`${first.District}, ${first.State}`))
  } catch {
    /* coordinates are optional */
  }
  if (!point && districtId) point = { lat: getDistrict(districtId).center[0], lon: getDistrict(districtId).center[1], label: getDistrict(districtId).name.en }
  const value = {
    pin,
    found: true,
    state: first.State,
    district: first.District,
    block,
    places: [...new Set(offices.map((o) => o.Name))].slice(0, 8),
    districtId,
    inPilot: !!districtId,
    mandal: mandal && mandal.district === districtId ? mandal.name : null,
    point,
    source: 'India Post',
  }
  setCache(key, value)
  return value
}

// ---------- Overpass: real training institutes from OpenStreetMap ----------
const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter']
const NAME_RE = '(^|[^A-Za-z])ITI([^A-Za-z]|$)|Industrial Training|Polytechnic|Skill Development|Vocational'

function kindOf(name) {
  if (/(^|[^a-z])iti([^a-z]|$)|industrial training/i.test(name)) return 'iti'
  if (/polytechnic/i.test(name)) return 'polytechnic'
  return 'skill'
}

export function km(a, b) {
  const R = 6371
  const toRad = (d) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLon = toRad(b.lon - a.lon)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

async function fetchPlaces(districtId) {
  const [s, w, n, e] = getDistrict(districtId).bbox
  const query = `[out:json][timeout:25];nwr["name"~"${NAME_RE}",i][!highway][!railway](${s},${w},${n},${e});out center 80;`
  let lastError
  for (const host of OVERPASS) {
    try {
      const data = await getJson(host, {
        timeout: process.env.VERCEL ? 25_000 : 35_000, // two mirrors must fit in Vercel's 60 s limit
        init: { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: `data=${encodeURIComponent(query)}` },
      })
      const seen = []
      const places = []
      for (const el of data.elements ?? []) {
        const t = el.tags ?? {}
        const name = t.name
        const lat = el.lat ?? el.center?.lat
        const lon = el.lon ?? el.center?.lon
        if (!name || lat == null || /ground|road|street|bus stop|junction/i.test(name)) continue
        // Same name within 400 m is the same campus mapped twice.
        if (seen.some((p) => norm(p.name) === norm(name) && km(p, { lat, lon }) < 0.4)) continue
        const place = { name, kind: kindOf(name), lat, lon, osm: `https://www.openstreetmap.org/${el.type}/${el.id}`, address: [t['addr:street'], t['addr:city']].filter(Boolean).join(', ') || null }
        seen.push(place)
        places.push(place)
      }
      return places
    } catch (err) {
      lastError = err
    }
  }
  throw lastError ?? new Error('overpass unavailable')
}

export async function trainingPlaces(districtId, near) {
  const key = `places:${districtId}`
  let places = getCache(key, 7 * DAY)
  let stale = false
  if (!places) {
    try {
      places = await fetchPlaces(districtId)
      setCache(key, places)
    } catch {
      places = getCache(key, Infinity) // an old answer is better than none
      stale = true
    }
  }
  if (!places) return { places: [], available: false, source: 'OpenStreetMap' }
  // A saved location far outside this district (e.g. an old, wrong lookup) is ignored.
  const [s, w, n, e] = pad(getDistrict(districtId).bbox, 0.15)
  if (near && !(near.lat >= s && near.lat <= n && near.lon >= w && near.lon <= e)) near = null
  const from = near ?? { lat: getDistrict(districtId).center[0], lon: getDistrict(districtId).center[1] }
  // The same campus is sometimes mapped twice under different names ("Govt Polytechnic Clg Wgl"
  // and "Government Polytechnic College"): keep one place per kind within 150 m, with the fuller name.
  const unique = []
  for (const p of places) {
    const twin = unique.find((u) => u.kind === p.kind && km(u, p) < 0.15)
    if (!twin) unique.push(p)
    else if (p.name.length > twin.name.length) unique[unique.indexOf(twin)] = p
  }
  const withDistance = unique
    .map((p) => ({ ...p, km: Math.round(km(from, p) * 10) / 10, directions: `https://www.openstreetmap.org/directions?route=${from.lat}%2C${from.lon}%3B${p.lat}%2C${p.lon}` }))
    .sort((a, b) => (a.kind === b.kind ? a.km - b.km : a.kind === 'iti' ? -1 : b.kind === 'iti' ? 1 : a.km - b.km))
  return { places: withDistance.slice(0, 12), available: true, stale, from: near ? 'family' : 'district centre', origin: from, source: 'OpenStreetMap' }
}

export const PILOT_DISTRICTS = DISTRICTS.map((d) => d.id)
