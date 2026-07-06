export const mockVehicles = [
  { id: 1, placa: "ABC-1234", marca: "Mercedes-Benz", modelo: "Actros", ano: 2022, tipo: "caminhao", status: "ativo", quilometragem: 45000, capacidadeCarga: "25000", crlvVencimento: new Date("2026-12-31"), seguroVencimento: new Date("2026-11-15"), observacoes: "Veículo em excelente estado." },
  { id: 2, placa: "XYZ-5678", marca: "Scania", modelo: "R 450", ano: 2021, tipo: "caminhao", status: "manutencao", quilometragem: 120000, capacidadeCarga: "30000", crlvVencimento: new Date("2026-10-20"), seguroVencimento: new Date("2026-09-10"), observacoes: "Troca de óleo pendente." },
  { id: 3, placa: "LOG-2024", marca: "Volvo", modelo: "FH 540", ano: 2023, tipo: "caminhao", status: "ativo", quilometragem: 15000, capacidadeCarga: "35000", crlvVencimento: new Date("2027-01-15"), seguroVencimento: new Date("2026-12-20"), observacoes: "Novo na frota." }
];

export const mockDrivers = [
  { id: 1, nome: "João Silva", cpf: "123.456.789-00", email: "joao.silva@logimind.com", telefone: "(11) 98888-7777", cnh: "123456789", cnhCategoria: "E", cnhVencimento: new Date("2028-05-20"), status: "disponivel", disponibilidade: true, dataAdmissao: new Date("2020-01-10"), endereco: "Rua das Flores, 123", observacoes: "Motorista experiente." },
  { id: 2, nome: "Maria Oliveira", cpf: "987.654.321-11", email: "maria.oliveira@logimind.com", telefone: "(11) 97777-6666", cnh: "987654321", cnhCategoria: "D", cnhVencimento: new Date("2027-08-15"), status: "viagem", disponibilidade: false, dataAdmissao: new Date("2021-03-15"), endereco: "Av. Brasil, 456", observacoes: "Especialista em cargas frágeis." }
];

export const mockTrips = [
  { id: 1, numeroViagem: "V-001", motoristaId: 2, veiculoId: 1, origem: "São Paulo, SP", destino: "Rio de Janeiro, RJ", dataPartida: new Date(), status: "em_andamento", distancia: "435", carga: "Eletrônicos", pesoTotal: "5000", valor: "2500.00", observacoes: "Entrega prioritária." },
  { id: 2, numeroViagem: "V-002", motoristaId: 1, veiculoId: 3, origem: "Curitiba, PR", destino: "Porto Alegre, RS", dataPartida: new Date(Date.now() + 86400000), status: "planejada", distancia: "711", carga: "Grãos", pesoTotal: "20000", valor: "4800.00", observacoes: "Aguardando carregamento." }
];

export const mockNotifications = [
  { id: 1, titulo: "Manutenção Vencendo", mensagem: "O veículo XYZ-5678 precisa de revisão em 500km.", tipo: "alerta", lida: false, dataCriacao: new Date() },
  { id: 2, titulo: "CNH Próxima do Vencimento", mensagem: "A CNH de Maria Oliveira vence em 30 dias.", tipo: "info", lida: false, dataCriacao: new Date() }
];
