import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const useNotaFiscalStore = create(
  persist(
    (set, get) => ({
      notasFiscais: [
        { id: 1, numero: '001', vendaId: 1, data: '2026-02-01', valor: 1500.00, cliente: 'João Silva', tipo: 'NF-e' },
        { id: 2, numero: '002', vendaId: 2, data: '2026-02-03', valor: 2300.00, cliente: 'Maria Santos', tipo: 'NF-e' }
      ],
      
      addNotaFiscal: (nota) => set((state) => ({
        notasFiscais: [...state.notasFiscais, { ...nota, id: Date.now() }]
      })),
      
      updateNotaFiscal: (id, updatedNota) => set((state) => ({
        notasFiscais: state.notasFiscais.map(n => n.id === id ? { ...n, ...updatedNota } : n)
      })),
      
      deleteNotaFiscal: (id) => set((state) => ({
        notasFiscais: state.notasFiscais.filter(n => n.id !== id)
      })),
      
      getNotaByVenda: (vendaId) => {
        return get().notasFiscais.find(n => n.vendaId === vendaId);
      },
      
      getProximoNumero: () => {
        const notas = get().notasFiscais;
        if (notas.length === 0) return '001';
        
        const ultimoNumero = Math.max(...notas.map(n => parseInt(n.numero)));
        return String(ultimoNumero + 1).padStart(3, '0');
      }
    }),
    {
      name: 'nota-fiscal-storage',
    }
  )
);

export default useNotaFiscalStore;
