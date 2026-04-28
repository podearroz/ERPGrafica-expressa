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

// ── Salva NF-e autorizada no banco ───────────────────────────────────────

export async function salvarNFe({
  numeroNfe, serie, chaveAcesso, protocolo,
  dataAutorizacao, valor, clienteNome, clienteDoc,
  destinatario, itens, formaPagamento, xmlConteudo,
}) {
  const { data, error } = await db()
    .from('notas_fiscais')
    .insert({
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
      status:             'Autorizada',
      ambiente:           amb(),
      itens:              itens ?? null,
      forma_pagamento:    formaPagamento ?? '01',
      xml_conteudo:       xmlConteudo,
    })
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
