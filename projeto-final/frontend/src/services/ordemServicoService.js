import { supabase } from "../config/supabaseClient";
import { estoqueService } from "./estoqueService";
import { notaFiscalService } from "./notaFiscalService";

const gerarNumeroOS = async () => {
  // Busca todos os números existentes para garantir unicidade mesmo após exclusões
  const { data } = await supabase
    .from("ordens_servico")
    .select("numero_os")
    .not("numero_os", "is", null);

  let max = 0;
  if (data) {
    data.forEach((row) => {
      const match = row.numero_os?.match(/OS-(\d+)/);
      if (match) {
        const n = parseInt(match[1]);
        if (n > max) max = n;
      }
    });
  }
  return `OS-${String(max + 1).padStart(5, "0")}`;
};

export const ordemServicoService = {
  async getAll() {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        cliente:clientes(id, nome, cpf_cnpj, telefone),
        itens:itens_os(*)
      `)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getById(id) {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        cliente:clientes(id, nome, cpf_cnpj, telefone),
        itens:itens_os(*, produto:produtos(id, nome, codigo))
      `)
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  async getByStatus(status) {
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`*, cliente:clientes(id, nome), itens:itens_os(*)`)
      .eq("status", status)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async criarDeVenda(venda) {
    const numero_os = await gerarNumeroOS();

    const { data: os, error: osError } = await supabase
      .from("ordens_servico")
      .insert([{
        user_id: null,
        numero_os,
        venda_id: venda.id,
        cliente_id: venda.cliente_id || null,
        // Armazena nome/telefone do cliente avulso para exibir na OS sem precisar do FK
        cliente_nome: venda.cliente_nome || null,
        cliente_telefone: venda.cliente_telefone || null,
        data_abertura: venda.data || new Date().toISOString().split("T")[0],
        status: "ABERTA",
        valor_total: parseFloat(venda.valor) || 0,
        desconto: 0,
        valor_final: parseFloat(venda.valor) || 0,
        observacoes: venda.produtos ? `Produtos: ${venda.produtos}` : null,
      }])
      .select()
      .single();
    if (osError) throw osError;

    // Cria item da OS com a descrição da venda
    const { error: itemError } = await supabase.from("itens_os").insert([{
      os_id: os.id,
      produto_id: null,
      descricao: venda.produtos || "Serviço/Produto",
      quantidade: 1,
      valor_unitario: parseFloat(venda.valor) || 0,
      valor_total: parseFloat(venda.valor) || 0,
      estoque_baixado: false,
    }]);
    if (itemError) throw itemError;

    return os;
  },

  async faturar(osId, comNF = false) {
    const os = await ordemServicoService.getById(osId);

    if (os.status !== "ABERTA") {
      throw new Error(`OS não pode ser faturada. Status atual: ${os.status}`);
    }

    // Valida estoque
    const errosEstoque = await estoqueService.validarEstoqueItens(os.itens);
    if (errosEstoque.length > 0) {
      throw new Error(`Estoque insuficiente:\n${errosEstoque.join("\n")}`);
    }

    // Baixa estoque
    await estoqueService.darBaixaItensOS(os.itens, osId);

    // Cria NF no Supabase se solicitado
    let notaFiscalId = null;
    let notaFiscal = null;
    if (comNF) {
      notaFiscal = await notaFiscalService.criarDeOS(os);
      notaFiscalId = notaFiscal.id;
    }

    const novoStatus = comNF ? "FATURADA" : "FATURADA_SEM_NF";

    const { data, error } = await supabase
      .from("ordens_servico")
      .update({
        status: novoStatus,
        nota_fiscal_id: notaFiscalId,
        data_fechamento: new Date().toISOString().split("T")[0],
        faturado_em: new Date().toISOString(),
        faturado_por: null,
      })
      .eq("id", osId)
      .select()
      .single();
    if (error) throw error;

    return { os: data, notaFiscal };
  },

  async cancelar(osId, motivo) {
    if (!motivo || motivo.trim().length < 15) {
      throw new Error("O motivo do cancelamento deve ter pelo menos 15 caracteres.");
    }

    const os = await ordemServicoService.getById(osId);

    if (os.status === "FATURADA" || os.status === "FATURADA_SEM_NF") {
      throw new Error("OS já faturada não pode ser cancelada.");
    }

    if (os.status === "CANCELADA") {
      throw new Error("OS já está cancelada.");
    }

    const { data, error } = await supabase
      .from("ordens_servico")
      .update({
        status: "CANCELADA",
        cancelado_em: new Date().toISOString(),
        cancelado_por: null,
        motivo_cancelamento: motivo.trim(),
      })
      .eq("id", osId)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id, updates) {
    const { data, error } = await supabase
      .from("ordens_servico")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async delete(id) {
    const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
