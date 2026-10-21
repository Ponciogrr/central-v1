import { useState } from 'react'
import { login, mensagemDeErro, type UsuarioSessao } from '../api'

interface Props {
  onEntrar: (token: string, usuario: UsuarioSessao) => void
}

// Painel administrativo web: o papel vem do servidor (nunca é escolhido aqui).
export default function LoginScreen({ onEntrar }: Props) {
  const [codigo, setCodigo] = useState('')
  const [visivel, setVisivel] = useState(false)
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setErro('')
    const limpo = codigo.trim()
    if (!limpo) {
      setErro('Digite seu código de acesso.')
      return
    }
    if (enviando) return
    setEnviando(true)
    try {
      const r = await login(limpo)
      onEntrar(r.token, r.usuario)
    } catch (erro) {
      setErro(mensagemDeErro(erro))
      setEnviando(false)
    }
  }

  return (
    <div className="login">
      <div className="login-marca">
        <h1>Central de Motoboys</h1>
        <p>Painel administrativo — entre com seu código de acesso</p>
      </div>

      <form className="card login-cartao" onSubmit={enviar}>
        <label className="login-campo">
          <span>Código de acesso</span>
          <span className="campo-codigo">
            <input
              type={visivel ? 'text' : 'password'}
              value={codigo}
              onChange={e => setCodigo(e.target.value)}
              placeholder="Digite seu código"
              autoComplete="off"
              autoFocus
            />
            <button type="button" onClick={() => setVisivel(v => !v)}>
              {visivel ? 'Ocultar' : 'Mostrar'}
            </button>
          </span>
        </label>

        {erro && <p className="erro">{erro}</p>}

        <button type="submit" className="primario entrar" disabled={enviando}>
          {enviando ? 'Entrando…' : 'Entrar'}
        </button>

        <p className="dica login-ajuda">
          Este painel é exclusivo para administradores. Perdeu seu código? Procure o
          administrador do sistema para receber um novo.
        </p>
      </form>
    </div>
  )
}
