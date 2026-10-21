---
name: central-motoboys
description: Contexto permanente do projeto Central de Motoboys. Use SEMPRE antes de decidir o próximo trabalho neste repositório para saber o estado real, a arquitetura e as regras de autonomia/segurança. Aciona em qualquer tarefa que altere backend/, mobile/, docs/ ou o painel web na raiz.
---

# Central de Motoboys — contexto do projeto

Fonte da verdade são os arquivos do projeto; esta skill só orienta o fluxo. Mantenha-a curta.

## Antes de decidir o próximo trabalho
1. Leia `docs/PROJECT_STATUS.md` (estado atual, pendências, próxima ação exata).
2. Consulte `docs/DECISIONS.md` e `docs/DESIGN_SYSTEM.md` quando a tarefa tocar decisões já tomadas ou visual.
3. Para regras de negócio, leia **apenas** o trecho pertinente de `docs/REGRAS_DO_SISTEMA_CENTRAL_DE_MOTOBOYS.md` — nunca as 81 regras inteiras.

## Arquitetura (não confundir)
- `mobile/` — app Expo (nativo + web dev). É o produto principal.
- `backend/` — API Express + PostgreSQL (Neon). Roda `npm run dev` na porta 3000.
- Raiz — painel web antigo em Vite (protótipo). A integração administrativa dele ainda está **pendente**.
- Testes: backend `npm run typecheck`; app `npx tsc --noEmit` em `mobile/`.

## Como trabalhar
- Etapas pequenas, com critério verificável. Preserve o código funcional; não reescreva o que não precisa mudar.
- Economize tokens, memória e disco: não imprima arquivos grandes, não releia tudo, não faça varreduras amplas.
- Teste o que mudou e **distinga claramente** o que está implementado e testado do que é apenas planejado ou visual.
- Ao concluir cada etapa, atualize `docs/PROJECT_STATUS.md` (e `docs/DECISIONS.md` se houver decisão nova).

## Limites de segurança (inegociáveis)
- Nunca inventar credenciais, expor segredos/códigos de acesso ou registrá-los em logs.
- Nunca apagar usuários, entregas ou tabelas do banco real; nunca rodar migração destrutiva nem alterar dados reais sem autorização explícita.
- Não instalar dependências sem necessidade comprovada; não publicar nem gerar cobranças.
- Nunca declarar teste aprovado sem tê-lo executado.

## Autonomia
- Com o modo autônomo ativo: após concluir uma etapa, siga para a próxima tarefa **segura e bem definida** cujas dependências estejam prontas, respeitando o limite de iterações.
- Pare e peça orientação quando houver: decisão de negócio ambígua, risco de perda de dados, ou necessidade de autorização (migração, publicação, operação irreversível).
