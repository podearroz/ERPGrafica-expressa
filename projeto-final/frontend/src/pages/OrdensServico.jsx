import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle, FileText, Eye, Trash2, Printer, Search, DollarSign } from 'lucide-react';

const FORMAS_PAGAMENTO = ['Dinheiro', 'PIX', 'Cartão de Débito', 'Cartão de Crédito', 'Boleto', 'Cheque', 'Transferência'];
import useOrdemServicoStore from '@store/ordemServicoStore';
import { supabase } from '@/config/supabaseClient';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Pagination from '@components/common/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const STATUS_CONFIG = {
  ABERTA: { label: 'Aberta', className: 'bg-blue-100 text-blue-700' },
  FATURADA: { label: 'Faturada', className: 'bg-green-100 text-green-700' },
  FATURADA_SEM_NF: { label: 'Faturada s/ NF', className: 'bg-teal-100 text-teal-700' },
  CANCELADA: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

const BadgeStatus = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

// ─── Função de Impressão ──────────────────────────────────────────────────────
const imprimirOS = (os) => {
  const fmtMoney = (v) =>
    parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
  const fmtDate = (d) =>
    d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

  const nomeCliente = os.cliente?.nome || os.cliente_nome || 'Não informado';
  const telefoneCliente = os.cliente?.telefone || os.cliente_telefone || '';
  const cpfCnpj = os.cliente?.cpf_cnpj || '';

  const itensHtml = (os.itens || [])
    .map(
      (item) => `
      <tr>
        <td style="border:1px solid #ddd;padding:8px;">${item.descricao}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:center;">${item.quantidade}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right;">R$ ${fmtMoney(item.valor_unitario)}</td>
        <td style="border:1px solid #ddd;padding:8px;text-align:right;font-weight:600;">R$ ${fmtMoney(item.valor_total)}</td>
      </tr>`
    )
    .join('');

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <title>OS ${os.numero_os}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 13px; color: #333; padding: 24px; }
    .header { display: flex; justify-content: space-between; align-items: flex-start;
              border-bottom: 3px solid #1e40af; padding-bottom: 14px; margin-bottom: 20px; }
    .header-left h1 { font-size: 22px; color: #1e40af; }
    .header-left p { font-size: 13px; color: #555; margin-top: 4px; }
    .header-right { text-align: right; }
    .header-right .os-num { font-size: 28px; font-weight: 700; color: #1e40af; }
    .header-right .os-data { font-size: 12px; color: #666; margin-top: 4px; }
    .section { border: 1px solid #e2e8f0; border-radius: 6px; padding: 14px; margin-bottom: 16px; }
    .section-title { font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;
                     letter-spacing: 0.05em; margin-bottom: 8px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .info-item label { font-size: 11px; color: #94a3b8; display: block; }
    .info-item span { font-size: 13px; font-weight: 600; color: #1e293b; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    thead tr { background: #f1f5f9; }
    th { border: 1px solid #ddd; padding: 8px; text-align: left; font-weight: 600; font-size: 12px; }
    .total-row { display: flex; justify-content: flex-end; }
    .total-box { border: 1px solid #e2e8f0; border-radius: 6px; padding: 12px 20px;
                 min-width: 220px; margin-top: 12px; }
    .total-line { display: flex; justify-content: space-between; font-size: 13px; padding: 3px 0; }
    .total-line.final { font-size: 16px; font-weight: 700; color: #1e40af;
                        border-top: 1px solid #e2e8f0; margin-top: 6px; padding-top: 6px; }
    .obs-box { background: #f8fafc; border-radius: 4px; padding: 10px; font-size: 13px;
               color: #475569; white-space: pre-wrap; }
    .assinatura { display: flex; justify-content: space-around; margin-top: 40px; padding-top: 20px; }
    .assinatura-linha { text-align: center; }
    .assinatura-linha hr { border: none; border-top: 1px solid #94a3b8; width: 180px; margin-bottom: 6px; }
    .assinatura-linha p { font-size: 12px; color: #64748b; }
    .badge { display: inline-block; padding: 3px 10px; border-radius: 20px; font-size: 12px;
             font-weight: 600; background: #dbeafe; color: #1e40af; }
    @media print {
      body { padding: 12px; }
      button { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="header-left">
      <h1>Sistema de Gestão</h1>
      <p>Ordem de Serviço</p>
    </div>
    <div class="header-right">
      <div class="os-num">${os.numero_os}</div>
      <div class="os-data">Data: ${fmtDate(os.data_abertura)}</div>
      <div style="margin-top:6px;"><span class="badge">${os.status}</span></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados do Cliente</div>
    <div class="info-grid">
      <div class="info-item">
        <label>Nome</label>
        <span>${nomeCliente}</span>
      </div>
      ${telefoneCliente ? `<div class="info-item"><label>Telefone</label><span>${telefoneCliente}</span></div>` : ''}
      ${cpfCnpj ? `<div class="info-item"><label>CPF/CNPJ</label><span>${cpfCnpj}</span></div>` : ''}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Itens da Ordem de Serviço</div>
    <table>
      <thead>
        <tr>
          <th>Descrição</th>
          <th style="text-align:center;width:80px;">Qtd</th>
          <th style="text-align:right;width:120px;">Valor Unit.</th>
          <th style="text-align:right;width:120px;">Total</th>
        </tr>
      </thead>
      <tbody>
        ${itensHtml || '<tr><td colspan="4" style="padding:12px;text-align:center;color:#94a3b8;">Sem itens</td></tr>'}
      </tbody>
    </table>

    <div class="total-row">
      <div class="total-box">
        ${parseFloat(os.desconto || 0) > 0 ? `
          <div class="total-line">
            <span>Subtotal:</span>
            <span>R$ ${fmtMoney(os.valor_total)}</span>
          </div>
          <div class="total-line">
            <span>Desconto:</span>
            <span style="color:#dc2626;">- R$ ${fmtMoney(os.desconto)}</span>
          </div>
        ` : ''}
        <div class="total-line final">
          <span>TOTAL:</span>
          <span>R$ ${fmtMoney(os.valor_final)}</span>
        </div>
      </div>
    </div>
  </div>

  ${os.observacoes ? `
  <div class="section">
    <div class="section-title">Observações</div>
    <div class="obs-box">${os.observacoes}</div>
  </div>` : ''}

  <div class="assinatura">
    <div class="assinatura-linha">
      <hr/>
      <p>Assinatura do Cliente</p>
    </div>
    <div class="assinatura-linha">
      <hr/>
      <p>Responsável pelo Serviço</p>
    </div>
  </div>

  <script>window.onload = () => window.print();</script>
</body>
</html>`;

  const janela = window.open('', '_blank', 'width=900,height=700');
  janela.document.write(html);
  janela.document.close();
};

// ─────────────────────────────────────────────────────────────────────────────
const OrdensServico = () => {
  const { ordensServico, loading, fetchOrdensServico, faturarOS, cancelarOS, deleteOS } = useOrdemServicoStore();

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [osSelecionada, setOsSelecionada] = useState(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [faturarComNF, setFaturarComNF] = useState(false);
  const [pagamentoStatus, setPagamentoStatus] = useState('a_receber'); // 'pago' | 'a_receber'
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split('T')[0]);

  useEffect(() => { fetchOrdensServico(); }, []);

  const resetPage = () => setCurrentPage(1);
  const handleSearch = (v) => { setSearchTerm(v); resetPage(); };
  const handleFiltro = (v) => { setFiltroStatus(v); resetPage(); };

  const cpfNorm = cpfFilter.replace(/\D/g, '');

  const ordens = (filtroStatus === 'TODOS' ? ordensServico : ordensServico.filter((os) => os.status === filtroStatus))
    .filter((os) => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!String(os.numero_os).includes(searchTerm) && !(os.cliente?.nome || os.cliente_nome || '').toLowerCase().includes(q)) return false;
      }
      if (dateFrom && os.data_abertura < dateFrom) return false;
      if (dateTo && os.data_abertura > dateTo) return false;
      if (cpfNorm) {
        const osCpf = (os.cliente?.cpf_cnpj || '').replace(/\D/g, '');
        if (!osCpf.includes(cpfNorm)) return false;
      }
      return true;
    });

  const pagedOrdens = ordens.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const contadores = {
    TODOS: ordensServico.length,
    ABERTA: ordensServico.filter((o) => o.status === 'ABERTA').length,
    FATURADA: ordensServico.filter((o) => o.status === 'FATURADA' || o.status === 'FATURADA_SEM_NF').length,
    CANCELADA: ordensServico.filter((o) => o.status === 'CANCELADA').length,
  };

  const abrirDetalhes = (os) => { setOsSelecionada(os); setShowDetalhesModal(true); };

  const abrirFaturar = (os) => {
    setOsSelecionada(os);
    setFaturarComNF(false);
    setPagamentoStatus('a_receber');
    setFormaPagamento('PIX');
    setDataPagamento(new Date().toISOString().split('T')[0]);
    setShowFaturarModal(true);
  };

  const abrirCancelar = (os) => {
    setOsSelecionada(os);
    setMotivoCancelamento('');
    setShowCancelarModal(true);
  };

  const handleFaturar = async () => {
    try {
      const pagamentoInfo = {
        pago: pagamentoStatus === 'pago',
        forma_recebimento: formaPagamento,
        data_recebimento: dataPagamento,
      };
      const resultado = await faturarOS(osSelecionada.id, faturarComNF, pagamentoInfo);
      const msgPag = pagamentoStatus === 'pago'
        ? ` Recebimento baixado como Recebido (${formaPagamento}).`
        : ' Lançado em Contas a Receber como pendente.';
      if (faturarComNF && resultado.notaFiscal) {
        toast.success(`OS faturada! NF nº ${resultado.notaFiscal.numero} criada como "Pendente".${msgPag}`, { duration: 6000 });
      } else {
        toast.success(`OS faturada!${msgPag}`, { duration: 5000 });
      }
      setShowFaturarModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao faturar OS.');
    }
  };

  const handleCancelar = async () => {
    try {
      await cancelarOS(osSelecionada.id, motivoCancelamento);
      toast.success('OS cancelada.');
      setShowCancelarModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao cancelar OS.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta OS?')) return;
    try {
      await deleteOS(id);
      toast.success('OS excluída.');
    } catch (error) {
      toast.error('Erro ao excluir OS.');
    }
  };


  const headers = [
    { label: 'Nº OS' },
    { label: 'Data' },
    { label: 'Cliente' },
    { label: 'Valor Final' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' },
  ];

  const abas = [
    { key: 'TODOS', label: 'Todas' },
    { key: 'ABERTA', label: 'Abertas' },
    { key: 'FATURADA', label: 'Faturadas' },
    { key: 'CANCELADA', label: 'Canceladas' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
              <div className="flex gap-4 mt-2">
                {abas.map((aba) => (
                  <button
                    key={aba.key}
                    onClick={() => handleFiltro(aba.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      filtroStatus === aba.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {aba.label}
                    <span className="ml-1 text-xs opacity-70">({contadores[aba.key] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Filtros */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Nº OS ou cliente..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
              </div>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                title="Data de abertura — início"
                className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-slate-400 text-sm">até</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                title="Data de abertura — fim"
                className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="text"
                placeholder="CPF/CNPJ do cliente"
                value={cpfFilter}
                onChange={(e) => { setCpfFilter(e.target.value); resetPage(); }}
                className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              {(searchTerm || dateFrom || dateTo || cpfFilter) && (
                <button
                  onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setCpfFilter(''); resetPage(); }}
                  className="text-xs text-slate-500 hover:text-red-500 underline"
                >
                  Limpar filtros
                </button>
              )}
            </div>
            {/* Resumo rápido */}
            <div className="flex items-center gap-3">
            <div className="hidden md:flex gap-4 text-center">
              <div className="bg-blue-50 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-blue-700">{contadores.ABERTA}</p>
                <p className="text-xs text-blue-600">Abertas</p>
              </div>
              <div className="bg-green-50 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-green-700">{contadores.FATURADA}</p>
                <p className="text-xs text-green-600">Faturadas</p>
              </div>
            </div>
            </div>
          </div>
        </div>

        <Table headers={headers}>
          {pagedOrdens.length > 0 ? (
            pagedOrdens.map((os) => (
              <tr key={os.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-mono font-medium text-slate-800">{os.numero_os}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(os.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  {os.cliente?.nome || os.cliente_nome || 'Cliente não informado'}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {parseFloat(os.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <BadgeStatus status={os.status} />
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  <button onClick={() => imprimirOS(os)} className="text-blue-500 hover:text-blue-700" title="Imprimir OS">
                    <Printer className="w-4 h-4" />
                  </button>
                  <button onClick={() => abrirDetalhes(os)} className="text-slate-500 hover:text-slate-700" title="Ver detalhes">
                    <Eye className="w-4 h-4" />
                  </button>
                  {os.status === 'ABERTA' && (
                    <>
                      <button onClick={() => abrirFaturar(os)} className="text-green-600 hover:text-green-700" title="Faturar">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => abrirCancelar(os)} className="text-red-500 hover:text-red-700" title="Cancelar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {os.status === 'CANCELADA' && (
                    <button onClick={() => handleDelete(os.id)} className="text-red-400 hover:text-red-600" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma ordem de serviço encontrada
              </td>
            </tr>
          )}
        </Table>
        <Pagination
          currentPage={currentPage}
          totalItems={ordens.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Modal: Detalhes da OS */}
      <Modal
        isOpen={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        title={`OS ${osSelecionada?.numero_os}`}
      >
        {osSelecionada && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Status</p>
                <BadgeStatus status={osSelecionada.status} />
              </div>
              <div>
                <p className="text-slate-500">Data de Abertura</p>
                <p className="font-medium">{new Date(osSelecionada.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-slate-500">Cliente</p>
                <p className="font-medium">
                  {osSelecionada.cliente?.nome || osSelecionada.cliente_nome || '—'}
                </p>
                {(osSelecionada.cliente?.telefone || osSelecionada.cliente_telefone) && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    {osSelecionada.cliente?.telefone || osSelecionada.cliente_telefone}
                  </p>
                )}
              </div>
              <div>
                <p className="text-slate-500">Valor Final</p>
                <p className="font-semibold text-slate-800">
                  R$ {parseFloat(osSelecionada.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              {osSelecionada.faturado_em && (
                <div>
                  <p className="text-slate-500">Faturado em</p>
                  <p className="font-medium">{new Date(osSelecionada.faturado_em).toLocaleString('pt-BR')}</p>
                </div>
              )}
              {osSelecionada.cancelado_em && (
                <div className="col-span-2">
                  <p className="text-slate-500">Motivo do Cancelamento</p>
                  <p className="font-medium text-red-700">{osSelecionada.motivo_cancelamento}</p>
                </div>
              )}
            </div>

            {osSelecionada.observacoes && (
              <div className="text-sm">
                <p className="text-slate-500 mb-1">Observações</p>
                <p className="bg-slate-50 rounded p-2 text-slate-700">{osSelecionada.observacoes}</p>
              </div>
            )}

            {osSelecionada.itens && osSelecionada.itens.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Itens</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-slate-600 font-medium">Descrição</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">Qtd</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">V. Unit.</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {osSelecionada.itens.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-2 text-slate-800">{item.descricao}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{item.quantidade}</td>
                          <td className="px-4 py-2 text-right text-slate-600">
                            R$ {parseFloat(item.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-800">
                            R$ {parseFloat(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => imprimirOS(osSelecionada)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
              >
                <Printer className="w-4 h-4 mr-1" /> Imprimir / WhatsApp
              </Button>
            </div>

            {osSelecionada.status === 'ABERTA' && (
              <div className="flex gap-2">
                <Button onClick={() => { setShowDetalhesModal(false); abrirFaturar(osSelecionada); }} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-1" /> Faturar
                </Button>
                <Button variant="secondary" onClick={() => { setShowDetalhesModal(false); abrirCancelar(osSelecionada); }} className="flex-1">
                  <XCircle className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Faturar */}
      <Modal
        isOpen={showFaturarModal}
        onClose={() => setShowFaturarModal(false)}
        title={`Faturar OS ${osSelecionada?.numero_os}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFaturarModal(false)}>Cancelar</Button>
            <Button icon={CheckCircle} onClick={handleFaturar} disabled={loading}>
              {faturarComNF ? 'Faturar com NF-e' : 'Faturar sem NF-e'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Valor a faturar:</p>
            <p className="text-2xl font-bold">
              R$ {parseFloat(osSelecionada?.valor_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Selecione o tipo de faturamento:</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="tipoFaturamento"
                  checked={!faturarComNF}
                  onChange={() => setFaturarComNF(false)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">Faturar sem NF-e</p>
                  <p className="text-xs text-slate-500">Baixa o estoque e fecha a OS sem emitir nota fiscal.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="tipoFaturamento"
                  checked={faturarComNF}
                  onChange={() => setFaturarComNF(true)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">Faturar com NF-e</p>
                  <p className="text-xs text-slate-500">Baixa o estoque e emite nota fiscal (acesse Notas Fiscais para emissão).</p>
                </div>
              </label>
            </div>
          </div>

          {/* Seção: Baixa no Caixa */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-3 flex items-center gap-1">
              <DollarSign className="w-4 h-4 text-green-600" /> Baixa no Caixa:
            </p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="pagamentoStatus"
                  checked={pagamentoStatus === 'a_receber'}
                  onChange={() => setPagamentoStatus('a_receber')}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">A receber (pendente)</p>
                  <p className="text-xs text-slate-500">Lança em Contas a Receber com status "Não Pago".</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="pagamentoStatus"
                  checked={pagamentoStatus === 'pago'}
                  onChange={() => setPagamentoStatus('pago')}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">Já recebido (baixar caixa)</p>
                  <p className="text-xs text-slate-500">Marca o recebimento como quitado imediatamente.</p>
                </div>
              </label>
            </div>
            {pagamentoStatus === 'pago' && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Forma de Pagamento</label>
                  <select
                    className="input text-sm"
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value)}
                  >
                    {FORMAS_PAGAMENTO.map(f => <option key={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Data do Recebimento</label>
                  <input
                    type="date"
                    className="input text-sm"
                    value={dataPagamento}
                    onChange={(e) => setDataPagamento(e.target.value)}
                  />
                </div>
              </div>
            )}
          </div>

          <p className="text-xs text-slate-400">
            Esta ação irá dar baixa automática no estoque dos produtos vinculados e não poderá ser desfeita.
          </p>
        </div>
      </Modal>

      {/* Modal: Cancelar */}
      <Modal
        isOpen={showCancelarModal}
        onClose={() => setShowCancelarModal(false)}
        title={`Cancelar OS ${osSelecionada?.numero_os}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelarModal(false)}>Voltar</Button>
            <Button
              onClick={handleCancelar}
              disabled={loading || motivoCancelamento.trim().length < 15}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="w-4 h-4 mr-1" /> Confirmar Cancelamento
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
            Atenção: o cancelamento não realiza baixa no estoque e não pode ser desfeito.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo do Cancelamento * <span className="text-slate-400 font-normal">(mínimo 15 caracteres)</span>
            </label>
            <textarea
              className="input resize-none"
              rows={4}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
            />
            <p className={`text-xs mt-1 ${motivoCancelamento.trim().length < 15 ? 'text-red-500' : 'text-green-600'}`}>
              {motivoCancelamento.trim().length}/15 caracteres mínimos
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrdensServico;
