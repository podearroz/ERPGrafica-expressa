import { create } from 'zustand';
import { clienteService } from '../services/clienteService';

const useClienteStore = create((set, get) => ({
  clientes: [],
  loading: false,
  error: null,
  
  // Carregar todos os clientes
  fetchClientes: async () => {
    set({ loading: true, error: null });
    try {
      const data = await clienteService.getAll();
      set({ clientes: data, loading: false });
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao buscar clientes:', error);
    }
  },
  
  // Adicionar cliente
  addCliente: async (cliente) => {
    set({ loading: true, error: null });
    try {
      const newCliente = await clienteService.create(cliente);
      set((state) => ({ 
        clientes: [newCliente, ...state.clientes],
        loading: false 
      }));
      return newCliente;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao adicionar cliente:', error);
      throw error;
    }
  },
  
  // Atualizar cliente
  updateCliente: async (id, updatedCliente) => {
    set({ loading: true, error: null });
    try {
      const updated = await clienteService.update(id, updatedCliente);
      set((state) => ({
        clientes: state.clientes.map(c => c.id === id ? updated : c),
        loading: false
      }));
      return updated;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }
  },
  
  // Deletar cliente
  deleteCliente: async (id) => {
    set({ loading: true, error: null });
    try {
      await clienteService.delete(id);
      set((state) => ({
        clientes: state.clientes.filter(c => c.id !== id),
        loading: false
      }));
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao deletar cliente:', error);
      throw error;
    }
  },
  
  // Buscar cliente por ID
  getClienteById: (id) => {
    return get().clientes.find(c => c.id === id);
  },
  
  // Buscar clientes
  searchClientes: async (searchTerm) => {
    set({ loading: true, error: null });
    try {
      const data = await clienteService.search(searchTerm);
      set({ clientes: data, loading: false });
      return data;
    } catch (error) {
      set({ error: error.message, loading: false });
      console.error('Erro ao buscar clientes:', error);
      return [];
    }
  }
}));

export default useClienteStore;
