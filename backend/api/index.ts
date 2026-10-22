// Entrada da API na Vercel (função serverless).
// Reexporta a mesma aplicação Express usada localmente em `npm run dev`,
// para que o backend funcione igual na nuvem (sem código duplicado).
import { criarApp } from '../src/app.ts'

export default criarApp()
