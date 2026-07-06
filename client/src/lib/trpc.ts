import { state, notify, subscribe } from "./mockState";
import { useState, useEffect } from "react";
// Nota: jsPDF e exportReports removidos - usar relatórios via backend

// Hook para usar o estado do mock com re-renderização
const useMockQuery = (data: any) => {
  const [currentData, setCurrentData] = useState(data);
  
  useEffect(() => {
    const unsubscribe = subscribe(() => {
      // Quando o estado global mudar, atualizamos o estado local para forçar re-render
      setCurrentData([...data]);
    });
    return unsubscribe;
  }, [data]);

  return { data: currentData, isLoading: false, refetch: () => {} };
};

// Helper para simular mutações que alteram o estado local
const createMockMutation = (collection: keyof typeof state, name: string) => ({
  useMutation: (options?: any) => ({
    mutate: (data: any) => {
      console.log(`Mock ${name} called with:`, data);
      
      setTimeout(() => {
        let result = data;
        if (name.includes("Create")) {
          result = { id: Math.floor(Math.random() * 10000), ...data, status: data.status || "ativo" };
          (state[collection] as any[]).unshift(result);
        } else if (name.includes("Update")) {
          const index = (state[collection] as any[]).findIndex((item: any) => item.id === data.id);
          if (index !== -1) {
            (state[collection] as any[])[index] = { ...(state[collection] as any[])[index], ...data };
            result = (state[collection] as any[])[index];
          }
        } else if (name.includes("Delete")) {
          const index = (state[collection] as any[]).findIndex((item: any) => item.id === data.id);
          if (index !== -1) {
            (state[collection] as any[]).splice(index, 1);
          }
        }

        notify();
        if (options?.onSuccess) options.onSuccess(result);
      }, 300);
    },
    mutateAsync: (data: any) => {
      return new Promise((resolve) => {
        setTimeout(() => {
          let result = data;
          if (name.includes("Create")) {
            result = { id: Math.floor(Math.random() * 10000), ...data, status: data.status || "ativo" };
            (state[collection] as any[]).unshift(result);
          } else if (name.includes("Update")) {
            const index = (state[collection] as any[]).findIndex(item => item.id === data.id);
            if (index !== -1) {
              (state[collection] as any[])[index] = { ...(state[collection] as any[])[index], ...data };
              result = (state[collection] as any[])[index];
            }
          } else if (name.includes("Delete")) {
            const index = (state[collection] as any[]).findIndex(item => item.id === data.id);
            if (index !== -1) {
              (state[collection] as any[]).splice(index, 1);
            }
          }
          notify();
          if (options?.onSuccess) options.onSuccess(result);
          resolve(result);
        }, 300);
      });
    },
    isPending: false,
  }),
});

