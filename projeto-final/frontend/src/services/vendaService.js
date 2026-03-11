import { supabase } from "../config/supabaseClient";

export const vendaService = {
  async getAll() {
    const { data, error } = await supabase
      .from("vendas")
      .select("*, cliente:clientes(id, nome, cpf_cnpj)")
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("vendas")
      .select("*, cliente:clientes(*)")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(venda) {
    const vendaData = {
      ...venda,
      user_id: null,
    };
    const { data, error } = await supabase
      .from("vendas")
      .insert([vendaData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, venda) {
    const { data, error } = await supabase
      .from("vendas")
      .update(venda)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("vendas").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getByCliente(clienteId) {
    const { data, error } = await supabase
      .from("vendas")
      .select("*")
      .eq("cliente_id", clienteId)
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from("vendas")
      .select("*, cliente:clientes(id, nome)")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },
};
