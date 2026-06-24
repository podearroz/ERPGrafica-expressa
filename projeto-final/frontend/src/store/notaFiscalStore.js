import { create } from "zustand";
import { notaFiscalService } from "../services/notaFiscalService";

const useNotaFiscalStore = create((set, get) => ({
  notasFiscais: [],
  loading: false,
  error: null,

  fetchNotasFiscais: async () => {
    set({ loading: true, error: null });
    try {
      const data = await notaFiscalService.getAll();
      set({ notasFiscais: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  addNotaFiscal: async (nota) => {
    set({ loading: true, error: null });
    try {
      const nova = await notaFiscalService.create(nota);
      set((state) => ({ notasFiscais: [nova, ...state.notasFiscais], loading: false }));
      return nova;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  updateNotaFiscal: async (id, updates) => {
    set({ loading: true, error: null });
    try {
      const updated = await notaFiscalService.update(id, updates);
      set((state) => ({
        notasFiscais: state.notasFiscais.map((n) => (n.id === id ? updated : n)),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteNotaFiscal: async (id) => {
    set({ loading: true, error: null });
    try {
      await notaFiscalService.delete(id);
      set((state) => ({
        notasFiscais: state.notasFiscais.filter((n) => n.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getProximoNumero: async () => {
    return notaFiscalService.getProximoNumero();
  },

  incrementarNumero: async () => {
    return notaFiscalService.incrementarNumero();
  },

  getNotaByVenda: (vendaId) => {
    return get().notasFiscais.find((n) => n.venda_id === vendaId);
  },
}));

export default useNotaFiscalStore;
