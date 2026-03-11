import { create } from 'zustand';
import { pagamentoService } from '../services/pagamentoService';

const usePagamentoStore = create((set, get) => ({
  pagamentos: [],
  loading: false,
  error: null,
  
  // Carregar todos os pagamentos
  fetchPagamentos: async () => {
    set({ loading: true, error: null });
    try {
      const data = await pagamentoService.getAll();
      set({ pagamentos: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao buscar pagamentos:', error);
    }
  },
  
  // Adicionar pagamento
  addPagamento: async (pagamento) => {
    set({ loading: true, error: null });
    try {
      const newPagamento = await pagamentoService.create(pagamento);
      set((state) => ({ 
        pagamentos: [newPagamento, ...state.pagamentos],
        loading: false 
      }));
      return newPagamento;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao adicionar pagamento:', error);
      throw error;
    }
  },
  
  // Atualizar pagamento
  updatePagamento: async (id, updatedPagamento) => {
    set({ loading: true, error: null });
    try {
      const updated = await pagamentoService.update(id, updatedPagamento);
      set((state) => ({
        pagamentos: state.pagamentos.map(p => p.id === id ? updated : p),
        loading: false
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao atualizar pagamento:', error);
      throw error;
    }
  },
  
  // Deletar pagamento
  deletePagamento: async (id) => {
    set({ loading: true, error: null });
    try {
      await pagamentoService.delete(id);
      set((state) => ({
        pagamentos: state.pagamentos.filter(p => p.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao deletar pagamento:', error);
      throw error;
    }
  },
  
  // Calcular total de pagamentos (saídas)
  getTotalPagamentos: () => {
    return get().pagamentos.reduce((sum, p) => sum + (parseFloat(p.valor) || 0), 0);
  },
  
  // Buscar pagamentos pendentes
  getPagamentosPendentes: async () => {
    set({ loading: true, error: null });
    try {
      const data = await pagamentoService.getPendentes();
      set({ loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao buscar pagamentos pendentes:', error);
      return [];
    }
  },
  
  // Agrupar pagamentos por categoria
  getPagamentosByCategoria: () => {
    return get().pagamentos.reduce((acc, p) => {
      const categoria = p.categoria || 'Outros';
      acc[categoria] = (acc[categoria] || 0) + (parseFloat(p.valor) || 0);
      return acc;
    }, {});
  }
}));

export default usePagamentoStore;
