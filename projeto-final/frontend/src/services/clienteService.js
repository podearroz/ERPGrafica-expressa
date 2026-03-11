import { supabase } from "../config/supabaseClient";

export const clienteService = {
  async getAll() {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async create(cliente) {
    const clienteData = {
      nome: cliente.nome,
      cpf_cnpj: cliente.cpfCnpj || cliente.cpf_cnpj,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco || "",
      user_id: null,
    };
    const { data, error } = await supabase
      .from("clientes")
      .insert([clienteData])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, cliente) {
    const clienteData = {
      nome: cliente.nome,
      cpf_cnpj: cliente.cpfCnpj || cliente.cpf_cnpj,
      telefone: cliente.telefone,
      email: cliente.email,
      endereco: cliente.endereco || "",
    };
    const { data, error } = await supabase
      .from("clientes")
      .update(clienteData)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("clientes").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async search(searchTerm) {
    if (!searchTerm) return this.getAll();
    const { data, error } = await supabase
      .from("clientes")
      .select("*")
      .or(
        `nome.ilike.%${searchTerm}%,cpf_cnpj.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`,
      )
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },
};
