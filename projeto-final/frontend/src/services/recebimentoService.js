import { supabase } from "../config/supabaseClient";

export const recebimentoService = {
  async getAll() {
    const { data, error } = await supabase
      .from("recebimentos")
      .select("*, venda:vendas(id, produtos, cliente_id, cliente:clientes(nome))")
      .order("data", { ascending: false });
    if (error) throw error;
    return data;
  },

  async create(recebimento) {
    const { data, error } = await supabase
      .from("recebimentos")
      .insert([{ ...recebimento, user_id: null }])
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

  async criarDeVenda(venda, os, clienteNome) {
    return recebimentoService.create({
      venda_id: venda.id,
      os_id: os?.id || null,
      data: venda.data || new Date().toISOString().split("T")[0],
      valor: parseFloat(venda.valor),
      tipo: "entrada",
      descricao: `Venda – ${venda.produtos || "Produtos/Serviços"}`,
      categoria: "Venda",
      status: "Não Pago",
      forma_recebimento: venda.forma_pagamento || null,
      cliente_nome: clienteNome || null,
      parcelas: 1,
      parcela_atual: 1,
    });
  },

  async marcarRecebido(id, { forma_recebimento, data_recebimento, observacao, conta_bancaria, desconto }) {
    const updates = {
      status: "Recebido",
      forma_recebimento,
      data_recebimento: data_recebimento || new Date().toISOString().split("T")[0],
      observacao: observacao || null,
      conta_bancaria: conta_bancaria || null,
    };

    const descontoNum = parseFloat(desconto) || 0;
    if (descontoNum > 0) {
      const { data: rec } = await supabase.from("recebimentos").select("valor").eq("id", id).single();
      const novoValor = Math.max(0, parseFloat(rec.valor) - descontoNum);
      updates.valor = novoValor;
      const obsDesconto = `Desconto: R$ ${descontoNum.toFixed(2)}`;
      updates.observacao = updates.observacao ? `${obsDesconto} | ${updates.observacao}` : obsDesconto;
    }

    return recebimentoService.update(id, updates);
  },

  async marcarParcelado(id, { parcelas, forma_recebimento, data_primeira, observacao }) {
    // Busca o recebimento original
    const { data: original, error } = await supabase
      .from("recebimentos")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;

    const valorParcela = parseFloat((original.valor / parcelas).toFixed(2));

    // Atualiza o original para a parcela 1
    await recebimentoService.update(id, {
      status: "Parcelado",
      parcelas,
      parcela_atual: 1,
      forma_recebimento,
      data_recebimento: data_primeira,
      valor: valorParcela,
      observacao,
    });

    // Cria parcelas 2..N
    const novos = [];
    for (let i = 2; i <= parcelas; i++) {
      const dataVenc = new Date(data_primeira);
      dataVenc.setMonth(dataVenc.getMonth() + (i - 1));
      novos.push({
        user_id: null,
        venda_id: original.venda_id,
        os_id: original.os_id,
        data: dataVenc.toISOString().split("T")[0],
        valor: valorParcela,
        tipo: "entrada",
        descricao: `${original.descricao} (${i}/${parcelas})`,
        categoria: original.categoria,
        status: "Não Pago",
        forma_recebimento,
        cliente_nome: original.cliente_nome,
        parcelas,
        parcela_atual: i,
        observacao,
      });
    }

    if (novos.length > 0) {
      const { error: insertError } = await supabase.from("recebimentos").insert(novos);
      if (insertError) throw insertError;
    }

    // Atualiza descrição da parcela 1
    await recebimentoService.update(id, {
      descricao: `${original.descricao} (1/${parcelas})`,
    });
  },

  async marcarNaoPago(id) {
    return recebimentoService.update(id, {
      status: "Não Pago",
      forma_recebimento: null,
      data_recebimento: null,
    });
  },
};
