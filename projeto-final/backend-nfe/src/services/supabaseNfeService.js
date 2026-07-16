import { createClient } from '@supabase/supabase-js';

// Inicialização lazy: garante que dotenv já foi carregado antes de criar o cliente
let _supabase = null;
function db() {
  if (!_supabase) {
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);
  }
  return _supabase;
}

const amb = () => process.env.NODE_ENV === 'producao' ? 'producao' : 'homologacao';

// ── Próximo número de NF-e (atômico no banco) ─────────────────────────────

export async function proximoNumeroNFe(serie = '1') {
  const { data, error } = await db().rpc('proximo_numero_nfe', {
    p_serie:    serie,
    p_ambiente: amb(),
  });
  if (error) throw new Error(`Erro ao obter número NF-e: ${error.message}`);
  return data; // INTEGER
}

// ── Rollback do número após rejeição (devolve o número ao contador) ────────

export async function rollbackNumeroNFe(serie = '1') {
  try {
    const { data } = await db()
      .from('nfe_controle')
      .select('proximo_numero')
      .eq('serie', serie)
      .eq('ambiente', amb())
      .single();
    if (!data) return;
    await db()
      .from('nfe_controle')
      .update({ proximo_numero: data.proximo_numero - 1, ultima_atualizacao: new Date().toISOString() })
      .eq('serie', serie)
      .eq('ambiente', amb());
    console.log(`🔄 Contador NF-e revertido para ${data.proximo_numero - 1} (número devolvido após rejeição)`);
  } catch (err) {
    console.warn('⚠️ Não foi possível reverter o contador NF-e:', err.message);
  }
}

// ── Salva NF-e autorizada no banco ───────────────────────────────────────

export async function salvarNFe({
  notaId, numeroNfe, serie, chaveAcesso, protocolo,
  dataAutorizacao, valor, clienteNome, clienteDoc,
  destinatario, itens, formaPagamento, xmlConteudo,
}) {
  const campos = {
    numero:             String(numeroNfe),
    numero_nfe:         numeroNfe,
    serie:              String(serie),
    chave_acesso:       chaveAcesso,
    protocolo,
    data:               dataAutorizacao
      ? new Date(dataAutorizacao).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    protocolo_data:     dataAutorizacao ?? null,
    valor,
    cliente:            clienteNome,
    destinatario_doc:   clienteDoc,
    destinatario_nome:  clienteNome,
    destinatario_json:  destinatario ?? null,
    tipo:               'NF-e',
    status:             'Emitida',
    ambiente:           amb(),
    itens:              itens ?? null,
    forma_pagamento:    formaPagamento ?? '01',
    xml_conteudo:       xmlConteudo,
  };

  if (notaId) {
    // Atualiza o registro existente (evita duplicatas)
    const { data, error } = await db()
      .from('notas_fiscais')
      .update(campos)
      .eq('id', notaId)
      .select()
      .single();
    if (error) throw new Error(`Erro ao atualizar NF-e: ${error.message}`);
    return data;
  }

  // Fallback: insere novo registro se não houver ID
  const { data, error } = await db()
    .from('notas_fiscais')
    .insert(campos)
    .select()
    .single();
  if (error) throw new Error(`Erro ao salvar NF-e: ${error.message}`);
  return data;
}

// ── Busca NF-e por chave de acesso ────────────────────────────────────────

export async function buscarNFePorChave(chaveAcesso) {
  const { data, error } = await db()
    .from('notas_fiscais')
    .select('*')
    .eq('chave_acesso', chaveAcesso)
    .single();

  if (error && error.code !== 'PGRST116') {
    throw new Error(`Erro ao buscar NF-e: ${error.message}`);
  }
  return data ?? null;
}

// ── Atualiza status da NF-e (ex.: Cancelada) ─────────────────────────────

export async function atualizarStatusNFe(chaveAcesso, status) {
  const { error } = await db()
    .from('notas_fiscais')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('chave_acesso', chaveAcesso);

  if (error) throw new Error(`Erro ao atualizar status: ${error.message}`);
}

// ── Salva CC-e autorizada no banco ────────────────────────────────────────

export async function salvarCCe(chaveAcesso, { protocolo, data, texto, xml }) {
  const { error } = await db()
    .from('notas_fiscais')
    .update({
      cce_protocolo: protocolo,
      cce_data:      data,
      cce_texto:     texto,
      cce_xml:       xml,
      updated_at:    new Date().toISOString(),
    })
    .eq('chave_acesso', chaveAcesso);

  if (error) throw new Error(`Erro ao salvar CC-e: ${error.message}`);
}

// ── Consulta sequência atual (para monitoramento) ─────────────────────────

export async function consultarSequencia(serie = '1') {
  const { data, error } = await db()
    .from('nfe_controle')
    .select('serie, ambiente, proximo_numero, ultima_atualizacao')
    .eq('serie', serie)
    .order('ambiente');

  if (error) throw new Error(`Erro ao consultar sequência: ${error.message}`);
  return data;
}
