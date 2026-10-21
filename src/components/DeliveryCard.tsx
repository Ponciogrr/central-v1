import { useState } from 'react'
import type { Entrega, Papel } from '../types'
import { LABEL_STATUS } from '../types'
import { formatarData } from '../geo'
import MapView from './MapView'

interface Props {
  entrega: Entrega
  papel: Papel
  online?: boolean
  onAceitar?: (id: string) => void
  onIniciar?: (id: string) => void
  onConfirmar?: (id: string) => void
  onCancelar?: (id: string) => void
}

const CLASSE_STATUS: Record<Entrega['status'], string> = {
  aguardando: 'st-aguardando',
  aceita: 'st-aceita',
  em_rota: 'st-em-rota',
  entregue: 'st-entregue',
  cancelada: 'st-cancelada',
}

export default function DeliveryCard({ entrega, papel, online, onAceitar, onIniciar, onConfirmar, onCancelar }: Props) {
  const [verMapa, setVerMapa] = useState(false)
  const e = entrega

  return (
    <div className="card entrega">
      <div className="entrega-topo">
        <span className={`status ${CLASSE_STATUS[e.status]}`}>{LABEL_STATUS[e.status]}</span>
        <span className="data">{formatarData(e.criadoEm)}</span>
      </div>
      <h3>{e.descricao}</h3>
      <p className="detalhes">
        De: {e.remetente} {e.contato && <>· Contato: {e.contato}</>}
      </p>
      <p className="detalhes">
        Retirada: {e.retirada.nome}
        {e.retirada.lat != null && e.retirada.lng != null && ` (${e.retirada.lat.toFixed(4)}, ${e.retirada.lng.toFixed(4)})`}{' '}
        → Destino: {e.destino.nome}
        {e.destino.lat != null && e.destino.lng != null && ` (${e.destino.lat.toFixed(4)}, ${e.destino.lng.toFixed(4)})`}
      </p>
      {e.valor && <p className="detalhes">Valor combinado: {e.valor} (pago direto ao motoboy)</p>}
      {e.aceitaPor && <p className="detalhes">Motoboy: {e.aceitaPor}</p>}

      <div className="acoes">
        {papel === 'motoboy' && e.status === 'aguardando' && (
          <button className="primario" disabled={!online} onClick={() => onAceitar?.(e.id)}>
            {online ? 'Aceitar entrega' : 'Fique online para aceitar'}
          </button>
        )}
        {papel === 'motoboy' && e.status === 'aceita' && (
          <button className="primario" onClick={() => onIniciar?.(e.id)}>
            Iniciar rota (simulada)
          </button>
        )}
        {papel === 'motoboy' && e.status === 'em_rota' && (
          <button className="primario" onClick={() => onConfirmar?.(e.id)}>
            Confirmar entrega
          </button>
        )}
        {e.criadoPor === papel && e.status === 'aguardando' && (
          <button className="perigo" onClick={() => onCancelar?.(e.id)}>
            Cancelar
          </button>
        )}
        <button onClick={() => setVerMapa(v => !v)}>{verMapa ? 'Ocultar mapa' : 'Ver no mapa'}</button>
      </div>

      {verMapa && (
        <>
          <MapView
            retirada={e.retirada}
            destino={e.destino}
            posicaoMotoboy={e.posicaoMotoboy}
          />
          {e.posicaoMotoboy && (
            <p className="aviso">
              Posição demonstrativa do motoboy — simulação, <strong>não é rastreamento GPS real</strong>.
            </p>
          )}
        </>
      )}
    </div>
  )
}
