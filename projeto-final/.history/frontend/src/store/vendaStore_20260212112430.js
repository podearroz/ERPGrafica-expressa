import { create } from "zustand";
import { vendaService } from "../services/vendaService";

const useVendaStore = create((set, get) => ({
  vendas: [],
  loading: false,
  error: null,

  // Carregar todas as vendas
  fetchVendas: async () => {
    set({ loading: true, error: null });
    try {
      const data = await vendaService.getAll();
      set({ vendas: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao buscar vendas:", error);
    }
  },

  // Adicionar venda
  addVenda: async (venda) => {
    set({ loading: true, error: null });
    try {
      const newVenda = await vendaService.create(venda);
      set((state) => ({
        vendas: [newVenda, ...state.vendas],
        loading: false,
      }));
      return newVenda;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao adicionar venda:", error);
      throw error;
    }
  },

  // Atualizar venda
  updateVenda: async (id, updatedVenda) => {
    set({ loading: true, error: null });
    try {
      const updated = await vendaService.update(id, updatedVenda);
      set((state) => ({
        vendas: state.vendas.map((v) => (v.id === id ? updated : v)),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao atualizar venda:", error);
      throw error;
    }
  },

  // Deletar venda
  deleteVenda: async (id) => {
    set({ loading: true, error: null });
    try {
      await vendaService.delete(id);
      set((state) => ({
        vendas: state.vendas.filter((v) => v.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao deletar venda:", error);
      throw error;
    }
  },

  // Buscar venda por ID
  getVendaById: (id) => {
    return get().vendas.find((v) => v.id === id);
  },

  // Buscar vendas por cliente
  getVendasByCliente: (clienteId) => {
    return get().vendas.filter((v) => v.cliente_id === clienteId);
  },

  // Calcular total de vendas
  getTotalVendas: () => {
    return get().vendas.reduce((sum, v) => sum + (parseFloat(v.valor) || 0), 0);
  },

  // Buscar vendas pendentes
  getVendasPendentes: () => {
    return get().vendas.filter((v) => v.status === "pendente");
  },
}));

export default useVendaStore;
