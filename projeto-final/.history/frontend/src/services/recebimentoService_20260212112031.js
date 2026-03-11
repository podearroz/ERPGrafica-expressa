import { supabase } from '../config/supabaseClient';

export const recebimentoService = {
  // Listar todos os recebimentos
  async getAll() {
    const { data, error } = await supabase
      .from('recebimentos')
      .select(`
        *,
        cliente:clientes(id, nome)
      `)
      .order('data_vencimento', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Buscar recebimento por ID
  async getById(id) {
    const { data, error } = await supabase
      .from('recebimentos')
      .select(`
        *,
        cliente:clientes(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar novo recebimento
  async create(recebimento) {
    const { data, error } = await supabase
      .from('recebimentos')
      .insert([recebimento])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Atualizar recebimento
  async update(id, recebimento) {
    const { data, error } = await supabase
      .from('recebimentos')
      .update(recebimento)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Deletar recebimento
  async delete(id) {
    const { error } = await supabase
      .from('recebimentos')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // Buscar recebimentos pendentes
  async getPendentes() {
    const { data, error } = await supabase
      .from('recebimentos')
      .select(`
        *,
        cliente:clientes(id, nome)
      `)
      .eq('status', 'pendente')
      .order('data_vencimento', { ascending: true });
    
    if (error) throw error;
    return data;
  },

  // Buscar recebimentos por cliente
  async getByCliente(clienteId) {
    const { data, error } = await supabase
      .from('recebimentos')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data_vencimento', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Buscar recebimentos por período
  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from('recebimentos')
      .select(`
        *,
        cliente:clientes(id, nome)
      `)
      .gte('data_vencimento', dataInicio)
      .lte('data_vencimento', dataFim)
      .order('data_vencimento', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};
