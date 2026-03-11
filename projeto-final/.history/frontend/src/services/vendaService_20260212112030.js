import { supabase } from '../config/supabaseClient';

export const vendaService = {
  // Listar todas as vendas com dados do cliente
  async getAll() {
    const { data, error } = await supabase
      .from('vendas')
      .select(`
        *,
        cliente:clientes(id, nome, cpf_cnpj)
      `)
      .order('data', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Buscar venda por ID
  async getById(id) {
    const { data, error } = await supabase
      .from('vendas')
      .select(`
        *,
        cliente:clientes(*)
      `)
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data;
  },

  // Criar nova venda
  async create(venda) {
    const { data, error } = await supabase
      .from('vendas')
      .insert([venda])
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Atualizar venda
  async update(id, venda) {
    const { data, error } = await supabase
      .from('vendas')
      .update(venda)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data;
  },

  // Deletar venda
  async delete(id) {
    const { error } = await supabase
      .from('vendas')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
    return true;
  },

  // Buscar vendas por cliente
  async getByCliente(clienteId) {
    const { data, error } = await supabase
      .from('vendas')
      .select('*')
      .eq('cliente_id', clienteId)
      .order('data', { ascending: false });
    
    if (error) throw error;
    return data;
  },

  // Buscar vendas por período
  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from('vendas')
      .select(`
        *,
        cliente:clientes(id, nome)
      `)
      .gte('data', dataInicio)
      .lte('data', dataFim)
      .order('data', { ascending: false });
    
    if (error) throw error;
    return data;
  }
};
