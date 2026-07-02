import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Send, FileText, CheckCircle, Clock, ChevronLeft, ChevronRight, PlusCircle, XCircle, Download, Eye, Copy, Key, Ban } from 'lucide-react';
import useNotaFiscalStore from '@store/notaFiscalStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import { supabase } from '@/config/supabaseClient';
import toast from 'react-hot-toast';

const NFE_API_URL = import.meta.env.VITE_NFE_API_URL || 'http://localhost:3001';

// ─── Opções estáticas ────────────────────────────────────────────────────────
const FINALIDADES = [
  { value: '1', label: 'NF-e Normal' },
  { value: '2', label: 'NF-e Complementar' },
  { value: '3', label: 'NF-e de Ajuste' },
  { value: '4', label: 'Devolução de Mercadoria' },
];
const CONDICOES_PAGAMENTO = [
  'À vista', '30 dias', '60 dias', '90 dias',
  '30/60 dias', '30/60/90 dias', '28/35/42 dias', 'Outro',
];
const FORMAS_PAGAMENTO = [
  { value: '01', label: '01 – Dinheiro' },
  { value: '02', label: '02 – Cheque' },
  { value: '03', label: '03 – Cartão de Crédito' },
  { value: '04', label: '04 – Cartão de Débito' },
  { value: '05', label: '05 – PIX' },
  { value: '15', label: '15 – Boleto Bancário' },
  { value: '90', label: '90 – Sem Pagamento' },
  { value: '99', label: '99 – Outros' },
];
const MODALIDADES_FRETE = [
  { value: '9', label: 'Sem Frete' },
  { value: '0', label: 'Por conta do emitente (CIF)' },
  { value: '1', label: 'Por conta do destinatário (FOB)' },
  { value: '2', label: 'Por conta de terceiros' },
  { value: '3', label: 'Próprio por conta do remetente' },
  { value: '4', label: 'Próprio por conta do destinatário' },
];
const TIPOS_ATENDIMENTO = [
  { value: '0', label: 'Operação não presencial, internet' },
  { value: '1', label: 'Operação não presencial, teleatendimento' },
  { value: '2', label: 'Operação não presencial, outro' },
  { value: '9', label: 'Operação presencial' },
];
const DESTINOS_OPERACAO = [
  { value: '0', label: 'Automático (recomendado)' },
  { value: '1', label: '1 – Operação interna' },
  { value: '2', label: '2 – Operação interestadual' },
  { value: '3', label: '3 – Operação com exterior' },
];
const INDICADORES_INTERMEDIARIO = [
  { value: '0', label: 'Operação sem intermediador (site/plataforma própria)' },
  { value: '1', label: 'Operação em site ou plataforma de terceiros' },
];
const IND_IE = [
  { value: '1', label: '1 – Contribuinte de ICMS' },
  { value: '2', label: '2 – Contribuinte Isento' },
  { value: '9', label: '9 – Não Contribuinte' },
];

const ITEM_VAZIO = {
  codigo: '102', descricao: '', ncm: '49111090', cfop: '5101', cst: '0102',
  unidade: 'UN', quantidade: '1', valor_unitario: '', valor_total: '',
  origem: '0', ipi_percent: '0', icms_percent: '0',
};

// ─── Badge status ─────────────────────────────────────────────────────────────
const STATUS_CFG = {
  Pendente:   { label: 'Pendente',   className: 'bg-yellow-100 text-yellow-700', icon: Clock },
  Emitida:    { label: 'Emitida',    className: 'bg-green-100 text-green-700',   icon: CheckCircle },
  Autorizada: { label: 'Autorizada', className: 'bg-green-100 text-green-700',   icon: CheckCircle },
  Cancelada:  { label: 'Cancelada',  className: 'bg-red-100 text-red-700',       icon: Ban },
};
const BadgeStatus = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      {Icon && <Icon className="w-3 h-3" />}{cfg.label}
    </span>
  );
};

