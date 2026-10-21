import type { UsuarioAutenticado } from './usuario.ts'

// Disponibiliza `req.usuario` nos handlers protegidos (preenchido pelo middleware
// de autenticação). O tipo é opcional porque rotas públicas não têm usuário.
declare global {
  namespace Express {
    interface Request {
      usuario?: UsuarioAutenticado
    }
  }
}

export {}
