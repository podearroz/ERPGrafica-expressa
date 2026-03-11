import { supabase } from "../config/supabaseClient";

export const pagamentoService = {
  async getAll() {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(pagamento) {
    const pagamentoData = {
      ...pagamento,
      user_id: null,
    };
    const { data, error } = await supabase
      .from("pagamentos")
      .insert([pagamentoData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

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

  async delete(id) {
    const { error } = await supabase.from("pagamentos").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getPendentes() {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .eq("status", "Pendente")
      .order("data", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from("pagamentos")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },
};
