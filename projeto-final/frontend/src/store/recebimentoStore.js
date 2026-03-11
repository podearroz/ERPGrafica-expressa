import { create } from "zustand";
import { recebimentoService } from "../services/recebimentoService";

const useRecebimentoStore = create((set, get) => ({
  recebimentos: [],
  loading: false,
  error: null,

  // Carregar todos os recebimentos
  fetchRecebimentos: async () => {
    set({ loading: true, error: null });
    try {
      const data = await recebimentoService.getAll();
      set({ recebimentos: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao buscar recebimentos:", error);
    }
  },

  // Adicionar recebimento
  addRecebimento: async (recebimento) => {
    set({ loading: true, error: null });
    try {
      const newRecebimento = await recebimentoService.create(recebimento);
      set((state) => ({
        recebimentos: [newRecebimento, ...state.recebimentos],
        loading: false,
      }));
      return newRecebimento;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao adicionar recebimento:", error);
      throw error;
    }
  },

  // Atualizar recebimento
  updateRecebimento: async (id, updatedRecebimento) => {
    set({ loading: true, error: null });
    try {
      const updated = await recebimentoService.update(id, updatedRecebimento);
      set((state) => ({
        recebimentos: state.recebimentos.map((r) =>
          r.id === id ? updated : r,
        ),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao atualizar recebimento:", error);
      throw error;
    }
  },

  // Deletar recebimento
  deleteRecebimento: async (id) => {
    set({ loading: true, error: null });
    try {
      await recebimentoService.delete(id);
      set((state) => ({
        recebimentos: state.recebimentos.filter((r) => r.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao deletar recebimento:", error);
      throw error;
    }
  },

  // Calcular total de entradas
  getTotalEntradas: () => {
    return get().recebimentos.reduce(
      (sum, r) => sum + (parseFloat(r.valor) || 0),
      0,
    );
  },

  // Calcular total de saídas (devoluções)
  getTotalSaidas: () => {
    return get()
      .recebimentos.filter((r) => r.valor < 0)
      .reduce((sum, r) => sum + Math.abs(parseFloat(r.valor) || 0), 0);
  },

  // Buscar recebimentos pendentes
  getRecebimentosPendentes: async () => {
    set({ loading: true, error: null });
    try {
      const data = await recebimentoService.getPendentes();
      set({ loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error("Erro ao buscar recebimentos pendentes:", error);
      return [];
    }
  },

  // Agrupar recebimentos por categoria
  getRecebimentosByCategoria: () => {
    return get().recebimentos.reduce((acc, r) => {
      const categoria = r.categoria || "Outros";
      acc[categoria] = (acc[categoria] || 0) + (parseFloat(r.valor) || 0);
      return acc;
    }, {});
  },
}));

export default useRecebimentoStore;
