import { supabase } from "../config/supabaseClient";

export const recebimentoService = {
  async getAll() {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(recebimento) {
    const recebimentoData = {
      ...recebimento,
      user_id: "00000000-0000-0000-0000-000000000000",
    };
    const { data, error } = await supabase
      .from("recebimentos")
      .insert([recebimentoData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, recebimento) {
    const { data, error } = await supabase
      .from("recebimentos")
      .update(recebimento)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("recebimentos").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getPendentes() {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .eq("tipo", "entrada")
      .order("data", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getByCliente(clienteId) {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .eq("venda_id", clienteId)
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getByPeriodo(dataInicio, dataFim) {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*")
      .gte("data", dataInicio)
      .lte("data", dataFim)
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },
};