// ─── Helpers de layout ────────────────────────────────────────────────────────
const F = ({ label, required, children, className = '' }) => (
  <div className={className}>
    <label className="block text-sm font-medium text-slate-700 mb-1">
      {label}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
    {children}
  </div>
);
const Sel = ({ label, required, value, onChange, options, className = '' }) => (
  <F label={label} required={required} className={className}>
    <select className="input" value={value} onChange={onChange}>
      {options.map(o => typeof o === 'string'
        ? <option key={o} value={o}>{o}</option>
        : <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  </F>
);
const Inp = ({ label, required, className = '', ...props }) => (
  <F label={label} required={required} className={className}>
    <input className="input" {...props} />
  </F>
);
const SectionTitle = ({ children }) => (
  <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-wide border-b pb-1 mt-2">{children}</h3>
);

// ─── Modal de Emissão ─────────────────────────────────────────────────────────
const ModalEmitirNFe = ({ nota, onClose, onSucesso }) => {
  const [aba, setAba] = useState(0);
  const [emitindo, setEmitindo] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [gerandoPreview, setGerandoPreview] = useState(false);
  const [clientes, setClientes] = useState([]);

  const hoje = new Date().toISOString().split('T')[0];

  // --- Estado por seção ---
  const [ident, setIdent] = useState({
    numero: nota.numero || '', serie: nota.serie || '1',
    data: nota.data || hoje, data_saida: nota.data || hoje,
    hora_saida: nota.hora_saida || '',
    natureza_operacao: 'Venda de produção do estabelecimento',
    tipo_operacao: '1', finalidade: '1', tipo: nota.tipo || 'NF-e',
    vendedor: '',
  });

  const [dest, setDest] = useState({
    nome: nota.cliente || '', cpf_cnpj: '', ie: '', ind_ie: '9',
    email: '', telefone: '',
    logradouro: '', numero: '', complemento: '', bairro: '',
    municipio: '', uf: '', cep: '', codigo_municipio: '',
  });

  const [itens, setItens] = useState([{
    ...ITEM_VAZIO,
    descricao: `Servicos/Produtos - ${nota.cliente || ''}`,
    valor_unitario: String(nota.valor || ''),
    valor_total: String(nota.valor || ''),
  }]);

  const [totais, setTotais] = useState({
    bc_icms: '0', valor_icms: '0',
    bc_icms_st: '0', valor_icms_st: '0',
    valor_ipi: '0',
    desconto_reais: '0', desconto_percent: '0',
    valor_frete: '0', valor_despesas: '0', valor_seguro: '0',
    condicao_pagamento: 'À vista', qtd_parcelas: '1',
    forma_pagamento: '01',
  });

  const [transp, setTransp] = useState({
    modalidade_frete: '9',
    transportadora: '', placa_veiculo: '', uf_veiculo: '', rntc: '',
    peso_bruto: '', peso_liquido: '',
    volumes_qtd: '', volumes_especie: '', volumes_marca: '', volumes_numeracao: '',
  });

  const [detalhes, setDetalhes] = useState({
    tipo_atendimento: '2', destino_operacao: '0',
    indicador_intermediario: '0', cnpj_intermediador: '', id_intermediador: '',
    ordem_compra: '',
    observacoes: 'EMPRESA OPTANTE PELO SIMPLES NACIONAL\nDADOS BANCÁRIOS: SICOOB AG: 3325 C/C 4.231-5\nGRAFICA E EDITORA EXPRESS LTDA ME\nOU PIX: CNPJ 07.240.770/0001-50',
    observacoes_internas: '',
  });

  // --- Pré-carregamento ---
  useEffect(() => {
    const carregar = async () => {
      try {
        // Carrega lista de clientes cadastrados para o seletor
        const { data: listaCli } = await supabase
          .from('clientes').select('*').order('nome');
        if (listaCli) setClientes(listaCli);

        // Sempre busca o número correto do nfe_controle (independente de ter venda)
        const { data: ctrl } = await supabase
          .from('nfe_controle').select('proximo_numero')
          .eq('ambiente', 'producao').eq('serie', '1').single();
        if (ctrl?.proximo_numero) {
          setIdent(p => ({ ...p, numero: String(ctrl.proximo_numero).padStart(9, '0') }));
        }

        // Se não tem venda mas a nota tem cliente_id guardado no destinatario_json, pré-carrega
        const clienteIdSalvo = nota.destinatario_json?.cliente_id;
        if (!nota.venda_id && clienteIdSalvo) {
          const { data: cli } = await supabase.from('clientes').select('*').eq('id', clienteIdSalvo).single();
          if (cli) preencherDestDeCliente(cli);
        }

        if (!nota.venda_id) return;
        const { data: venda } = await supabase
          .from('vendas').select('*, cliente:clientes(*)')
          .eq('id', nota.venda_id).single();
        if (venda?.cliente) {
          const c = venda.cliente;
          setDest(p => ({
            ...p,
            nome: c.nome || p.nome, cpf_cnpj: c.cpf_cnpj || '',
            ie: c.inscricao_estadual || '',
            email: c.email || '', telefone: c.telefone || '',
            logradouro: c.logradouro || c.endereco || '',
            numero: c.numero || '', complemento: c.complemento || '',
            bairro: c.bairro || '', municipio: c.municipio || '',
            uf: c.uf || '', cep: c.cep || '',
            codigo_municipio: c.codigo_municipio || '',
          }));
        }
        const { data: osData } = await supabase
          .from('ordens_servico')
          .select('*, itens:itens_os(*, produto:produtos(codigo, nome, unidade_medida))')
          .eq('nota_fiscal_id', nota.id).maybeSingle();
        if (osData?.itens?.length > 0) {
          setItens(osData.itens.map(item => ({
            codigo: item.produto?.codigo || '',
            descricao: item.descricao,
            ncm: '49111090', cfop: '5101',
            unidade: item.produto?.unidade_medida || 'UN',
            quantidade: String(parseFloat(item.quantidade) || 0),
            valor_unitario: (parseFloat(item.valor_unitario) || 0).toFixed(2),
            valor_total: (parseFloat(item.valor_total) || 0).toFixed(2),
            origem: '0', ipi_percent: '0', icms_percent: '0',
          })));
        } else if (venda) {
          // Sem OS: usa os campos da venda diretamente
          const qtd = parseFloat(venda.quantidade) || 1;
          const vlUnit = parseFloat(venda.valor_unitario) || parseFloat(venda.valor) || 0;
          setItens([{
            codigo: '',
            descricao: venda.produtos || nota.cliente || '',
            ncm: '49111090', cfop: '5101',
            unidade: venda.unidade || 'UN',
            quantidade: String(qtd),
            valor_unitario: vlUnit.toFixed(2),
            valor_total: (qtd * vlUnit).toFixed(2),
            origem: '0', ipi_percent: '0', icms_percent: '0',
          }]);
        }
      } catch (_e) { /* mantém defaults */ }
      finally { setCarregando(false); }
    };
    carregar();
  }, [nota.id, nota.venda_id]);

  const preencherDestDeCliente = (c) => setDest(p => ({
    ...p,
    nome: c.nome || '',
    cpf_cnpj: c.cpf_cnpj || '',
    ie: c.inscricao_estadual || '',
    email: c.email || '',
    telefone: c.telefone || '',
    logradouro: c.logradouro || '',
    numero: c.numero || '',
    complemento: c.complemento || '',
    bairro: c.bairro || '',
    municipio: c.municipio || '',
    uf: c.uf || '',
    cep: c.cep || '',
  }));

  const setI = (f, v) => setIdent(p => ({ ...p, [f]: v }));
  const setD = (f, v) => setDest(p => ({ ...p, [f]: v }));
  const setT = (f, v) => setTotais(p => ({ ...p, [f]: v }));
  const setTr = (f, v) => setTransp(p => ({ ...p, [f]: v }));
  const setDet = (f, v) => setDetalhes(p => ({ ...p, [f]: v }));

  // Cálculos automáticos dos totais
  const valorProdutos = itens.reduce((s, i) => s + (parseFloat(i.valor_total) || 0), 0);
  const valorIpiTotal = itens.reduce((s, i) => s + (parseFloat(i.valor_total) || 0) * (parseFloat(i.ipi_percent) || 0) / 100, 0);
  const descontoVal = parseFloat(totais.desconto_reais) || 0;
  const freteVal = parseFloat(totais.valor_frete) || 0;
  const despesasVal = parseFloat(totais.valor_despesas) || 0;
  const seguroVal = parseFloat(totais.valor_seguro) || 0;
  const totalNota = valorProdutos + valorIpiTotal + freteVal + despesasVal + seguroVal - descontoVal;

  const addItem = () => setItens(p => [...p, { ...ITEM_VAZIO }]);
  const removeItem = i => setItens(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i, f, v) => setItens(p => {
    const n = [...p]; n[i] = { ...n[i], [f]: v };
    if (f === 'quantidade' || f === 'valor_unitario') {
      const q = parseFloat(f === 'quantidade' ? v : n[i].quantidade) || 0;
      const u = parseFloat(f === 'valor_unitario' ? v : n[i].valor_unitario) || 0;
      n[i].valor_total = String((q * u).toFixed(2));
    }
    return n;
  });

  // Validação por aba
  const validar = () => {
    if (aba === 0 && (!ident.numero || !ident.data || !ident.natureza_operacao)) {
      toast.error('Preencha: Número, Data e Natureza da Operação.'); return false;
    }
    if (aba === 1 && (!dest.nome || !dest.cpf_cnpj)) {
      toast.error('Preencha: Nome/Razão Social e CPF/CNPJ.'); return false;
    }
    if (aba === 2) {
      for (const it of itens) {
        if (!it.descricao || !it.cfop || !it.quantidade || !it.valor_unitario) {
          toast.error('Preencha todos os campos obrigatórios dos itens.'); return false;
        }
      }
    }
    return true;
  };

  const avancar = () => { if (validar()) setAba(p => Math.min(p + 1, 5)); };
  const voltar  = () => setAba(p => Math.max(p - 1, 0));

  const handleEmitir = async () => {
    if (!validar()) return;
    setEmitindo(true);
    try {
      const payload = {
        venda: {
          numero: ident.numero, serie: ident.serie, data: ident.data,
          data_saida: ident.data_saida, hora_saida: ident.hora_saida,
          natureza_operacao: ident.natureza_operacao,
          tipo_operacao: ident.tipo_operacao, finalidade: ident.finalidade,
          tipo: ident.tipo, vendedor: ident.vendedor,
          itens: itens.map(it => ({
            codigo: it.codigo, descricao: it.descricao, ncm: it.ncm,
            cfop: it.cfop, cst: it.cst, unidade: it.unidade, origem: it.origem,
            quantidade: parseFloat(it.quantidade),
            valor_unitario: parseFloat(it.valor_unitario),
            valor_total: parseFloat(it.valor_total),
            ipi_percent: parseFloat(it.ipi_percent) || 0,
            icms_percent: parseFloat(it.icms_percent) || 0,
          })),
          totais: {
            valor_produtos: valorProdutos,
            bc_icms: parseFloat(totais.bc_icms) || 0,
            valor_icms: parseFloat(totais.valor_icms) || 0,
            bc_icms_st: parseFloat(totais.bc_icms_st) || 0,
            valor_icms_st: parseFloat(totais.valor_icms_st) || 0,
            valor_ipi: valorIpiTotal,
            desconto: descontoVal,
            valor_frete: freteVal,
            valor_despesas: despesasVal,
            valor_seguro: seguroVal,
            valor_total: totalNota,
          },
          pagamento: {
            condicao: totais.condicao_pagamento,
            qtd_parcelas: parseInt(totais.qtd_parcelas) || 1,
            forma: totais.forma_pagamento,
          },
          transporte: {
            modalidade_frete: transp.modalidade_frete,
            transportadora: transp.transportadora,
            placa_veiculo: transp.placa_veiculo,
            uf_veiculo: transp.uf_veiculo,
            rntc: transp.rntc,
            peso_bruto: parseFloat(transp.peso_bruto) || 0,
            peso_liquido: parseFloat(transp.peso_liquido) || 0,
            volumes: {
              quantidade: parseInt(transp.volumes_qtd) || 0,
              especie: transp.volumes_especie,
              marca: transp.volumes_marca,
              numeracao: transp.volumes_numeracao,
            },
          },
          detalhes: {
            tipo_atendimento: detalhes.tipo_atendimento,
            destino_operacao: detalhes.destino_operacao,
            indicador_intermediario: detalhes.indicador_intermediario,
            cnpj_intermediador: detalhes.cnpj_intermediador,
            id_intermediador: detalhes.id_intermediador,
            ordem_compra: detalhes.ordem_compra,
            observacoes: detalhes.observacoes,
            observacoes_internas: detalhes.observacoes_internas,
          },
        },
        cliente: {
          nome: dest.nome,
          cpf_cnpj: dest.cpf_cnpj.replace(/\D/g, ''),
          ie: dest.ie, ind_ie: dest.ind_ie,
          email: dest.email, telefone: dest.telefone,
          logradouro: dest.logradouro, numero: dest.numero,
          complemento: dest.complemento, bairro: dest.bairro,
          municipio: dest.municipio, uf: dest.uf,
          cep: dest.cep.replace(/\D/g, ''),
          codigo_municipio: dest.codigo_municipio,
        },
        empresa: {},
      };

      const res = await fetch(`${NFE_API_URL}/api/nfe/emitir`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || errData.xMotivo || `Erro na API: ${res.status}`);
      }
      const resultado = await res.json();

      await onSucesso(nota.id, {
        status: 'Emitida',
        numero: String(resultado.data?.numero || ident.numero),
        serie: ident.serie,
        data: ident.data,
        tipo: ident.tipo,
        cliente: dest.nome,
        chave_acesso: resultado.data?.chaveAcesso || null,
        protocolo: resultado.data?.protocolo || null,
        valor: totalNota,
        destinatario_json: payload.cliente,
        destinatario_nome: dest.nome,
        destinatario_doc:  dest.cpf_cnpj,
        itens: payload.venda.itens,
        data_saida: ident.data_saida,
        hora_saida: ident.hora_saida,
        natureza_operacao: ident.natureza_operacao,
        forma_pagamento: totais.forma_pagamento,
        protocolo_data: resultado.data?.dataAutorizacao || null,
      });
      const numeroEmitido = resultado.data?.numero || ident.numero;
      toast.success(`NF-e nº ${numeroEmitido} emitida com sucesso!`);
      onClose();
    } catch (e) {
      toast.error(`Erro ao emitir: ${e.message}`);
      // Recarrega o próximo número do banco (pode ter sido consumido pela tentativa)
      try {
        const { data: ctrl } = await supabase
          .from('nfe_controle').select('proximo_numero')
          .eq('ambiente', 'producao').eq('serie', '1').single();
        if (ctrl?.proximo_numero) {
          setIdent(p => ({ ...p, numero: String(ctrl.proximo_numero).padStart(9, '0') }));
        }
      } catch (_) {}
    } finally { setEmitindo(false); }
  };

  const handlePreviewDanfe = async () => {
    setGerandoPreview(true);
    try {
      const notaPreview = {
        numero: ident.numero, serie: ident.serie,
        data: ident.data, data_saida: ident.data_saida, hora_saida: ident.hora_saida,
        natureza_operacao: ident.natureza_operacao,
        protocolo: null, chave_acesso: null,
        valor: totalNota,
        itens: itens.map(it => ({
          ...it,
          quantidade: parseFloat(it.quantidade),
          valor_unitario: parseFloat(it.valor_unitario),
          valor_total: parseFloat(it.valor_total),
          ipi_percent: parseFloat(it.ipi_percent) || 0,
          icms_percent: parseFloat(it.icms_percent) || 0,
        })),
        destinatario_json: dest, destinatario_nome: dest.nome,
        forma_pagamento: totais.forma_pagamento,
        modalidade_frete: transp.modalidade_frete,
        observacoes: detalhes.observacoes,
        totais: {
          bc_icms: parseFloat(totais.bc_icms) || 0,
          valor_icms: parseFloat(totais.valor_icms) || 0,
          bc_icms_st: parseFloat(totais.bc_icms_st) || 0,
          valor_icms_st: parseFloat(totais.valor_icms_st) || 0,
          valor_ipi: valorIpiTotal,
          desconto: descontoVal,
          valor_frete: freteVal,
          valor_despesas: despesasVal,
          valor_seguro: seguroVal,
        },
        venda: {
          transporte: {
            modalidade_frete: transp.modalidade_frete,
            peso_bruto: parseFloat(transp.peso_bruto) || 0,
            peso_liquido: parseFloat(transp.peso_liquido) || 0,
            volumes: {
              quantidade: parseInt(transp.volumes_qtd) || 0,
              especie: transp.volumes_especie,
              marca: transp.volumes_marca,
              numeracao: transp.volumes_numeracao,
            },
          },
        },
      };
      const res = await fetch(`${NFE_API_URL}/nfe/danfe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota: notaPreview }),
      });
      if (!res.ok) throw new Error(`Erro ao gerar DANFE: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
    } catch (e) {
      toast.error(`Erro ao gerar preview: ${e.message}`);
    } finally {
      setGerandoPreview(false);
    }
  };

  const ABAS = ['1. Identificação', '2. Destinatário', '3. Produtos', '4. Totais/Pgto', '5. Transporte/Det.', '6. Revisão'];

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-slate-800">Emitir NF-e nº {ident.numero || nota.numero}</h2>
            <p className="text-xs text-slate-500">Preencha todos os campos e clique em Emitir na última aba</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
        </div>

        {/* Steps */}
        <div className="px-6 pt-3 flex gap-1 flex-shrink-0">
          {ABAS.map((nome, i) => (
            <button key={i} onClick={() => setAba(i)}
              className={`flex-1 text-xs py-2 px-1 rounded font-medium transition-colors ${
                aba === i ? 'bg-blue-600 text-white' : i < aba ? 'bg-blue-100 text-blue-700' : 'bg-slate-100 text-slate-500'
              }`}>
              {nome}
            </button>
          ))}
        </div>

        {/* Conteúdo rolável */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {carregando ? (
            <div className="flex items-center justify-center py-16 text-slate-500 text-sm">Carregando dados...</div>
          ) : (
            <>
              {/* ── ABA 0: Identificação ── */}
              {aba === 0 && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="Número *" value={ident.numero} onChange={e => setI('numero', e.target.value)} placeholder="Ex: 000039473" className="col-span-2" />
                    <Sel label="Tipo *" value={ident.tipo} onChange={e => setI('tipo', e.target.value)}
                      options={[{ value: 'NF-e', label: 'NF-e' }, { value: 'NFC-e', label: 'NFC-e' }]} />
                  </div>
                  <Inp label="Natureza da Operação *" value={ident.natureza_operacao}
                    onChange={e => setI('natureza_operacao', e.target.value)} placeholder="Ex: Venda de produção do estabelecimento" />
                  <div className="grid grid-cols-2 gap-3">
                    <Sel label="Finalidade" value={ident.finalidade} onChange={e => setI('finalidade', e.target.value)} options={FINALIDADES} />
                    <Sel label="Tipo de Operação" value={ident.tipo_operacao} onChange={e => setI('tipo_operacao', e.target.value)}
                      options={[{ value: '1', label: 'Saída' }, { value: '0', label: 'Entrada' }]} />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="Data de Emissão *" type="date" value={ident.data} onChange={e => setI('data', e.target.value)} />
                    <Inp label="Data de Saída *" type="date" value={ident.data_saida} onChange={e => setI('data_saida', e.target.value)} />
                    <Inp label="Hora de Saída *" type="time" value={ident.hora_saida} onChange={e => setI('hora_saida', e.target.value)} />
                  </div>
                  <Inp label="Vendedor" value={ident.vendedor} onChange={e => setI('vendedor', e.target.value)} placeholder="Nome do vendedor responsável (opcional)" />
                </div>
              )}

              {/* ── ABA 1: Destinatário ── */}
              {aba === 1 && (
                <div className="space-y-4">
                  {clientes.length > 0 && (
                    <F label="Carregar cliente cadastrado">
                      <select
                        className="input"
                        defaultValue=""
                        onChange={e => {
                          const c = clientes.find(x => x.id === e.target.value);
                          if (c) preencherDestDeCliente(c);
                        }}
                      >
                        <option value="">— Selecionar para preencher campos automaticamente —</option>
                        {clientes.map(c => (
                          <option key={c.id} value={c.id}>
                            {c.nome_fantasia ? `${c.nome_fantasia} (${c.nome})` : c.nome}
                            {c.cpf_cnpj ? ` — ${c.cpf_cnpj}` : ''}
                          </option>
                        ))}
                      </select>
                    </F>
                  )}
                  <Inp label="Nome / Razão Social *" value={dest.nome} onChange={e => setD('nome', e.target.value)} placeholder="Ex: ROVEMA VEICULOS E MAQUINAS LTDA." />
                  <div className="grid grid-cols-2 gap-3">
                    <Inp label="CNPJ / CPF *" value={dest.cpf_cnpj} onChange={e => setD('cpf_cnpj', e.target.value)} placeholder="Ex: 02.118.203/0002-93" />
                    <Inp label="Inscrição Estadual" value={dest.ie} onChange={e => setD('ie', e.target.value)} placeholder="Ex: 00000000904317 ou ISENTO" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Sel label="Indicador IE" value={dest.ind_ie} onChange={e => setD('ind_ie', e.target.value)} options={IND_IE} />
                    <Inp label="E-mail" type="email" value={dest.email} onChange={e => setD('email', e.target.value)} placeholder="Ex: financeiro@empresa.com.br" />
                  </div>
                  <Inp label="Telefone / Fax" value={dest.telefone} onChange={e => setD('telefone', e.target.value)} placeholder="Ex: (69) 3321-0000" />
                  <SectionTitle>Endereço</SectionTitle>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="Logradouro" value={dest.logradouro} onChange={e => setD('logradouro', e.target.value)} placeholder="Ex: AV CELSO MAZUTTI" className="col-span-2" />
                    <Inp label="Número" value={dest.numero} onChange={e => setD('numero', e.target.value)} placeholder="Ex: 7857" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Inp label="Complemento" value={dest.complemento} onChange={e => setD('complemento', e.target.value)} placeholder="Sala, Apto... (opcional)" />
                    <Inp label="Bairro / Distrito" value={dest.bairro} onChange={e => setD('bairro', e.target.value)} placeholder="Ex: JARDIM ARAUCARIA" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Inp label="Município" value={dest.municipio} onChange={e => setD('municipio', e.target.value)} placeholder="Ex: VILHENA" className="col-span-2" />
                    <Inp label="UF" value={dest.uf} onChange={e => setD('uf', e.target.value)} placeholder="RO" maxLength={2} />
                    <Inp label="CEP" value={dest.cep} onChange={e => setD('cep', e.target.value)} placeholder="Ex: 76987-487" />
                  </div>
                  <Inp label="Código IBGE do Município" value={dest.codigo_municipio}
                    onChange={e => setD('codigo_municipio', e.target.value)} placeholder="Ex: 1101708 (Vilhena-RO)" />
                </div>
              )}

              {/* ── ABA 2: Produtos ── */}
              {aba === 2 && (
                <div className="space-y-3">
                  {itens.map((it, i) => (
                    <div key={i} className="border border-slate-200 rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-700">Produto {i + 1}</span>
                        {itens.length > 1 && (
                          <button onClick={() => removeItem(i)} className="text-red-400 hover:text-red-600">
                            <XCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <Inp label="Código do Produto" value={it.codigo} onChange={e => updateItem(i, 'codigo', e.target.value)} placeholder="Código interno do produto (Ex: 102)" />
                        <Inp label="NCM/SH * (8 dígitos)" value={it.ncm} onChange={e => updateItem(i, 'ncm', e.target.value)} placeholder="Ex: 49111090 (produtos gráficos)" maxLength={8} />
                      </div>
                      <Inp label="Descrição do Produto / Serviço *" value={it.descricao} onChange={e => updateItem(i, 'descricao', e.target.value)} placeholder="Ex: IMPRESSÃO DE BANNER / REFORMA DE PLACA LUMINOSA" />
                      <div className="grid grid-cols-3 gap-2">
                        <Inp label="CFOP * (5101=produção, 5102=revenda)" value={it.cfop} onChange={e => updateItem(i, 'cfop', e.target.value)} placeholder="5101" maxLength={4} />
                        <Inp label="O/CST * (0102=Simples Nacional)" value={it.cst} onChange={e => updateItem(i, 'cst', e.target.value)} placeholder="0102" maxLength={4} />
                        <Inp label="Un. (UN, KG, M², MT...)" value={it.unidade} onChange={e => updateItem(i, 'unidade', e.target.value)} placeholder="UN" />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <F label="Origem do produto">
                          <select className="input" value={it.origem} onChange={e => updateItem(i, 'origem', e.target.value)}>
                            <option value="0">0 – Nacional (padrão gráfica)</option>
                            <option value="1">1 – Estrangeira (importação direta)</option>
                            <option value="2">2 – Estrangeira (mercado interno)</option>
                          </select>
                        </F>
                        <Inp label="Alíq. IPI %" type="number" step="0.01" value={it.ipi_percent} onChange={e => updateItem(i, 'ipi_percent', e.target.value)} placeholder="0,00 (Simples: 0)" />
                        <Inp label="Alíq. ICMS %" type="number" step="0.01" value={it.icms_percent} onChange={e => updateItem(i, 'icms_percent', e.target.value)} placeholder="0,00 (Simples: 0)" />
                      </div>
                      <div className="grid grid-cols-3 gap-3">
                        <Inp label="Qtde. *" type="number" step="0.001" value={it.quantidade} onChange={e => updateItem(i, 'quantidade', e.target.value)} placeholder="Ex: 1" />
                        <Inp label="Valor Unit. (R$) *" type="number" step="0.01" value={it.valor_unitario} onChange={e => updateItem(i, 'valor_unitario', e.target.value)} onBlur={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) updateItem(i, 'valor_unitario', v.toFixed(2)); }} placeholder="Ex: 2000,00" />
                        <F label="Valor Total (R$) — calculado">
                          <input className="input bg-slate-50 text-slate-600 font-semibold" readOnly value={it.valor_total} />
                        </F>
                      </div>
                    </div>
                  ))}
                  <button onClick={addItem} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 font-medium py-1">
                    <PlusCircle className="w-4 h-4" /> Adicionar outro produto
                  </button>
                  <div className="flex justify-end text-sm font-bold text-slate-800 border-t pt-3">
                    Valor dos produtos: R$ {valorProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                </div>
              )}

              {/* ── ABA 3: Totais & Pagamento ── */}
              {aba === 3 && (
                <div className="space-y-4">
                  <SectionTitle>Totais da Nota Fiscal</SectionTitle>
                  <p className="text-xs text-slate-500 -mt-2">Para empresas do Simples Nacional, BC e Valor do ICMS geralmente ficam em 0,00.</p>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="BC de ICMS (R$)" type="number" step="0.01" value={totais.bc_icms} onChange={e => setT('bc_icms', e.target.value)} placeholder="0,00" />
                    <Inp label="Valor do ICMS (R$)" type="number" step="0.01" value={totais.valor_icms} onChange={e => setT('valor_icms', e.target.value)} placeholder="0,00" />
                    <F label="Valor dos Produtos (R$) — calculado">
                      <input className="input bg-slate-50 text-slate-700 font-semibold" readOnly
                        value={valorProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} />
                    </F>
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="BC de ICMS-ST (R$)" type="number" step="0.01" value={totais.bc_icms_st} onChange={e => setT('bc_icms_st', e.target.value)} placeholder="0,00" />
                    <Inp label="Valor do ICMS-ST (R$)" type="number" step="0.01" value={totais.valor_icms_st} onChange={e => setT('valor_icms_st', e.target.value)} placeholder="0,00" />
                    <F label="Valor do IPI (R$) — calculado">
                      <input className="input bg-slate-50 text-slate-700" readOnly
                        value={valorIpiTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} />
                    </F>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Inp label="Desconto (R$)" type="number" step="0.01" value={totais.desconto_reais} onChange={e => setT('desconto_reais', e.target.value)} placeholder="0,00 (sem desconto)" />
                    <Inp label="Desconto (%)" type="number" step="0.01" value={totais.desconto_percent} onChange={e => setT('desconto_percent', e.target.value)} placeholder="0,00 (sem desconto)" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="Valor do Frete (R$)" type="number" step="0.01" value={totais.valor_frete} onChange={e => setT('valor_frete', e.target.value)} placeholder="0,00 (sem frete)" />
                    <Inp label="Outras Despesas (R$)" type="number" step="0.01" value={totais.valor_despesas} onChange={e => setT('valor_despesas', e.target.value)} placeholder="0,00" />
                    <Inp label="Valor do Seguro (R$)" type="number" step="0.01" value={totais.valor_seguro} onChange={e => setT('valor_seguro', e.target.value)} placeholder="0,00" />
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                    <p className="text-xs text-blue-600 font-medium mb-1">Valor Total da Nota</p>
                    <p className="text-2xl font-bold text-blue-800">
                      R$ {totalNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>

                  <SectionTitle>Pagamento</SectionTitle>
                  <div className="grid grid-cols-3 gap-3">
                    <Sel label="Condição de Pagamento" value={totais.condicao_pagamento}
                      onChange={e => setT('condicao_pagamento', e.target.value)} options={CONDICOES_PAGAMENTO} className="col-span-2" />
                    <Inp label="Qtde. Parcelas" type="number" min="1" value={totais.qtd_parcelas}
                      onChange={e => setT('qtd_parcelas', e.target.value)} />
                  </div>
                  <Sel label="Forma de Pagamento" value={totais.forma_pagamento}
                    onChange={e => setT('forma_pagamento', e.target.value)} options={FORMAS_PAGAMENTO} />
                </div>
              )}

              {/* ── ABA 4: Transporte & Detalhes ── */}
              {aba === 4 && (
                <div className="space-y-4">
                  <SectionTitle>Transporte</SectionTitle>
                  <Sel label="Modalidade de Frete" value={transp.modalidade_frete}
                    onChange={e => setTr('modalidade_frete', e.target.value)} options={MODALIDADES_FRETE} />
                  <div className="grid grid-cols-2 gap-3">
                    <Inp label="Transportadora" value={transp.transportadora} onChange={e => setTr('transportadora', e.target.value)} placeholder="Nome/CNPJ — deixe vazio se sem frete" />
                    <Inp label="RNTC (ANTT)" value={transp.rntc} onChange={e => setTr('rntc', e.target.value)} placeholder="Registro ANTT — deixe vazio se sem frete" />
                  </div>
                  <div className="grid grid-cols-3 gap-3">
                    <Inp label="Placa do Veículo" value={transp.placa_veiculo} onChange={e => setTr('placa_veiculo', e.target.value)} placeholder="Ex: ABC1D234 — vazio se sem frete" />
                    <Inp label="UF do Veículo" value={transp.uf_veiculo} onChange={e => setTr('uf_veiculo', e.target.value)} placeholder="Ex: RO" maxLength={2} />
                    <div />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Inp label="Peso Bruto (KG)" type="number" step="0.001" value={transp.peso_bruto} onChange={e => setTr('peso_bruto', e.target.value)} placeholder="0,000 — deixe 0 se não aplicável" />
                    <Inp label="Peso Líquido (KG)" type="number" step="0.001" value={transp.peso_liquido} onChange={e => setTr('peso_liquido', e.target.value)} placeholder="0,000 — deixe 0 se não aplicável" />
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    <Inp label="Volumes (Qtde)" type="number" value={transp.volumes_qtd} onChange={e => setTr('volumes_qtd', e.target.value)} placeholder="0 se sem volumes" />
                    <Inp label="Espécie" value={transp.volumes_especie} onChange={e => setTr('volumes_especie', e.target.value)} placeholder="Ex: CAIXA, ROLO, FARDO" />
                    <Inp label="Marca" value={transp.volumes_marca} onChange={e => setTr('volumes_marca', e.target.value)} placeholder="Ex: EXPRESSA" />
                    <Inp label="Numeração" value={transp.volumes_numeracao} onChange={e => setTr('volumes_numeracao', e.target.value)} placeholder="Ex: 001" />
                  </div>

                  <SectionTitle>Detalhes da Nota Fiscal</SectionTitle>
                  <div className="grid grid-cols-2 gap-3">
                    <Sel label="Tipo de Atendimento" value={detalhes.tipo_atendimento}
                      onChange={e => setDet('tipo_atendimento', e.target.value)} options={TIPOS_ATENDIMENTO} />
                    <Sel label="Destino da Operação" value={detalhes.destino_operacao}
                      onChange={e => setDet('destino_operacao', e.target.value)} options={DESTINOS_OPERACAO} />
                  </div>
                  <Inp label="Ordem de Compra" value={detalhes.ordem_compra}
                    onChange={e => setDet('ordem_compra', e.target.value)} placeholder="Nº do pedido/ordem de compra do cliente (opcional)" />
                  <Sel label="Indicador de Intermediário/Marketplace" value={detalhes.indicador_intermediario}
                    onChange={e => setDet('indicador_intermediario', e.target.value)} options={INDICADORES_INTERMEDIARIO} />
                  {detalhes.indicador_intermediario === '1' && (
                    <div className="grid grid-cols-2 gap-3">
                      <Inp label="CNPJ do Intermediador" value={detalhes.cnpj_intermediador}
                        onChange={e => setDet('cnpj_intermediador', e.target.value)} placeholder="00.000.000/0000-00" />
                      <Inp label="Identificador Cadastro" value={detalhes.id_intermediador}
                        onChange={e => setDet('id_intermediador', e.target.value)} placeholder="Ex: usuario@mercadolivre.com" />
                    </div>
                  )}
                  <F label="Observações (impressas na nota)">
                    <textarea className="input resize-none" rows={4} value={detalhes.observacoes}
                      onChange={e => setDet('observacoes', e.target.value)}
                      placeholder={"Ex: EMPRESA OPTANTE PELO SIMPLES NACIONAL\nDADOS BANCÁRIOS: SICOOB AG: 3325 C/C 4.231-5\nOU PIX: CNPJ 07.240.770/0001-50"} />
                  </F>
                  <F label="Observações Internas (uso interno — não impressas na nota)">
                    <textarea className="input resize-none" rows={2} value={detalhes.observacoes_internas}
                      onChange={e => setDet('observacoes_internas', e.target.value)}
                      placeholder="Ex: Pedido gerado pelo sistema ERP — uso interno" />
                  </F>
                </div>
              )}

              {/* ── ABA 5: Revisão / Preview DANFE ── */}
              {aba === 5 && (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex items-start gap-2">
                    <CheckCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-800 font-medium">Visualize a DANFE completa antes de emitir. Após enviar para a SEFAZ o cancelamento é restrito a 24h.</p>
                  </div>

                  {/* Botão principal — gera DANFE real em PDF com os dados atuais */}
                  <button
                    onClick={handlePreviewDanfe}
                    disabled={gerandoPreview}
                    className="w-full flex items-center justify-center gap-2 py-4 border-2 border-dashed border-blue-400 rounded-xl text-blue-700 font-semibold text-base hover:bg-blue-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <FileText className="w-6 h-6" />
                    {gerandoPreview ? 'Gerando DANFE...' : 'Visualizar DANFE Completa (abre em nova aba)'}
                  </button>

                  <p className="text-xs text-center text-slate-400">O PDF gerado usa os mesmos dados que serão enviados para a SEFAZ — sem protocolo pois ainda não foi emitida.</p>

                  {/* Resumo dos dados principais */}
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-600 uppercase tracking-wide">Resumo da Nota</div>
                    <div className="divide-y divide-slate-100">
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">NF-e nº / Série</span>
                        <strong>{ident.numero} / {ident.serie}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Data Emissão</span>
                        <strong>{ident.data ? new Date(ident.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Natureza da Operação</span>
                        <strong>{ident.natureza_operacao}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Destinatário</span>
                        <strong>{dest.nome || '—'}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">CPF / CNPJ</span>
                        <strong>{dest.cpf_cnpj || '—'}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Qtd. de Itens</span>
                        <strong>{itens.length}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Valor dos Produtos</span>
                        <strong>R$ {valorProdutos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm">
                        <span className="text-slate-500">Forma de Pagamento</span>
                        <strong>{FORMAS_PAGAMENTO.find(f => f.value === totais.forma_pagamento)?.label || totais.forma_pagamento}</strong>
                      </div>
                      <div className="flex justify-between px-3 py-2 text-sm bg-blue-50">
                        <span className="text-blue-700 font-semibold">VALOR TOTAL DA NOTA</span>
                        <strong className="text-blue-800 text-base">R$ {totalNota.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t flex justify-between flex-shrink-0">
          <Button variant="secondary" onClick={aba === 0 ? onClose : voltar}>
            {aba === 0 ? 'Cancelar' : <><ChevronLeft className="w-4 h-4 mr-1" />Voltar</>}
          </Button>
          {aba < 5 ? (
            <Button onClick={avancar}>
              {aba === 4 ? 'Revisar antes de emitir' : 'Avançar'} <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button icon={Send} onClick={handleEmitir} disabled={emitindo}>
              {emitindo ? 'Emitindo...' : 'Confirmar e Emitir para SEFAZ'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Página Principal ─────────────────────────────────────────────────────────
const FORM_VAZIO = {
  numero: '', serie: '1', data: new Date().toISOString().split('T')[0],
  cliente: '', cliente_id: '', tipo: 'NF-e', valor: '', status: 'Pendente',
};

// ─── Modal de Cancelamento ────────────────────────────────────────────────────
const ModalCancelarNFe = ({ nota, onClose, onCancelado }) => {
  const [justificativa, setJustificativa] = useState('');
  const [cancelando, setCancelando] = useState(false);

  const handleCancelar = async () => {
    if (justificativa.trim().length < 15) {
      toast.error('Justificativa deve ter no mínimo 15 caracteres.'); return;
    }
    if (!nota.protocolo) {
      toast.error('Protocolo de autorização não encontrado. Cancele diretamente no portal SEFAZ RO.'); return;
    }
    setCancelando(true);
    try {
      const res = await fetch(`${NFE_API_URL}/nfe/cancelar/${nota.chave_acesso}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ justificativa: justificativa.trim(), protocolo: nota.protocolo }),
      });
      const resultado = await res.json();
      if (resultado.success || resultado.cancelado) {
        toast.success('NF-e cancelada com sucesso!');
        await onCancelado(nota.id);
        onClose();
      } else {
        toast.error(`SEFAZ: ${resultado.message || resultado.error}`);
      }
    } catch (e) {
      toast.error(`Erro ao cancelar: ${e.message}`);
    } finally {
      setCancelando(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-red-700">Cancelar NF-e nº {nota.numero}</h2>
            <p className="text-xs text-slate-500">Envia evento de cancelamento para a SEFAZ</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
        </div>
        <div className="px-6 py-4 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 space-y-1">
            <p className="font-semibold">⚠️ Atenção</p>
            <p>O cancelamento só é permitido até <strong>24h após a autorização</strong>. A SEFAZ pode rejeitar se o prazo expirou ou a nota já foi escriturada pelo destinatário.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Justificativa <span className="text-red-500">*</span>
              <span className="text-slate-400 font-normal ml-1">(mín. 15 caracteres)</span>
            </label>
            <textarea
              className="input w-full resize-none"
              rows={3}
              value={justificativa}
              onChange={e => setJustificativa(e.target.value)}
              placeholder="Ex: Nota emitida com dados incorretos do destinatário"
              maxLength={255}
            />
            <p className="text-xs text-slate-400 mt-1 text-right">{justificativa.length}/255</p>
          </div>
          <div className="text-xs text-slate-500 space-y-0.5">
            <p><span className="font-medium">Chave:</span> {nota.chave_acesso || '—'}</p>
            <p><span className="font-medium">Protocolo:</span> {nota.protocolo || '—'}</p>
          </div>
        </div>
        <div className="px-6 py-4 border-t flex justify-between">
          <Button variant="secondary" onClick={onClose}>Voltar</Button>
          <button
            onClick={handleCancelar}
            disabled={cancelando || justificativa.trim().length < 15}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Ban className="w-4 h-4" />
            {cancelando ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
};

const ModalDetalhesNFe = ({ nota, onClose }) => {
  const copiarChave = () => {
    navigator.clipboard.writeText(nota.chave_acesso || '');
    toast.success('Chave copiada!');
  };

  const baixarPDF = async () => {
    try {
      toast.loading('Gerando PDF...', { id: 'pdf' });
      const res = await fetch(`${NFE_API_URL}/api/nfe/danfe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nota }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Erro ao gerar PDF');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nota.chave_acesso ? `${nota.chave_acesso}.pdf` : `DANFE_${nota.numero}_${nota.serie || '1'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('PDF gerado!', { id: 'pdf' });
    } catch (e) {
      toast.error(e.message, { id: 'pdf' });
    }
  };

  const chaveFormatada = nota.chave_acesso
    ? nota.chave_acesso.replace(/(\d{4})/g, '$1 ').trim()
    : null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-800">NF-e nº {nota.numero}/{nota.serie || '1'}</h2>
            <p className="text-xs text-slate-500">{nota.cliente}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6" /></button>
        </div>

        <div className="p-6 space-y-4">
          {/* Status */}
          <div className="flex items-center gap-3">
            <BadgeStatus status={nota.status} />
            <span className="text-sm text-slate-500">
              {new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')}
            </span>
            <span className="text-sm font-semibold text-slate-800 ml-auto">
              R$ {parseFloat(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          </div>

          {/* Protocolo */}
          {nota.protocolo && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-xs font-medium text-green-700 mb-1">Protocolo de Autorização</p>
              <p className="text-sm font-mono text-green-800">{nota.protocolo}</p>
            </div>
          )}

          {/* Chave de acesso */}
          {nota.chave_acesso ? (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-medium text-slate-600 flex items-center gap-1">
                  <Key className="w-3 h-3" /> Chave de Acesso
                </p>
                <button onClick={copiarChave} className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1">
                  <Copy className="w-3 h-3" /> Copiar
                </button>
              </div>
              <p className="text-xs font-mono text-slate-700 break-all leading-relaxed">{chaveFormatada}</p>
            </div>
          ) : (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-700">
              Chave de acesso não disponível. Emita a NF para gerar a chave.
            </div>
          )}

          {/* Ações de download */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={baixarPDF}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
            >
              <Download className="w-4 h-4" /> Baixar PDF (DANFE)
            </button>
            <a
              href={nota.chave_acesso ? `https://www.nfe.fazenda.gov.br/portal/consultaRecaptcha.aspx?tipoConsulta=completa&nfe=${nota.chave_acesso}` : '#'}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors ${!nota.chave_acesso ? 'opacity-40 pointer-events-none' : ''}`}
            >
              <FileText className="w-4 h-4" /> Consultar SEFAZ
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

const NotasFiscais = () => {
  const { notasFiscais, loading, fetchNotasFiscais, addNotaFiscal, updateNotaFiscal, deleteNotaFiscal, getProximoNumero, incrementarNumero } = useNotaFiscalStore();
  const [showModal, setShowModal] = useState(false);
  const [showEmitirModal, setShowEmitirModal] = useState(false);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [editingNota, setEditingNota] = useState(null);
  const [notaParaEmitir, setNotaParaEmitir] = useState(null);
  const [notaDetalhes, setNotaDetalhes] = useState(null);
  const [notaParaCancelar, setNotaParaCancelar] = useState(null);
  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [formData, setFormData] = useState(FORM_VAZIO);
  const [clientesLista, setClientesLista] = useState([]);

  useEffect(() => {
    fetchNotasFiscais();
    supabase.from('clientes').select('id, nome, nome_fantasia, cpf_cnpj').order('nome')
      .then(({ data }) => { if (data) setClientesLista(data); });
  }, []);

  const notasExibidas = filtroStatus === 'TODOS' ? notasFiscais : notasFiscais.filter(n => n.status === filtroStatus);
  const contadores = {
    TODOS: notasFiscais.length,
    Pendente: notasFiscais.filter(n => n.status === 'Pendente').length,
    Emitida: notasFiscais.filter(n => n.status === 'Emitida').length,
  };

  const abrirNovaEmissao = async () => {
    const num = await getProximoNumero();
    setNotaParaEmitir({
      id: null, numero: num, serie: '1',
      data: new Date().toISOString().split('T')[0],
      cliente: '', tipo: 'NF-e', valor: 0,
      venda_id: null, destinatario_json: null,
    });
    setShowEmitirModal(true);
  };

  const abrirModal = async (nota = null) => {
    if (nota) {
      setEditingNota(nota);
      setFormData({
        numero: nota.numero, serie: nota.serie || '1', data: nota.data,
        cliente: nota.cliente, cliente_id: nota.destinatario_json?.cliente_id || '',
        tipo: nota.tipo, valor: nota.valor, status: nota.status,
      });
    } else {
      setEditingNota(null);
      const num = await getProximoNumero();
      setFormData({ ...FORM_VAZIO, numero: num });
    }
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.numero || !formData.data || !formData.cliente || !formData.valor) {
      toast.error('Preencha todos os campos obrigatórios!'); return;
    }
    try {
      const { cliente_id, ...rest } = formData;
      const payload = {
        ...rest,
        valor: parseFloat(formData.valor),
        ...(cliente_id ? { destinatario_json: { cliente_id } } : {}),
      };
      if (editingNota) { await updateNotaFiscal(editingNota.id, payload); toast.success('Nota fiscal atualizada!'); }
      else { await addNotaFiscal(payload); toast.success('Nota fiscal cadastrada!'); }
      setShowModal(false);
    } catch (e) { toast.error(e.message || 'Erro ao salvar.'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir esta nota fiscal?')) return;
    try { await deleteNotaFiscal(id); toast.success('Nota fiscal excluída!'); }
    catch { toast.error('Erro ao excluir.'); }
  };

  const headers = [
    { label: 'Número' }, { label: 'Data' }, { label: 'Cliente' },
    { label: 'Tipo' }, { label: 'Valor' }, { label: 'Status' }, { label: 'Chave / Protocolo' }, { label: 'Ações', align: 'right' },
  ];

  return (
    <div>
      {showEmitirModal && notaParaEmitir && (
        <ModalEmitirNFe nota={notaParaEmitir}
          onClose={() => { setShowEmitirModal(false); setNotaParaEmitir(null); }}
          onSucesso={async (id, updates) => {
            let saved;
            if (id) {
              saved = await updateNotaFiscal(id, updates);
            } else {
              saved = await addNotaFiscal(updates);
            }
            setNotaDetalhes(saved || notasFiscais.find(n => n.id === id));
            setShowDetalhesModal(true);
          }} />
      )}
      {showDetalhesModal && notaDetalhes && (
        <ModalDetalhesNFe nota={notaDetalhes}
          onClose={() => { setShowDetalhesModal(false); setNotaDetalhes(null); }} />
      )}
      {showCancelarModal && notaParaCancelar && (
        <ModalCancelarNFe nota={notaParaCancelar}
          onClose={() => { setShowCancelarModal(false); setNotaParaCancelar(null); }}
          onCancelado={async (id) => {
            await updateNotaFiscal(id, { status: 'Cancelada' });
            fetchNotasFiscais();
          }} />
      )}

      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Notas Fiscais</h2>
              <div className="flex gap-4 mt-2">
                {[{ key: 'TODOS', label: 'Todas' }, { key: 'Pendente', label: 'Pendentes' }, { key: 'Emitida', label: 'Emitidas' }].map(a => (
                  <button key={a.key} onClick={() => setFiltroStatus(a.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${filtroStatus === a.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
                    {a.label} <span className="text-xs opacity-70">({contadores[a.key] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>
            <Button icon={Plus} onClick={abrirNovaEmissao}>Nova Nota Fiscal</Button>
          </div>
        </div>

        {contadores.Pendente > 0 && (
          <div className="mx-6 mt-4 bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-center gap-2 text-sm text-yellow-800">
            <Clock className="w-4 h-4 flex-shrink-0" />
            <span><strong>{contadores.Pendente}</strong> nota(s) aguardando emissão.{' '}
              <button onClick={() => setFiltroStatus('Pendente')} className="underline">Ver pendentes</button></span>
          </div>
        )}

        <Table headers={headers}>
          {notasExibidas.length > 0 ? notasExibidas.map(nota => (
            <tr key={nota.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-sm font-mono font-medium text-slate-800">{nota.numero}/{nota.serie || '1'}</td>
              <td className="px-6 py-4 text-sm text-slate-600">{new Date(nota.data + 'T00:00:00').toLocaleDateString('pt-BR')}</td>
              <td className="px-6 py-4 text-sm text-slate-800">{nota.cliente}</td>
              <td className="px-6 py-4 text-sm">
                <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{nota.tipo}</span>
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                R$ {parseFloat(nota.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-sm"><BadgeStatus status={nota.status} /></td>
              <td className="px-6 py-4 text-xs text-slate-500 font-mono max-w-[160px]">
                {nota.chave_acesso ? (
                  <span title={nota.chave_acesso} className="truncate block">
                    {nota.chave_acesso.slice(0, 20)}…
                  </span>
                ) : nota.protocolo ? (
                  <span className="text-green-700">{nota.protocolo}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-right space-x-2">
                {nota.status === 'Emitida' && (
                  <button
                    onClick={() => { setNotaDetalhes(nota); setShowDetalhesModal(true); }}
                    className="text-indigo-600 hover:text-indigo-700" title="Ver detalhes e baixar"
                  >
                    <Eye className="w-4 h-4" />
                  </button>
                )}
                {nota.status === 'Pendente' && (
                  <button onClick={() => { setNotaParaEmitir(nota); setShowEmitirModal(true); }}
                    className="text-green-600 hover:text-green-700" title="Emitir NF-e">
                    <Send className="w-4 h-4" />
                  </button>
                )}
                {(nota.status === 'Emitida' || nota.status === 'Autorizada') && nota.chave_acesso && (
                  <button onClick={() => { setNotaParaCancelar(nota); setShowCancelarModal(true); }}
                    className="text-red-500 hover:text-red-700" title="Cancelar NF-e">
                    <Ban className="w-4 h-4" />
                  </button>
                )}
                <button onClick={() => abrirModal(nota)} className="text-blue-600 hover:text-blue-700" title="Editar">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(nota.id)} className="text-red-600 hover:text-red-700" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={8} className="px-6 py-12 text-center text-slate-500">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma nota fiscal encontrada
              </td>
            </tr>
          )}
        </Table>
      </Card>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)}
        title={editingNota ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
        footer={<><Button variant="secondary" onClick={() => setShowModal(false)}>Cancelar</Button>
          <Button icon={Save} onClick={handleSave} disabled={loading}>Salvar</Button></>}>
        <div className="space-y-4">
          <Input label="Número *" value={formData.numero} onChange={e => setFormData(p => ({ ...p, numero: e.target.value }))} />
          <Input label="Data *" type="date" value={formData.data} onChange={e => setFormData(p => ({ ...p, data: e.target.value }))} />

          {/* Seletor de cliente cadastrado */}
          {clientesLista.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Cliente cadastrado <span className="text-slate-400 font-normal">(ou preencha manualmente abaixo)</span>
              </label>
              <select
                className="input"
                value={formData.cliente_id}
                onChange={e => {
                  const c = clientesLista.find(x => x.id === e.target.value);
                  setFormData(p => ({
                    ...p,
                    cliente_id: e.target.value,
                    cliente: c ? (c.nome_fantasia || c.nome) : p.cliente,
                  }));
                }}
              >
                <option value="">— Selecionar cliente —</option>
                {clientesLista.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.nome_fantasia ? `${c.nome_fantasia} (${c.nome})` : c.nome}
                    {c.cpf_cnpj ? ` — ${c.cpf_cnpj}` : ''}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Input
            label="Nome do destinatário *"
            value={formData.cliente}
            onChange={e => setFormData(p => ({ ...p, cliente: e.target.value, cliente_id: '' }))}
            placeholder="Nome/Razão Social do destinatário"
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Tipo *</label>
              <select className="input" value={formData.tipo} onChange={e => setFormData(p => ({ ...p, tipo: e.target.value }))}>
                <option>NF-e</option><option>NFC-e</option><option>NFS-e</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
              <select className="input" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
                <option>Pendente</option><option>Emitida</option><option>Cancelada</option>
              </select>
            </div>
          </div>
          <Input label="Valor (R$) *" type="number" step="0.01" value={formData.valor} onChange={e => setFormData(p => ({ ...p, valor: e.target.value }))} />
        </div>
      </Modal>
    </div>
  );
};

export default NotasFiscais;
