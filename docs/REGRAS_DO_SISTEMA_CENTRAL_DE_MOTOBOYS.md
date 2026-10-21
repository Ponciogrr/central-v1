# CENTRAL DE MOTOBOYS — REGRAS DO SISTEMA
Versão de referência: regras 1–81 registradas nas conversas do projeto.

> Este arquivo registra as decisões já definidas. Não invente regras adicionais. Se algum detalhe técnico exigir uma decisão ainda não definida, registre a dúvida e peça orientação. Implementar as regras por etapas, conforme o MVP avança; não tentar desenvolver tudo de uma vez.

## A. Ofertas e entregas

1. Uma oferta de entrega deve ser aceita ou recusada em até 30 segundos. Se o motoboy não responder, a oferta expira e passa ao próximo motoboy elegível.
2. Não enviar ofertas comuns a um motoboy que já esteja realizando uma entrega. Só podem ser oferecidos encaixes compatíveis com sua rota, e ele decide se aceita.
3. Distribuir ofertas de forma equilibrada, considerando tempo online, ofertas já recebidas e disponibilidade; priorizar quem teve menos oportunidades.
4. Se o motoboy cancelar uma entrega aceita, exigir confirmação e motivo, avisar o estabelecimento e procurar substituto.
5. O solicitante pode cancelar antes da aceitação sem informar motivo.
6. Depois que a entrega for aceita, o solicitante precisa confirmar o cancelamento e informar o motivo; o motoboy deve ser avisado.
7. O pagamento é feito diretamente entre solicitante e motoboy. O aplicativo apenas registra o valor combinado.
8. O motoboy toca em “Finalizar entrega” e confirma. O status passa automaticamente para “Entregue” e a avaliação fica disponível.
9. O solicitante pode avaliar o motoboy de 1 a 5 estrelas e deixar comentário opcional, uma vez por entrega.
10. Para solicitar um encaixe, o solicitante informa origem e destino. O valor é negociado diretamente pelo chat antes da aceitação.
11. O solicitante só pode cancelar um encaixe antes de o motoboy aceitá-lo.
12. Uma rota publicada permanece disponível para encaixes até que o motoboy a encerre ou cancele.
13. Antes de encerrar uma rota que tenha encaixes pendentes, perguntar se o motoboy deseja cancelar os pedidos pendentes.
14. Se o motoboy ficar offline antes de iniciar a rota publicada, cancelar a rota e avisar os solicitantes com encaixes pendentes.
15. Em caso de perda de conexão, aguardar 5 minutos para reconexão antes de considerar o motoboy offline.
16. Se houver uma oferta pendente durante a perda de conexão, cancelar imediatamente a oferta e enviá-la ao próximo motoboy elegível.
17. O sistema pode sugerir entregas compatíveis para o mesmo motoboy.
18. Uma segunda entrega compatível só é adicionada se o motoboy aceitar explicitamente a nova oferta.
19. Não há limite fixo de entregas simultâneas; o sistema avalia a disponibilidade e o motoboy decide sobre cada nova oferta.
20. O sistema sugere compatibilidade entre entregas; o motoboy decide se aceita ou recusa.
21. Notificações do motoboy: painel flutuante, alerta sonoro e notificação no celular, inclusive quando o aplicativo estiver em segundo plano.
22. Notificações do solicitante: painéis visuais dentro do aplicativo e notificação no celular, inclusive em segundo plano.
23. O chat privado só abre depois que o motoboy aceita a entrega.
24. Cada nova mensagem no chat gera alerta visual no aplicativo e notificação no celular, inclusive em segundo plano.
25. O chat não tem prazo para resposta; permanece aberto até que uma das partes encerre a conversa.
26. O chat fecha automaticamente quando a entrega é finalizada.
27. A avaliação é opcional e não deve gerar lembretes.
28. O histórico de entregas concluídas ou canceladas fica retido por 6 meses e depois é excluído automaticamente.

## B. Contas e códigos de acesso

29. Somente o administrador pode desativar ou excluir contas de motoboys, estabelecimentos e pessoas físicas.
30. Uma conta desativada não pode acessar o sistema; a mensagem deve orientar o usuário a procurar o administrador.
31. Tentativas repetidas com códigos de acesso errados bloqueiam o acesso até que o administrador libere a conta.
32. Se perder o código, o usuário solicita um novo ao administrador.
33. O código de acesso é permanente até que o administrador o desative ou substitua.
34. Cada usuário pode editar os próprios dados pessoais.
35. A alteração do número de telefone pode ser feita diretamente, sem confirmação extra.
36. Somente o administrador pode substituir o código de acesso.

