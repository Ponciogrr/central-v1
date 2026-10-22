// Entrada da API na Vercel (função serverless).
//
// A aplicação Express é montada a partir do bundle gerado no build
// (`npm run build` -> `dist/api.js`), porque o runtime da Vercel não reescreve
// os especificadores de import com extensão `.ts` (ver DECISIONS #64).
// O bundle é autocontido: não importa nenhum arquivo local.
// @ts-ignore - o bundle só existe depois do build (dist/api.js)
import app from '../dist/api.js'

export default app
