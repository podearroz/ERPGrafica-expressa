import { supabase } from "../config/supabaseClient";

export const notaFiscalService = {
  async getAll() {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .select("*, venda:vendas(id, produtos, unidade, quantidade, valor_unitario, cliente_id, cliente:clientes(nome, cpf_cnpj, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone))")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(nota) {
    const { data, error } = await supabase
      .from("notas_fiscais")
      .insert([{ ...nota, user_id: null }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, nota) {
    const { error } = await supabase
      .from("notas_fiscais")
      .update(nota)
      .eq("id", id);
    if (error) throw error;
    // Recarrega com o join completo para ter venda+cliente no store
    const { data, error: errSelect } = await supabase
      .from("notas_fiscais")
      .select("*, venda:vendas(id, produtos, unidade, quantidade, valor_unitario, cliente_id, cliente:clientes(nome, cpf_cnpj, logradouro, numero, complemento, bairro, municipio, uf, cep, telefone))")
      .eq("id", id)
      .single();
    if (errSelect) throw errSelect;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("notas_fiscais").delete().eq("id", id);
    if (error) throw error;
    return true;
  },

  async getProximoNumero() {
    const { data, error } = await supabase
      .from("nfe_controle")
      .select("proximo_numero")
      .eq("ambiente", "producao")
      .eq("serie", "1")
      .single();
    if (error) throw error;
    return String(data.proximo_numero).padStart(9, "0");
  },

  async incrementarNumero() {
    const { data, error } = await supabase
      .from("nfe_controle")
      .select("proximo_numero")
      .eq("ambiente", "producao")
      .eq("serie", "1")
      .single();
    if (error) throw error;
    const { error: upErr } = await supabase
      .from("nfe_controle")
      .update({ proximo_numero: data.proximo_numero + 1, ultima_atualizacao: new Date().toISOString() })
      .eq("ambiente", "producao")
      .eq("serie", "1");
    if (upErr) throw upErr;
  },

  async criarDeOS(os) {
    const numero = await notaFiscalService.getProximoNumero();
    const nota = {
      numero,
      serie: "1",
      venda_id: os.venda_id || null,
      data: new Date().toISOString().split("T")[0],
      valor: parseFloat(os.valor_final),
      cliente: os.cliente?.nome || "Cliente não informado",
      tipo: "NF-e",
      status: "Pendente",
      // Dados extras para emissão (armazenados como referência)
      xml_path: null,
      chave_acesso: null,
      protocolo: null,
    };
    return notaFiscalService.create(nota);
  },
};
