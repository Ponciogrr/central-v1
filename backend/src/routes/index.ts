import { Router } from 'express'
import { rotasAdmin } from './admin.ts'
import { rotasAuth } from './auth.ts'
import { rotasContabilidade } from './contabilidade.ts'
import { rotasMotoboy } from './courier.ts'
import { rotasEntregas } from './deliveries.ts'
import { rotasSaude } from './health.ts'
import { rotasRotas } from './rotas.ts'

// Agrupador de rotas da API.
export const rotas = Router()

rotas.use(rotasSaude)
rotas.use(rotasAuth)
rotas.use(rotasEntregas)
rotas.use(rotasMotoboy)
rotas.use(rotasContabilidade)
rotas.use(rotasRotas)
rotas.use(rotasAdmin)
