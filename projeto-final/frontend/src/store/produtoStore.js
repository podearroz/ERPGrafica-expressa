import { create } from "zustand";
import { produtoService } from "../services/produtoService";

const useProdutoStore = create((set, get) => ({
  produtos: [],
  loading: false,
  error: null,

  fetchProdutos: async () => {
    set({ loading: true, error: null });
    try {
      const data = await produtoService.getAll();
      set({ produtos: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addProduto: async (produto) => {
    set({ loading: true, error: null });
    try {
      const newProduto = await produtoService.create(produto);
      set((state) => ({ produtos: [newProduto, ...state.produtos], loading: false }));
      return newProduto;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateProduto: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updated = await produtoService.update(id, updates);
      set((state) => ({
        produtos: state.produtos.map((p) => (p.id === id ? updated : p)),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteProduto: async (id) => {
    set({ loading: true, error: null });
    try {
      await produtoService.delete(id);
      set((state) => ({
        produtos: state.produtos.filter((p) => p.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getProdutosEstoqueBaixo: () => {
    return get().produtos.filter(
      (p) => p.ativo && p.estoque_atual <= p.estoque_minimo
    );
  },

  getProdutoById: (id) => get().produtos.find((p) => p.id === id),
}));

export default useProdutoStore;