export const trpc = {
  useUtils: () => ({
    auth: { me: { invalidate: () => Promise.resolve(), setData: () => {} } },
    vehicles: { list: { invalidate: () => { notify(); return Promise.resolve(); } } },
    drivers: { list: { invalidate: () => { notify(); return Promise.resolve(); } } },
    trips: { list: { invalidate: () => { notify(); return Promise.resolve(); } } },
    expenses: { list: { invalidate: () => { notify(); return Promise.resolve(); } } },
    revenues: { list: { invalidate: () => { notify(); return Promise.resolve(); } } },
  }),
  auth: {
    me: { useQuery: () => ({ data: { id: "demo", name: "Admin LogiMind", email: "admin@logimind.com" }, isLoading: false }) },
    logout: { useMutation: () => ({ mutate: () => {}, mutateAsync: () => Promise.resolve(), isPending: false }) },
  },
  vehicles: {
    list: { useQuery: () => useMockQuery(state.vehicles) },
    getById: { useQuery: (input: any) => ({ data: state.vehicles.find(v => v.id === input.id), isLoading: false }) },
    create: createMockMutation("vehicles", "Vehicle Create"),
    update: createMockMutation("vehicles", "Vehicle Update"),
    delete: createMockMutation("vehicles", "Vehicle Delete"),
  },
  drivers: {
    list: { useQuery: () => useMockQuery(state.drivers) },
    getById: { useQuery: (input: any) => ({ data: state.drivers.find(d => d.id === input.id), isLoading: false }) },
    create: createMockMutation("drivers", "Driver Create"),
    update: createMockMutation("drivers", "Driver Update"),
    delete: createMockMutation("drivers", "Driver Delete"),
  },
  trips: {
    list: { useQuery: () => useMockQuery(state.trips) },
    getById: { useQuery: (input: any) => ({ data: state.trips.find(t => t.id === input.id), isLoading: false }) },
    create: createMockMutation("trips", "Trip Create"),
    update: createMockMutation("trips", "Trip Update"),
    delete: createMockMutation("trips", "Trip Delete"),
    updateStatus: createMockMutation("trips", "Trip Status Update"),
  },
  notifications: {
    list: { useQuery: () => ({ data: state.notifications, isLoading: false }) },
  },
  maintenance: {
    list: { useQuery: () => useMockQuery(state.maintenance) },
    getByVehicle: { useQuery: () => ({ data: state.maintenance, isLoading: false, refetch: () => {} }) },
    create: createMockMutation("maintenance", "Maintenance Create"),
    update: createMockMutation("maintenance", "Maintenance Update"),
    updateStatus: createMockMutation("maintenance", "Maintenance Status Update"),
  },
  dashboard: {
    stats: {
      useQuery: () => {
        const [stats, setStats] = useState({
          activeVehicles: state.vehicles.length,
          availableDrivers: state.drivers.filter(d => d.status === "disponivel").length,
          activeTrips: state.trips.filter(t => t.status === "em_andamento").length,
          alerts: [
            { title: "Manutenção Vencendo", message: "Veículo ABC-1234 precisa de revisão.", severity: "warning" },
            { title: "CNH Vencida", message: "Motorista João Silva está com CNH vencida.", severity: "critical" }
          ],
          tripsByMonth: [
            { month: "Ago", count: 45 }, { month: "Set", count: 52 }, { month: "Out", count: 48 },
            { month: "Nov", count: 61 }, { month: "Dez", count: 55 }, { month: "Jan", count: 67 }
          ],
          fleetStatus: [
            { name: "Ativo", value: state.vehicles.filter(v => v.status === "ativo").length, color: "#10b981" },
            { name: "Manutenção", value: state.vehicles.filter(v => v.status === "manutencao").length, color: "#f59e0b" },
            { name: "Inativo", value: state.vehicles.filter(v => v.status === "inativo").length, color: "#ef4444" }
          ]
        });

        useEffect(() => {
          const unsubscribe = subscribe(() => {
            setStats(prev => ({
              ...prev,
              activeVehicles: state.vehicles.length,
              availableDrivers: state.drivers.filter(d => d.status === "disponivel").length,
              activeTrips: state.trips.filter(t => t.status === "em_andamento").length,
              fleetStatus: [
                { name: "Ativo", value: state.vehicles.filter(v => v.status === "ativo").length, color: "#10b981" },
                { name: "Manutenção", value: state.vehicles.filter(v => v.status === "manutencao").length, color: "#f59e0b" },
                { name: "Inativo", value: state.vehicles.filter(v => v.status === "inativo").length, color: "#ef4444" }
              ]
            }));
          });
          return unsubscribe;
        }, []);

        return { data: stats, isLoading: false };
      }
    }
  },
  expenses: {
    list: { useQuery: () => useMockQuery(state.expenses) },
    create: createMockMutation("expenses", "Expense Create"),
    delete: createMockMutation("expenses", "Expense Delete"),
  },
  revenues: {
    list: { useQuery: () => useMockQuery(state.revenues) },
    create: createMockMutation("revenues", "Revenue Create"),
    delete: createMockMutation("revenues", "Revenue Delete"),
  }
} as any;
