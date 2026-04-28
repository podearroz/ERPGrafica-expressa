import { create } from "zustand";
import { estoqueService } from "../services/estoqueService";

const useEstoqueStore = create((set) => ({
  movimentacoes: [],
  loading: false,
  error: null,

  fetchMovimentacoes: async () => {
    set({ loading: true, error: null });
    try {
      const data = await estoqueService.getAll();
      set({ movimentacoes: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  fetchMovimentacoesByProduto: async (produtoId) => {
    set({ loading: true, error: null });
    try {
      const data = await estoqueService.getMovimentacoesByProduto(produtoId);
      set({ movimentacoes: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  registrarMovimentacao: async (movimentacao) => {
    set({ loading: true, error: null });
    try {
      const resultado = await estoqueService.registrarMovimentacao(movimentacao);
      set((state) => ({
        movimentacoes: [resultado.movimentacao, ...state.movimentacoes],
        loading: false,
      }));
      return resultado;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },
}));

export default useEstoqueStore;
