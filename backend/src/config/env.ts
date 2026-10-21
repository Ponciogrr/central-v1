// Leitura das variáveis de ambiente da API.
// Nenhum valor secreto fica no código: tudo vem do arquivo .env (veja .env.example).

const PORTA_PADRAO = 3000

// Tamanho mínimo exigido para os segredos de autenticação.
// Segredos curtos NÃO são aceitos e não há valor padrão/fraco de fallback.
const TAMANHO_MINIMO_SEGREDO = 32

const jwtSecret = (process.env.JWT_SECRET ?? '').trim()
const codeHmacKey = (process.env.CODE_HMAC_KEY ?? '').trim()

export const env = {
  porta: Number(process.env.PORT ?? PORTA_PADRAO),
  ambiente: process.env.NODE_ENV ?? 'development',
  // Vazio até o proprietário criar o banco no Neon e definir DATABASE_URL.
  databaseUrl: (process.env.DATABASE_URL ?? '').trim(),
  // Conexão direta (sem pooler) usada pelas migrações, quando informada.
  directUrl: (process.env.DIRECT_URL ?? '').trim(),
  // Segredos (mantidos apenas no servidor; veja .env.example).
  jwtSecret,
  codeHmacKey,
  jwtExpiresIn: (process.env.JWT_EXPIRES_IN ?? '7d').trim(),
  // Origens permitidas para CORS (Expo web em dev + painel admin web na raiz).
  // Lista separada por vírgula; inclui localhost e 127.0.0.1.
  // Requisições sem Origin (app nativo/curl) não passam por essa checagem.
  corsOrigins: (process.env.CORS_ORIGINS ??
    'http://localhost:8081,http://127.0.0.1:8081,http://localhost:5173,http://127.0.0.1:5173')
    .split(',')
    .map(origem => origem.trim())
    .filter(origem => origem.length > 0),
  // A autenticação só opera com os dois segredos suficientemente fortes.
  // Caso contrário, /health continua funcionando, mas o login responde 503.
  authConfigurada:
    jwtSecret.length >= TAMANHO_MINIMO_SEGREDO && codeHmacKey.length >= TAMANHO_MINIMO_SEGREDO,
} as const
