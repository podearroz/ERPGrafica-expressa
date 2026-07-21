import { create } from "zustand";
import { ordemServicoService } from "../services/ordemServicoService";

const useOrdemServicoStore = create((set, get) => ({
  ordensServico: [],
  loading: false,
  error: null,

  fetchOrdensServico: async (comHistorico = false) => {
    set({ loading: true, error: null });
    try {
      const data = comHistorico
        ? await ordemServicoService.getAllComHistorico()
        : await ordemServicoService.getAll();
      set({ ordensServico: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
    }
  },

  faturarOS: async (osId, comNF = false, pagamentoInfo = null) => {
    set({ loading: true, error: null });
    try {
      const resultado = await ordemServicoService.faturar(osId, comNF, pagamentoInfo);
      set((state) => ({
        ordensServico: state.ordensServico.map((os) =>
          os.id === osId ? { ...os, ...resultado.os } : os
        ),
        loading: false,
      }));
      return resultado;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  cancelarOS: async (osId, motivo) => {
    set({ loading: true, error: null });
    try {
      const updated = await ordemServicoService.cancelar(osId, motivo);
      set((state) => ({
        ordensServico: state.ordensServico.map((os) =>
          os.id === osId ? { ...os, ...updated } : os
        ),
        loading: false,
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  deleteOS: async (id) => {
    set({ loading: true, error: null });
    try {
      await ordemServicoService.delete(id);
      set((state) => ({
        ordensServico: state.ordensServico.filter((os) => os.id !== id),
        loading: false,
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      throw error;
    }
  },

  getOSByStatus: (status) => get().ordensServico.filter((os) => os.status === status),
  getOSById: (id) => get().ordensServico.find((os) => os.id === id),
  getOSAbertas: () => get().ordensServico.filter((os) => os.status === "ABERTA"),
}));

export default useOrdemServicoStore;
