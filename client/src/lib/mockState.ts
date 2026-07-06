import { mockVehicles, mockDrivers, mockTrips, mockNotifications } from "./mockData";

// Estado mutável para os mocks durante a sessão
export const state = {
  vehicles: [...mockVehicles],
  drivers: [...mockDrivers],
  trips: [...mockTrips],
  notifications: [...mockNotifications],
  expenses: [
    { id: 1, tipo: "combustivel", descricao: "Abastecimento Mercedes", valor: 1500.00, data: new Date(), veiculoId: 1 },
    { id: 2, tipo: "manutencao", descricao: "Troca de Pneus", valor: 2800.00, data: new Date(), veiculoId: 2 }
  ],
  revenues: [
    { id: 1, tipo: "viagem", descricao: "Frete SP-RJ", valor: 5000.00, data: new Date(), status: "recebido" },
    { id: 2, tipo: "viagem", descricao: "Frete PR-RS", valor: 4500.00, data: new Date(), status: "pendente" }
  ],
  maintenance: [] as any[],
  empresa: {
    nome: "LogiMind Transportes",
    cnpj: "12.345.678/0001-99",
    endereco: "Av. Paulista, 1000, São Paulo, SP",
    garagem: "Av. Paulista, 1000, São Paulo, SP",
    telefone: "(11) 3000-1234",
    email: "contato@logimind.com",
  }
};

// Sistema simples de eventos para notificar mudanças
type Listener = () => void;
const listeners: Set<Listener> = new Set();

export const subscribe = (listener: Listener): (() => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export const notify = () => {
  listeners.forEach(l => l());
};
