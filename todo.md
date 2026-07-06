# LogiMind - Gestão de Frota - TODO

## Design System & Tema Dark Premium
- [x] Configurar CSS variables para tema dark premium
- [x] Definir paleta de cores (primária, secundária, acentos, neutros)
- [x] Configurar tipografia e tamanhos de fonte
- [x] Criar componentes base reutilizáveis (Card, Button, Input, Select)
- [x] Implementar DashboardLayout com sidebar de navegação
- [x] Configurar ícones e iconografia consistente

## Schema de Banco de Dados
- [x] Tabela de veículos (id, placa, modelo, marca, ano, status, data_criacao)
- [x] Tabela de motoristas (id, nome, cpf, cnh, data_vencimento_cnh, status)
- [x] Tabela de viagens (id, veiculo_id, motorista_id, origem, destino, status, data_inicio, data_fim)
- [x] Tabela de manutenções (id, veiculo_id, tipo, data, custo, descricao, status)
- [x] Tabela de documentos (id, tipo, veiculo_id/motorista_id, data_vencimento, arquivo_url)
- [x] Tabela de transações financeiras (id, tipo, valor, descricao, data, categoria)
- [x] Tabela de alertas/notificações (id, tipo, usuario_id, lido, data_criacao)

## Dashboard Principal
- [x] KPI: Total de veículos ativos
- [x] KPI: Viagens em andamento
- [x] KPI: Motoristas disponíveis
- [x] KPI: Alertas de manutenção pendente
- [x] Gráfico de viagens por período
- [x] Gráfico de utilização de frota
- [x] Lista de alertas recentes
- [x] Procedimento tRPC para carregar dados do dashboard

## Gestão de Veículos
- [x] Listagem de veículos com filtros (status, modelo)
- [x] Cadastro de novo veículo
- [x] Edição de dados do veículo
- [x] Visualização de detalhes do veículo
- [x] Controle de status (ativo, inativo, manutenção)
- [x] Histórico de manutenções por veículo
- [x] Procedures tRPC: list, create, update, delete, getById

## Gestão de Motoristas
- [x] Listagem de motoristas com filtros (status, disponibilidade)
- [x] Cadastro de novo motorista
- [x] Edição de dados do motorista
- [x] Visualização de detalhes do motorista
- [x] Controle de documentação (CNH, documentos)
- [x] Histórico de viagens por motorista
- [x] Procedures tRPC: list, create, update, delete, getById

## Gestão de Viagens
- [x] Listagem de viagens com filtros (status, período)
- [x] Criação de nova viagem
- [x] Acompanhamento em tempo real (simulado)
- [x] Histórico de viagens
- [x] Edição de viagem (antes de iniciar)
- [x] Finalização de viagem
- [x] Procedures tRPC: list, create, update, getById, finish

## Módulo Financeiro
- [x] Listagem de receitas com filtros
- [x] Listagem de despesas com filtros
- [x] Cadastro de receita
- [x] Cadastro de despesa
- [x] Dashboard financeiro com gráficos
- [x] Relatório financeiro por período
- [x] Procedures tRPC: listTransactions, createTransaction, getFinancialSummary

## Gestão de Manutenção
- [x] Listagem de manutenções agendadas
- [x] Listagem de histórico de manutenções
- [x] Agendamento de nova manutenção
- [x] Edição de agendamento
- [x] Conclusão de manutenção
- [x] Alertas de manutenção preventiva
- [x] Procedures tRPC: list, create, update, complete, getAlerts

## Gerenciamento de Documentos
- [x] Upload de documentos (veículos e motoristas)
- [x] Listagem de documentos por entidade
- [x] Controle de vencimento de documentos
- [x] Alertas de documentos próximos ao vencimento
- [x] Download de documentos
- [x] Procedures tRPC: upload, list, delete, getExpiringDocuments

## Relatórios Exportáveis
- [x] Relatório de frota em PDF
- [x] Relatório de viagens em PDF
- [x] Relatório financeiro em PDF
- [x] Relatório de manutenções em PDF
- [x] Exportação em Excel para viagens
- [x] Exportação em Excel para financeiro
- [x] Filtros por período em todos os relatórios
- [x] Procedures tRPC: generateReport

## Central de Notificações
- [x] Sistema de notificações em tempo real
- [x] Alertas de vencimento de documentos
- [x] Alertas de manutenções pendentes
- [x] Alertas de eventos críticos
- [x] Centro de notificações com histórico
- [x] Marcar notificações como lidas
- [x] Procedures tRPC: list, markAsRead, getUnread

## Testes
- [x] Testes unitários para procedures críticas
- [x] Testes de autenticação
- [x] Testes de validação de dados

## Deployment & Checkpoint
- [x] Salvar checkpoint final
- [x] Verificar todas as funcionalidades
- [x] Testar fluxos principais

## Rastreamento em Tempo Real (Estilo Uber)
- [x] Componente de mapa com Google Maps integrado
- [x] Rota traçada entre origem e destino ao iniciar viagem
- [x] Marcador do veículo (ícone de caminhão) se movendo pela rota em tempo real
- [x] Painel lateral com informações da viagem (motorista, veículo, origem, destino)
- [x] ETA (tempo estimado de chegada) atualizado em tempo real
- [x] Distância percorrida e restante atualizadas em tempo real
- [x] Barra de progresso visual da viagem
- [x] Status da viagem (Planejada → Em Andamento → Concluída)
- [x] Botão para iniciar viagem que ativa o rastreamento
- [x] Botão para finalizar viagem
- [x] Animação suave do veículo se movendo pela rota
- [x] Integração com a página de viagens existente

## Rastreamento - Fluxo Completo 4 Etapas (Estilo Uber)
- [x] Etapa 1: GPS do navegador detecta localização atual do motorista → rota até ponto de coleta
- [x] Etapa 2: Ponto de coleta → rota até ponto de entrega (destino da carga)
- [x] Etapa 3: Ponto de entrega → rota de retorno ao ponto de coleta/base
- [x] Etapa 4: Base → rota até a garagem (endereço configurável)
- [x] Painel mostrando etapa atual com nome, ícone e progresso de cada trecho
- [x] Status visual diferente por etapa (cor, ícone, badge)
- [x] ETA individual por trecho + ETA total da operação
- [x] Garagem configurável nos dados mock (endereço da empresa)
- [x] Formulário de viagem com campo de localização atual do motorista (GPS ou manual)
- [x] Transição automática entre etapas ao concluir cada trecho
- [x] Linha de progresso mostrando as 4 etapas como steps

## Bugs
- [x] Modais de cadastro estão com fundo transparente (mostrando conteúdo de baixo)

## Rastreamento GPS Real
- [x] Substituir simulação por watchPosition da API de Geolocalização do navegador
- [x] Marcador do veículo atualiza posição real do motorista no mapa
- [x] Velocidade calculada com base na distância entre posições GPS reais
- [x] Rota recalculada automaticamente se motorista desviar do trajeto
- [x] Distância percorrida calculada com base nas coordenadas GPS reais
- [x] Fallback para posição simulada se GPS não estiver disponível
- [x] Indicador visual mostrando se está usando GPS real ou simulado
