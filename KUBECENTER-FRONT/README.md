# KubeCenter Frontend

Frontend Next.js para a plataforma de observabilidade Kubernetes KubeCenter.

## Requisitos

- Node.js >= 20
- pnpm >= 10
- KubeCenter API rodando (por padrão em `http://localhost:3000`)

## Configuração

1. Copie `.env.local.example` para `.env.local`
2. Ajuste `NEXT_PUBLIC_API_URL` se a API estiver em outra URL
3. Se a API exigir autenticação, defina `NEXT_PUBLIC_API_TOKEN`

## Desenvolvimento

```bash
pnpm install
pnpm dev
```

O frontend roda em `http://localhost:3001` (a API usa 3000).

## Build

```bash
pnpm build
pnpm start
```
