import { supabase } from "../config/supabaseClient";
import { estoqueService } from "./estoqueService";
import { notaFiscalService } from "./notaFiscalService";

const gerarNumeroOS = async () => {
  // Busca apenas OS no formato do sistema (OS-00001), ignorando importações VHSYS (números puros)
  const { data } = await supabase
    .from("ordens_servico")
    .select("numero_os")
    .like("numero_os", "OS-%");

  let max = 0;
  if (data) {
    data.forEach((row) => {
      const match = row.numero_os?.match(/^OS-(\d+)$/);
      if (match) {
        const n = parseInt(match[1], 10);
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
      .or("fonte.is.null,fonte.neq.VHSYS")  // exclui histórico VHSYS da listagem padrão
      .order("data_abertura", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAllComHistorico() {
    // Busca apenas OS do VHSYS (histórico importado)
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`
        *,
        cliente:clientes(id, nome, cpf_cnpj, telefone),
        itens:itens_os(*)
      `)
      .eq("fonte", "VHSYS")
      .order("data_abertura", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async search(term) {
    const q = `%${term}%`;
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`*, cliente:clientes(id, nome, cpf_cnpj, telefone), itens:itens_os(*)`)
      .or(`numero_os.ilike.${q},cliente_nome.ilike.${q}`)
      .or("fonte.is.null,fonte.neq.VHSYS")
      .order("data_abertura", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
  },

  async searchVhsys(term) {
    const q = `%${term}%`;
    const { data, error } = await supabase
      .from("ordens_servico")
      .select(`*, cliente:clientes(id, nome, cpf_cnpj, telefone), itens:itens_os(*)`)
      .or(`numero_os.ilike.${q},cliente_nome.ilike.${q}`)
      .eq("fonte", "VHSYS")
      .order("data_abertura", { ascending: false })
      .limit(100);
    if (error) throw error;
    return data || [];
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
      .order("data_abertura", { ascending: false })
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

    // Cria itens da OS a partir dos itens da venda
    const itens = venda.itens || [{
      descricao: venda.produtos || "Serviço/Produto",
      quantidade: venda.quantidade || 1,
      valorUnitario: venda.valor_unitario || venda.valor || 0,
    }];
    const itensOS = itens.map((item) => ({
      os_id: os.id,
      produto_id: null,
      descricao: item.descricao || "Serviço/Produto",
      quantidade: parseFloat(item.quantidade) || 1,
      valor_unitario: parseFloat(item.valorUnitario || item.valor_unitario) || 0,
      valor_total: (parseFloat(item.quantidade) || 1) * (parseFloat(item.valorUnitario || item.valor_unitario) || 0),
      estoque_baixado: false,
    }));
    const { error: itemError } = await supabase.from("itens_os").insert(itensOS);
    if (itemError) throw itemError;

    return os;
  },

  async faturar(osId, comNF = false, pagamentoInfo = null) {
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
    const dataFechamento = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("ordens_servico")
      .update({
        status: novoStatus,
        nota_fiscal_id: notaFiscalId,
        data_fechamento: dataFechamento,
        faturado_em: new Date().toISOString(),
        faturado_por: null,
      })
      .eq("id", osId)
      .select()
      .single();
    if (error) throw error;

    // ── Baixa no Caixa (Recebimentos) ─────────────────────────────────────
    if (pagamentoInfo) {
      const nomeCliente = os.cliente?.nome || os.cliente_nome || null;
      const statusRec = pagamentoInfo.pago ? "Recebido" : "Não Pago";
      const dataRec = pagamentoInfo.pago
        ? pagamentoInfo.data_recebimento || dataFechamento
        : null;
      const contaBancaria =
        pagamentoInfo.forma_recebimento === "Dinheiro" ? "CAIXA" :
        pagamentoInfo.forma_recebimento === "Cartão de Crédito" ||
        pagamentoInfo.forma_recebimento === "Cartão de Débito"  ? "MAQUININHA" :
        "SICOOB";

      // Busca recebimento existente vinculado à OS
      const { data: recExistente } = await supabase
        .from("recebimentos")
        .select("id")
        .eq("os_id", osId)
        .maybeSingle();

      if (recExistente) {
        await supabase
          .from("recebimentos")
          .update({
            status: statusRec,
            forma_recebimento: pagamentoInfo.forma_recebimento || null,
            conta_bancaria: contaBancaria,
            data_recebimento: dataRec,
          })
          .eq("id", recExistente.id);
      } else {
        // Recebimento não existe (OS importada ou criada sem venda) → cria agora
        await supabase.from("recebimentos").insert([{
          user_id: null,
          os_id: osId,
          venda_id: os.venda_id || null,
          data: dataFechamento,
          valor: parseFloat(os.valor_final),
          tipo: "entrada",
          descricao: `Ordem de Serviço ${os.numero_os}`,
          categoria: "OS",
          status: statusRec,
          forma_recebimento: pagamentoInfo.forma_recebimento || null,
          conta_bancaria: contaBancaria,
          data_recebimento: dataRec,
          cliente_nome: nomeCliente,
          parcelas: 1,
          parcela_atual: 1,
        }]);
      }
    }

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

  async atualizarDeVenda(vendaId, venda) {
    const { data: os } = await supabase
      .from("ordens_servico")
      .select("id")
      .eq("venda_id", vendaId)
      .maybeSingle();

    if (!os) return null;

    await supabase.from("ordens_servico").update({
      cliente_id: venda.cliente_id,
      cliente_nome: venda.cliente_nome,
      cliente_telefone: venda.cliente_telefone,
      valor_total: venda.valor,
      valor_final: venda.valor,
      observacoes: venda.produtos ? `Produtos: ${venda.produtos}` : null,
      data_abertura: venda.data,
    }).eq("id", os.id);

    // Recria os itens da OS
    await supabase.from("itens_os").delete().eq("os_id", os.id);

    const itens = venda.itens || [{
      descricao: venda.produtos || "Serviço/Produto",
      quantidade: venda.quantidade || 1,
      valorUnitario: venda.valor_unitario || venda.valor || 0,
    }];
    const itensOS = itens.map((item) => ({
      os_id: os.id,
      produto_id: null,
      descricao: item.descricao || "Serviço/Produto",
      quantidade: parseFloat(item.quantidade) || 1,
      valor_unitario: parseFloat(item.valorUnitario || item.valor_unitario) || 0,
      valor_total: (parseFloat(item.quantidade) || 1) * (parseFloat(item.valorUnitario || item.valor_unitario) || 0),
      estoque_baixado: false,
    }));
    await supabase.from("itens_os").insert(itensOS);

    return os;
  },

  async delete(id) {
    const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
    if (error) throw error;
    return true;
  },
};
