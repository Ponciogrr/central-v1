import { useEffect, useState } from 'react'
import { buscarMeuUsuario, type UsuarioSessao } from './api'
import { gravarToken, lerToken, limparToken } from './sessao'
import LoginScreen from './components/LoginScreen'
import AdminPanel from './components/AdminPanel'

// Painel administrativo web conectado à API real.
// Os painéis de demonstração (motoboy/lojista/pessoa) foram retirados da navegação:
// o produto desses perfis é o aplicativo mobile (pasta mobile/).
type Sessao = { token: string; usuario: UsuarioSessao }

export default function App() {
  const [carregando, setCarregando] = useState(true)
  const [sessao, setSessao] = useState<Sessao | null>(null)

  // Ao abrir, valida o token salvo com o servidor (o papel vem do banco, nunca local).
  useEffect(() => {
    const token = lerToken()
    if (!token) {
      setCarregando(false)
      return
    }
    let ativo = true
    buscarMeuUsuario(token)
      .then(usuario => {
        if (ativo) setSessao({ token, usuario })
      })
      .catch(() => {
        if (ativo) {
          limparToken()
          setSessao(null)
        }
      })
      .finally(() => {
        if (ativo) setCarregando(false)
      })
    return () => {
      ativo = false
    }
  }, [])

  function entrar(token: string, usuario: UsuarioSessao) {
    gravarToken(token)
    setSessao({ token, usuario })
  }

  function sair() {
    limparToken()
    setSessao(null)
  }

  if (carregando) {
    return (
      <div className="app">
        <div className="login">
          <p className="dica">Verificando sessão…</p>
        </div>
      </div>
    )
  }

  if (!sessao) {
    return (
      <div className="app">
        <LoginScreen onEntrar={entrar} />
      </div>
    )
  }

  if (sessao.usuario.papel === 'admin') {
    return <AdminPanel token={sessao.token} usuario={sessao.usuario} onSair={sair} />
  }

  // Sessão válida de outro perfil: o painel web é só de administração.
  return (
    <div className="app">
      <div className="login">
        <div className="login-marca">
          <h1>Central de Motoboys</h1>
          <p>Área administrativa</p>
        </div>
        <div className="card login-cartao">
          <p className="dica">
            Olá, {sessao.usuario.nome ?? 'usuário'}. Este painel web é exclusivo para
            administradores. Use o aplicativo no celular com seu código de acesso.
          </p>
          <button className="primario" onClick={sair}>
            Sair
          </button>
        </div>
      </div>
    </div>
  )
}
