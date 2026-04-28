import { supabase } from "../config/supabaseClient";

export const estoqueService = {
  async getMovimentacoesByProduto(produtoId) {
    const { data, error } = await supabase
      .from("movimentacoes_estoque")
      .select("*")
      .eq("produto_id", produtoId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data;
  },

  async getAll() {
    const { data, error } = await supabase
      .from("movimentacoes_estoque")
      .select("*, produto:produtos(id, nome, codigo)")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data;
  },

  async registrarMovimentacao({ produto_id, tipo, quantidade, motivo, documento_referencia, observacao }) {
    // Busca estoque atual
    const { data: produto, error: produtoError } = await supabase
      .from("produtos")
      .select("estoque_atual")
      .eq("id", produto_id)
      .single();
    if (produtoError) throw produtoError;

    const estoqueAnterior = produto.estoque_atual;
    let estoquePosterior;

    if (tipo === "ENTRADA" || tipo === "DEVOLUCAO") {
      estoquePosterior = estoqueAnterior + quantidade;
    } else if (tipo === "SAIDA" || tipo === "VENDA") {
      if (estoqueAnterior < quantidade) {
        throw new Error(`Estoque insuficiente. Disponível: ${estoqueAnterior}, Solicitado: ${quantidade}`);
      }
      estoquePosterior = estoqueAnterior - quantidade;
    } else if (tipo === "AJUSTE") {
      estoquePosterior = quantidade; // ajuste define o valor absoluto
    } else {
      throw new Error(`Tipo de movimentação inválido: ${tipo}`);
    }

    // Registra movimentação
    const { data: movimentacao, error: movError } = await supabase
      .from("movimentacoes_estoque")
      .insert([{
        user_id: null,
        produto_id,
        tipo,
        quantidade: tipo === "AJUSTE" ? (estoquePosterior - estoqueAnterior) : quantidade,
        estoque_anterior: estoqueAnterior,
        estoque_posterior: estoquePosterior,
        motivo,
        documento_referencia,
        observacao,
      }])
      .select()
      .single();
    if (movError) throw movError;

    // Atualiza estoque do produto
    const { error: updateError } = await supabase
      .from("produtos")
      .update({ estoque_atual: estoquePosterior })
      .eq("id", produto_id);
    if (updateError) throw updateError;

    return { movimentacao, estoquePosterior };
  },

  async darBaixaItensOS(itensOs, osId) {
    const resultados = [];
    for (const item of itensOs) {
      if (!item.produto_id || item.estoque_baixado) continue;
      const resultado = await estoqueService.registrarMovimentacao({
        produto_id: item.produto_id,
        tipo: "VENDA",
        quantidade: item.quantidade,
        motivo: "Faturamento de OS",
        documento_referencia: osId,
        observacao: `Baixa automática - OS ${osId}`,
      });
      // Marca item como baixado
      await supabase
        .from("itens_os")
        .update({ estoque_baixado: true })
        .eq("id", item.id);
      resultados.push(resultado);
    }
    return resultados;
  },

  async validarEstoqueItens(itensOs) {
    const erros = [];
    for (const item of itensOs) {
      if (!item.produto_id) continue;
      const { data: produto } = await supabase
        .from("produtos")
        .select("nome, estoque_atual")
        .eq("id", item.produto_id)
        .single();
      if (produto && produto.estoque_atual < item.quantidade) {
        erros.push(`${produto.nome}: disponível ${produto.estoque_atual}, necessário ${item.quantidade}`);
      }
    }
    return erros;
  },
};
