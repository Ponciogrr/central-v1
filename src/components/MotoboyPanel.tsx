import { useState } from 'react'
import type { Entrega } from '../types'
import { LABEL_STATUS } from '../types'
import { formatarData } from '../geo'
import type { Usuario } from '../auth'

interface Props {
  usuario: Usuario
  entregas: Entrega[]
  online: boolean
  onOnline: (valor: boolean) => void
  onAceitar: (id: string) => void
  onRecusar: (id: string) => void
  onIniciar: (id: string) => void
  onFinalizar: (id: string) => void
  onSair: () => void
}

type Aba = 'inicio' | 'rotas' | 'historico' | 'perfil'

const ICONE_ALERTA = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 3l10 18H2L12 3z" />
    <path d="M12 10v4" />
    <path d="M12 17.5v.5" />
  </svg>
)

const ICONE_CAIXA = (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d="M21 8l-9-5-9 5v8l9 5 9-5V8z" />
    <path d="M3 8l9 5 9-5" />
    <path d="M12 13v8" />
  </svg>
)

function resumo(e: Entrega): string {
  return `${e.retirada.nome} → ${e.destino.nome}`
}

export default function MotoboyPanel({
  usuario,
  entregas,
  online,
  onOnline,
  onAceitar,
  onRecusar,
  onIniciar,
  onFinalizar,
  onSair,
}: Props) {
  const [aba, setAba] = useState<Aba>('inicio')
  const [notaSuporte, setNotaSuporte] = useState('')

  const ativa = entregas.find(
    e => (e.status === 'aceita' || e.status === 'em_rota') && e.aceitaPor === usuario.nome,
  )
  const ofertas = entregas.filter(e => {
    if (e.status !== 'aguardando') return false
    if ((e.recusadoPor ?? []).includes(usuario.id)) return false
    if (e.ofertaParaId == null) return true // entrega antiga ainda sem atribuição
    if (e.ofertaParaId !== usuario.id) return false
    if (e.ofertaExpiraEm && new Date(e.ofertaExpiraEm).getTime() <= Date.now()) return false
    return true
  })
  const historico = entregas.filter(
    e => e.aceitaPor === usuario.nome && (e.status === 'entregue' || e.status === 'cancelada'),
  )

  const proxima = ofertas[0]
  const mostrarFlutuante = aba === 'inicio' && online && !ativa && !!proxima

  return (
    <div className="app painel-motoboy">
      <header className="topo">
        <div className="topo-linha">
          <h1>Central de Motoboys</h1>
          <span className="papel-badge">Motoboy</span>
          <button
            className="btn-suporte"
            onClick={() =>
              setNotaSuporte(n =>
                n
                  ? ''
                  : 'Grupo de suporte no WhatsApp: o link oficial ainda não foi configurado.',
              )
            }
          >
            {ICONE_ALERTA} Problema com a moto
          </button>
          <button onClick={onSair}>Sair</button>
        </div>
        <div className="motoboy-controles">
          <span className="motoboy-identificacao">{usuario.nome}</span>
          <label className="toggle">
            <input
              type="checkbox"
              checked={online}
              onChange={e => onOnline(e.target.checked)}
            />
            <span className={online ? 'bolinha online' : 'bolinha offline'} />
            {online ? 'Online' : 'Offline'}
          </label>
        </div>
      </header>

      {notaSuporte && <p className="aviso">{notaSuporte}</p>}

      <main className="painel-main">
        {aba === 'inicio' && (
          <section>
            {!online && (
              <p className="aviso">Você está offline. Fique online para receber ofertas.</p>
            )}

            {ativa && (
              <div className="card entrega destaque">
                <div className="entrega-topo">
                  <span className="status st-em-rota">{LABEL_STATUS[ativa.status]}</span>
                  <span className="data">{formatarData(ativa.criadoEm)}</span>
                </div>
                <h2 className="secao-titulo">Entrega em andamento</h2>
                <p className="detalhes">{ativa.descricao}</p>
                <p className="detalhes">Retirada: {ativa.retirada.nome}</p>
                <p className="detalhes">Destino: {ativa.destino.nome}</p>
                {ativa.valor && (
                  <p className="detalhes">Valor combinado: {ativa.valor} (pago direto a você)</p>
                )}
                <div className="acoes">
                  {ativa.status === 'aceita' && (
                    <button className="primario" onClick={() => onIniciar(ativa.id)}>
                      Iniciar rota
                    </button>
                  )}
                  {ativa.status === 'em_rota' && (
                    <button className="primario" onClick={() => onFinalizar(ativa.id)}>
                      Finalizar entrega
                    </button>
                  )}
                </div>
              </div>
            )}

            <h2 className="secao-titulo">Ofertas de entrega</h2>
            {ativa ? (
              <p className="dica">
                Você tem uma entrega em andamento. Novas entregas compatíveis (encaixes) aparecem
                na aba Rotas.
              </p>
            ) : !online ? (
              <p className="dica">Fique online para ver as ofertas disponíveis.</p>
            ) : ofertas.length === 0 ? (
              <div className="vazio">
                {ICONE_CAIXA}
                <p>Nenhuma oferta disponível no momento.</p>
                <span className="dica">
                  Quando lojistas ou pessoas físicas publicarem entregas, elas aparecem aqui.
                </span>
              </div>
            ) : (
              <>
                <p className="dica">
                  Ambiente de demonstração — ofertas são dados locais deste navegador. As ações
                  ficam no painel flutuante abaixo.
                </p>
                <ul className="lista-ofertas">
                  {ofertas.map(o => (
                    <li key={o.id} className="item-oferta">
                      <span className="status st-aguardando">Aguardando</span>
                      <strong>{o.descricao}</strong>
                      <span className="detalhes">{resumo(o)}</span>
                      <span className="data">{formatarData(o.criadoEm)}</span>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        )}

        {aba === 'rotas' && (
          <section>
            <h2 className="secao-titulo">Rotas para outras cidades e encaixes</h2>
            <div className="vazio">
              {ICONE_CAIXA}
              <p>Nenhuma rota cadastrada.</p>
              <span className="dica">
                Esta área será exibida quando as rotas e encaixes forem implementados — ainda é
                apenas interface.
              </span>
            </div>
          </section>
        )}

        {aba === 'historico' && (
          <section>
            <h2 className="secao-titulo">Histórico de entregas</h2>
            {historico.length === 0 ? (
              <div className="vazio">
                {ICONE_CAIXA}
                <p>Nenhuma entrega concluída ainda.</p>
                <span className="dica">Entregas finalizadas ou canceladas aparecerão aqui.</span>
              </div>
            ) : (
              <ul className="lista-ofertas">
                {historico.map(h => (
                  <li key={h.id} className="item-oferta">
                    <span
                      className={`status ${h.status === 'entregue' ? 'st-entregue' : 'st-cancelada'}`}
                    >
                      {LABEL_STATUS[h.status]}
                    </span>
                    <strong>{h.descricao}</strong>
                    <span className="detalhes">{resumo(h)}</span>
                    <span className="data">{formatarData(h.atualizadoEm ?? h.criadoEm)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {aba === 'perfil' && (
          <section>
            <h2 className="secao-titulo">Meu perfil</h2>
            <ul className="lista-perfil">
              <li>
                <span>Nome</span> <strong>{usuario.nome}</strong>
              </li>
              <li>
                <span>Perfil</span> <strong>Motoboy</strong>
              </li>
              <li>
                <span>Código de acesso</span> <code className="codigo">{usuario.codigo}</code>
              </li>
              <li>
                <span>Telefone</span> <strong>{usuario.telefone || 'não informado'}</strong>
              </li>
              <li>
                <span>Conta</span> <strong>{usuario.ativo ? 'Ativa' : 'Desativada'}</strong>
              </li>
            </ul>
            <p className="dica">
              Edição dos próprios dados fica disponível em etapa futura (regras 34–35).
            </p>
          </section>
        )}
      </main>

      {mostrarFlutuante && proxima && (
        <div className="painel-flutuante" role="region" aria-label="Oferta de entrega">
          <div className="flutuante-topo">
            <strong>Oferta de entrega</strong>
            <span className="data">
              1 de {ofertas.length} · demonstração local
            </span>
          </div>
          <p className="detalhes">{proxima.descricao}</p>
          <p className="detalhes">{resumo(proxima)}</p>
          <div className="acoes">
            <button className="primario" onClick={() => onAceitar(proxima.id)}>
              Aceitar
            </button>
            <button onClick={() => onRecusar(proxima.id)}>Recusar</button>
          </div>
        </div>
      )}

      <nav className="nav-inferior" aria-label="Navegação do motoboy">
        <button className={aba === 'inicio' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('inicio')}>
          Início
        </button>
        <button className={aba === 'rotas' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('rotas')}>
          Rotas
        </button>
        <button className={aba === 'historico' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('historico')}>
          Histórico
        </button>
        <button className={aba === 'perfil' ? 'nav-item ativa' : 'nav-item'} onClick={() => setAba('perfil')}>
          Perfil
        </button>
      </nav>
    </div>
  )
}
