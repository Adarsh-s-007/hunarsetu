import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, Navigation, Map as MapIcon } from 'lucide-react'
import { useApp } from '../AppContext'
import { nearbyPlaces } from '../lib/api.js'

const KIND_COLOR = { iti: '#1d6a69', polytechnic: '#2a78d6', skill: '#d9851a' }

function FitAll({ points }) {
  const map = useMap()
  useEffect(() => {
    if (points.length) map.fitBounds(points, { padding: [28, 28], maxZoom: 13 })
  }, [map, points.map((p) => p.join(',')).join(';')]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

const pin = (html, cls) => L.divIcon({ className: `map-pin ${cls}`, html, iconSize: [28, 28], iconAnchor: [14, 14] })

// The family (or the district centre) and the listed places, numbered like the list below.
function PlacesMap({ places, origin, fromFamily }) {
  const { t } = useApp()
  const points = [[origin.lat, origin.lon], ...places.map((p) => [p.lat, p.lon])]
  return (
    <div className="places-map">
      <MapContainer center={points[0]} zoom={11} scrollWheelZoom={false} className="map map-sm">
        <TileLayer attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={19} />
        <FitAll points={points} />
        <Marker position={points[0]} icon={pin('<span>★</span>', 'is-origin')} zIndexOffset={1000}>
          <Tooltip direction="top" offset={[0, -14]}>{t(fromFamily ? 'places.you' : 'places.town')}</Tooltip>
        </Marker>
        {places.map((p, i) => (
          <Marker key={p.osm} position={[p.lat, p.lon]} icon={pin(`<span style="background:${KIND_COLOR[p.kind]}">${i + 1}</span>`, '')}>
            <Tooltip direction="top" offset={[0, -14]}>
              {i + 1}. {p.name} · {p.km} km
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>
      <p className="places-map-key">
        {[
          ['is-origin', '#c8553d', '★', t(fromFamily ? 'places.you' : 'places.town')],
          ['', KIND_COLOR.iti, '1', t('places.iti')],
          ['', KIND_COLOR.polytechnic, '2', t('places.polytechnic')],
          ['', KIND_COLOR.skill, '3', t('places.skill')],
        ].map(([cls, bg, mark, label]) => (
          <span key={label} className="key-item">
            <span className={`map-pin ${cls}`}>
              <span style={{ background: bg }}>{mark}</span>
            </span>
            {label}
          </span>
        ))}
      </p>
    </div>
  )
}

export default function NearbyPlaces({ districtId, point }) {
  const { t, backend } = useApp()
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    if (backend === undefined) return
    if (backend === null) {
      setState({ loading: false, offline: true })
      return
    }
    let live = true
    setState({ loading: true })
    nearbyPlaces(districtId, point)
      .then((r) => live && setState({ loading: false, ...r }))
      .catch(() => live && setState({ loading: false, offline: true }))
    return () => {
      live = false
    }
  }, [districtId, point?.lat, point?.lon, backend])

  return (
    <section className="panel places">
      <div className="panel-head">
        <h2>
          <MapPin size={20} aria-hidden="true" /> {t('places.title')}
        </h2>
      </div>
      <p className="panel-note">{t('places.sub')}</p>
      {state.loading && <p className="muted">{t('places.loading')}</p>}
      {!state.loading && (state.offline || state.available === false) && <p className="muted">{t('places.offline')}</p>}
      {!state.loading && state.available && state.places.length === 0 && <p className="muted">{t('places.none')}</p>}
      {!state.loading && state.places?.length > 0 && state.origin && (
        <PlacesMap places={state.places.slice(0, 6)} origin={state.origin} fromFamily={state.from === 'family'} />
      )}
      {!state.loading && state.places?.length > 0 && (
        <ul className="place-list">
          {state.places.slice(0, 6).map((p, i) => (
            <li key={p.osm} className="place">
              <span className="place-no" style={{ background: KIND_COLOR[p.kind] }} aria-hidden="true">
                {i + 1}
              </span>
              <span className={`place-kind kind-${p.kind}`}>{t(`places.${p.kind}`)}</span>
              <div className="place-main">
                <strong>{p.name}</strong>
                <span>
                  {p.km} km {state.from === 'family' ? t('places.fromYou') : t('places.fromTown')}
                  {p.address ? ` · ${p.address}` : ''}
                </span>
              </div>
              <div className="place-links">
                <a className="btn btn-outline btn-sm" href={p.directions} target="_blank" rel="noreferrer">
                  <Navigation size={14} aria-hidden="true" /> {t('places.directions')}
                </a>
                <a className="btn btn-text btn-sm" href={p.osm} target="_blank" rel="noreferrer">
                  <MapIcon size={14} aria-hidden="true" /> {t('places.map')}
                </a>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
