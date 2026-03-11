import { supabase } from "../config/supabaseClient";

export const pagamentoService = {
  // Listar todos os pagamentos
  async getAll() {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .order("data_vencimento", { ascending: false });

    if (error) throw error;
    return data;
  },

  // Buscar pagamento por ID
  async getById(id) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id)
      .single();

    if (error) throw error;
    return data;
  },

  // Criar novo pagamento
  async create(pagamento) {
    const { data, error } = await supabase
      .from("pagamentos")
      .insert([pagamento])
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Atualizar pagamento
  async update(id, pagamento) {
    const { data, error } = await supabase
      .from("pagamentos")
      .update(pagamento)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  // Deletar pagamento
  async delete(id) {
    const { error } = await supabase.from("pagamentos").delete().eq("id", id);

    if (error) throw error;
    return true;
  },

  // Buscar pagamentos pendentes
  async getPendentes() {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("status", "pendente")
      .order("data_vencimento", { ascending: true });

    if (error) throw error;
    return data;
  },

  // Buscar pagamentos por período
  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .gte("data_vencimento", dataInicio)
      .lte("data_vencimento", dataFim)
      .order("data_vencimento", { ascending: false });

    if (error) throw error;
    return data;
  },
};
