import { supabase } from "../config/supabaseClient";

export const produtoService = {
  async getAll() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .order("nome", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getAtivos() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .order("nome", { ascending: true });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(produto) {
    const { data, error } = await supabase
      .from("produtos")
      .insert([{ ...produto, user_id: null }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, produto) {
    const { data, error } = await supabase
      .from("produtos")
      .update(produto)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("produtos").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getEstoqueBaixo() {
    const { data, error } = await supabase
      .from("produtos")
      .select("*")
      .eq("ativo", true)
      .filter("estoque_atual", "lte", "estoque_minimo")
      .order("nome");
    if (error) throw error;
    return data;
  },
};
