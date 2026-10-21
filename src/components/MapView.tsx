import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { CENTRO_PADRAO } from '../types'

interface Props {
  retirada?: { lat?: number; lng?: number }
  destino?: { lat?: number; lng?: number }
  posicaoMotoboy?: { lat?: number; lng?: number }
  onSelecionarPonto?: (lat: number, lng: number) => void
}

function ponto(p?: { lat?: number; lng?: number }): { lat: number; lng: number } | null {
  return p && p.lat != null && p.lng != null ? { lat: p.lat, lng: p.lng } : null
}

function icone(cor: string, texto = ''): L.DivIcon {
  return L.divIcon({
    className: '',
    html: `<div style="background:${cor};width:18px;height:18px;border-radius:50%;border:2px solid #fff;box-shadow:0 0 8px ${cor};display:flex;align-items:center;justify-content:center;font-size:10px;color:#000;font-weight:bold">${texto}</div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })
}

export default function MapView({ retirada, destino, posicaoMotoboy, onSelecionarPonto }: Props) {
  const divRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const camadaRef = useRef<L.LayerGroup | null>(null)

  useEffect(() => {
    if (!divRef.current || mapRef.current) return
    const map = L.map(divRef.current).setView([CENTRO_PADRAO.lat, CENTRO_PADRAO.lng], 12)
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)
    camadaRef.current = L.layerGroup().addTo(map)
    mapRef.current = map
    return () => {
      map.remove()
      mapRef.current = null
      camadaRef.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapRef.current
    const camada = camadaRef.current
    if (!map || !camada) return

    camada.clearLayers()

    const r = ponto(retirada)
    const d = ponto(destino)
    const m = ponto(posicaoMotoboy)

    if (r) {
      L.marker([r.lat, r.lng], { icon: icone('#22c55e', 'R') })
        .bindPopup('Retirada')
        .addTo(camada)
    }
    if (d) {
      L.marker([d.lat, d.lng], { icon: icone('#ef4444', 'D') })
        .bindPopup('Destino')
        .addTo(camada)
    }
    if (r && d) {
      L.polyline(
        [
          [r.lat, r.lng],
          [d.lat, d.lng],
        ],
        { color: '#a855f7', dashArray: '6 8', weight: 3 },
      ).addTo(camada)
    }
    if (m) {
      L.marker([m.lat, m.lng], { icon: icone('#facc15', 'M') })
        .bindPopup('Posição demonstrativa do motoboy (não é GPS real)')
        .addTo(camada)
    }

    const alvo = m ?? r
    if (alvo) {
      map.setView([alvo.lat, alvo.lng], map.getZoom(), { animate: true })
    }
  }, [retirada, destino, posicaoMotoboy])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !onSelecionarPonto) return
    const handler = (e: L.LeafletMouseEvent) => onSelecionarPonto(e.latlng.lat, e.latlng.lng)
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [onSelecionarPonto])

  return <div ref={divRef} className="mapa" />
}