## C. Presença online

37. Quando um motoboy fica online, o indicador flutuante aumenta; os demais usuários não recebem detalhes pessoais apenas por ele estar online.
38. Quando o motoboy fica offline, o indicador diminui imediatamente.
39. Em caso de perda de conexão, manter o motoboy no indicador durante a tolerância de 5 minutos; depois, subtrair do total.
40. O indicador de motoboys online é apenas informativo e não é clicável.
41. O número é atualizado imediatamente quando alguém fica online/offline, respeitando a tolerância de conexão.
42. O indicador aparece apenas para lojistas e pessoas físicas, não para motoboys.
43. O administrador pode ver a quantidade de motoboys online e uma lista detalhada.
44. A lista administrativa mostra nome, código de acesso e status online.
45. O administrador pode consultar a lista online e desativar uma conta de motoboy.
46. O administrador pode desativar um motoboy sem registrar motivo.
47. O usuário pode pedir reativação; somente o administrador pode aprovar.
48. A tela de login bloqueado oferece botão para solicitar reativação; a solicitação fica pendente até decisão administrativa.
49. Uma solicitação de reativação gera um alerta dentro do painel administrativo.
50. O administrador vê as ações “Aprovar reativação” e “Recusar solicitação”.

## D. Solicitações de reativação

51. Ao aprovar ou recusar uma reativação, o administrador gera aviso dentro do aplicativo e notificação no celular para o usuário.
52. Ao recusar, o administrador pode informar um motivo, mas isso não é obrigatório.
53. Após uma recusa, o usuário pode solicitar reativação novamente a qualquer momento, sem período de espera.
54. Não manter histórico de solicitações de reativação; conservar apenas o estado atual da solicitação, sem histórico de decisões anteriores.
55. Enquanto a solicitação estiver pendente, o usuário vê o status de pendência.
56. Ao aprovar, o acesso do usuário é restaurado imediatamente.
57. Cada nova solicitação, inclusive após recusa, gera um novo alerta no painel administrativo.
58. Impedir solicitações duplicadas enquanto houver uma solicitação pendente; manter apenas a solicitação atual.
59. O usuário não pode cancelar uma solicitação de reativação pendente; somente o administrador decide.
60. Não há prazo para análise administrativa; o administrador analisa quando estiver disponível.
61. O administrador vê solicitações pendentes da mais antiga para a mais recente.
62. Cada solicitação mostra nome do usuário, tipo de conta e data da solicitação.
63. A aprovação ou recusa é executada imediatamente ao clicar, sem confirmação extra.
64. Depois de uma recusa, o usuário continua bloqueado, mas pode solicitar novamente a qualquer momento.

## E. Tentativas de login bloqueadas

65. Registrar cada tentativa de login de um usuário bloqueado para consulta administrativa.
66. O registro inclui nome do usuário, data/hora e quantidade de tentativas.
67. Excluir automaticamente os registros de tentativas de login bloqueadas após 30 dias.
68. Não emitir alerta especial por excesso de tentativas bloqueadas; apenas registrar as tentativas.
69. Não oferecer filtros para esses registros; mostrar a lista completa em ordem cronológica.
70. Encerrar o grupo de regras de segurança de acesso antes de passar ao grupo seguinte.

## F. Indisponibilidade e manutenção

71. Se o sistema estiver indisponível por manutenção ou falha, mostrar uma mensagem pedindo que o usuário tente novamente mais tarde.
72. Para manutenção programada, avisar os usuários com antecedência.
73. O aviso de manutenção programada aparece no aplicativo e é enviado por notificação no celular.
74. O aviso informa o horário de início e a previsão de término.
75. Se a manutenção atrasar, enviar novo aviso com a previsão de término atualizada.
76. Quando o sistema voltar, mostrar aviso no aplicativo e enviar notificação no celular.
77. Durante a manutenção programada, bloquear o acesso de todos os usuários até o fim da manutenção.
78. O administrador mantém acesso ao painel durante a manutenção.
79. Somente o administrador pode ativar e encerrar manualmente o modo de manutenção.
80. Não registrar histórico de ativação ou encerramento do modo de manutenção.
81. Durante a manutenção, mostrar exatamente esta mensagem: “Estamos em manutenção. Tente novamente mais tarde.”

## Observações importantes

- Estas regras não significam que todos os recursos precisam estar implementados na primeira etapa.
- Não criar funções extras por conta própria.
- Preservar estas regras na documentação do repositório e atualizar o estado do projeto após cada etapa.
- A regra 82 não foi definida; não a inventar.
