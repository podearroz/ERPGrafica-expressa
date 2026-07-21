import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart2, AlertCircle, CheckCircle, Clock, Printer, ArrowUpCircle, ArrowDownCircle, Banknote } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useRecebimentoStore from '@store/recebimentoStore';
import usePagamentoStore from '@store/pagamentoStore';
import Card from '@components/common/Card';
import Modal from '@components/common/Modal';
import Button from '@components/common/Button';

const fmtMoney = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const today = () => new Date().toISOString().split('T')[0];

const primeiroDiaMes = (offset = 0) => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1 + offset).padStart(2, '0')}-01`;
};
const ultimoDiaMes = (offset = 0) => {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1 + offset, 0);
  return last.toISOString().split('T')[0];
};

// Botões de atalho de período
const AtalhoPeriodo = ({ onSelect }) => (
  <div className="flex gap-1">
    {[
      { label: 'Hoje',       from: today(),          to: today() },
      { label: 'Mês atual',  from: primeiroDiaMes(),  to: ultimoDiaMes() },
      { label: 'Mês ant.',   from: primeiroDiaMes(-1), to: ultimoDiaMes(-1) },
    ].map(p => (
      <button
        key={p.label}
        onClick={() => onSelect(p.from, p.to)}
        className="px-2 py-1 text-xs rounded border border-slate-300 text-slate-600 hover:bg-slate-100 whitespace-nowrap"
      >
        {p.label}
      </button>
    ))}
  </div>
);

const BadgeStatus = ({ status }) => {
  const cfg = {
    'Recebido':  'bg-green-100 text-green-700',
    'Pago':      'bg-green-100 text-green-700',
    'Não Pago':  'bg-red-100 text-red-700',
    'Pendente':  'bg-yellow-100 text-yellow-700',
    'Parcelado': 'bg-blue-100 text-blue-700',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${cfg[status] || 'bg-slate-100 text-slate-600'}`}>
      {status}
    </span>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
const Relatorios = () => {
  const { getTotalVendas, vendas, fetchVendas } = useVendaStore();
  const { recebimentos, getTotalEntradas, getTotalSaidas, getRecebimentosByCategoria, fetchRecebimentos, marcarRecebido } = useRecebimentoStore();
  const { getTotalPagamentos, getPagamentosByCategoria, pagamentos, fetchPagamentos } = usePagamentoStore();

  const [aba, setAba] = useState('recebidas');

  // ── Modal de baixa direto no Contas a Receber ──────────────────────────
  const [showBaixaModal, setShowBaixaModal] = useState(false);
  const [recSelecionado, setRecSelecionado] = useState(null);
  const [baixaForm, setBaixaForm] = useState({
    forma_recebimento: 'PIX',
    conta_bancaria: 'SICOOB',
    data_recebimento: new Date().toISOString().split('T')[0],
    observacao: '',
    desconto: '',
  });

  const formaParaConta = (f) => {
    if (f === 'Dinheiro') return 'CAIXA';
    if (f === 'Cartão de Crédito' || f === 'Cartão de Débito') return 'MAQUININHA';
    return 'SICOOB';
  };

  const abrirBaixa = (rec) => {
    setRecSelecionado(rec);
    setBaixaForm({ forma_recebimento: 'PIX', conta_bancaria: 'SICOOB', data_recebimento: new Date().toISOString().split('T')[0], observacao: '', desconto: '' });
    setShowBaixaModal(true);
  };

  const handleBaixar = async () => {
    try {
      await marcarRecebido(recSelecionado.id, baixaForm);
      await fetchRecebimentos();
      setShowBaixaModal(false);
    } catch (e) { alert('Erro ao dar baixa: ' + e.message); }
  };
  const [contaFiltro, setContaFiltro] = useState('TODOS');
  const [saldoAnterior, setSaldoAnterior] = useState(
    () => localStorage.getItem('extrato_saldo_anterior') || '0'
  );
  const handleSaldoAnterior = (v) => {
    setSaldoAnterior(v);
    localStorage.setItem('extrato_saldo_anterior', v);
  };

  // Cada aba tem seu próprio período — padrão: hoje
  const [dateFrom, setDateFrom] = useState(today());
  const [dateTo,   setDateTo]   = useState(today());

  const setPeriodo = (from, to) => { setDateFrom(from); setDateTo(to); };

  const refreshAll = () => {
    fetchVendas();
    fetchRecebimentos();
    fetchPagamentos();
  };

  useEffect(() => {
    refreshAll();

    // Auto-refresh ao voltar para a aba
    const onVisible = () => { if (!document.hidden) refreshAll(); };
    document.addEventListener('visibilitychange', onVisible);

    // Auto-refresh a cada 60 segundos
    const interval = setInterval(refreshAll, 60000);

    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      clearInterval(interval);
    };
  }, []);

  const totalVendas = getTotalVendas();
  const totalRecebimentos = getTotalEntradas();
  const totalPagamentos = getTotalPagamentos();
  const saldoAtual = totalRecebimentos - totalPagamentos;
  const recebimentosPorCategoria = getRecebimentosByCategoria();
  const pagamentosPorCategoria = getPagamentosByCategoria();

  // ── Contas Recebidas (já baixadas) filtradas pelo período ─────────────────
  const contasRecebidas = useMemo(() => {
    return recebimentos
      .filter(r => r.status === 'Recebido')
      .filter(r => {
        const dataEf = r.data_recebimento || r.data;
        if (dateFrom && dataEf < dateFrom) return false;
        if (dateTo   && dataEf > dateTo)   return false;
        return true;
      })
      .sort((a, b) => {
        const da = a.data_recebimento || a.data || '';
        const db = b.data_recebimento || b.data || '';
        return da.localeCompare(db);
      });
  }, [recebimentos, dateFrom, dateTo]);
  const totalRecebido = contasRecebidas.reduce((s, r) => s + parseFloat(r.valor || 0), 0);

  // ── Contas a Receber (pendentes) filtradas por vencimento ─────────────────
  const contasReceber = useMemo(() => {
    return recebimentos
      .filter(r => r.tipo === 'entrada' || !r.tipo)
      .filter(r => r.status !== 'Recebido')
      .filter(r => {
        if (dateFrom && r.data < dateFrom) return false;
        if (dateTo   && r.data > dateTo)   return false;
        return true;
      })
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [recebimentos, dateFrom, dateTo]);

  const totalReceber    = contasReceber.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
  const totalVencidoRec = contasReceber
    .filter(r => r.data < today())
    .reduce((s, r) => s + parseFloat(r.valor || 0), 0);

  // ── Contas a Pagar filtradas pelo período ─────────────────────────────────
  const contasPagar = useMemo(() => {
    return pagamentos
      .filter(p => p.status === 'Pendente')
      .filter(p => {
        if (dateFrom && p.data < dateFrom) return false;
        if (dateTo && p.data > dateTo) return false;
        return true;
      })
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [pagamentos, dateFrom, dateTo]);

  const totalPagar = contasPagar.reduce((s, p) => s + parseFloat(p.valor || 0), 0);
  const totalVencidoPag = contasPagar
    .filter(p => p.data < today())
    .reduce((s, p) => s + parseFloat(p.valor || 0), 0);

  // ── Vendas em Aberto (pendentes) filtradas pelo período ───────────────────
  const getClienteNomeVenda = (v) => v.cliente?.nome || v.cliente_nome || '(Avulso)';
  const vendasAberto = useMemo(() => {
    return vendas
      .filter(v => v.status === 'Pendente')
      .filter(v => {
        if (dateFrom && v.data < dateFrom) return false;
        if (dateTo   && v.data > dateTo)   return false;
        return true;
      })
      .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  }, [vendas, dateFrom, dateTo]);

  const totalVendasAberto = vendasAberto.reduce((s, v) => s + parseFloat(v.valor || 0), 0);

  const handlePrint = () => {
    const fmt  = (v) => parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fdt  = (d) => d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';
    const now  = new Date().toLocaleString('pt-BR');

    // Decide o conteúdo baseado na aba ativa
    let titulo = '';
    let thead = '';
    let tbody = '';
    let tfoot = '';
    let summaryHtml = '';

    if (aba === 'extrato') {
      titulo = `Extrato / Caixa — ${fdt(dateFrom)} a ${fdt(dateTo)}${contaFiltro !== 'TODOS' ? ` — ${contaFiltro}` : ''}`;
      thead = `<tr><th style="width:60px">Data</th><th>Lançamento</th><th>Cliente/Fornecedor</th><th style="width:70px">Conta</th><th style="width:80px;text-align:right">Entrada</th><th style="width:80px;text-align:right">Saída</th></tr>`;
      tbody = movimentosExtrato.map(m => `
        <tr>
          <td>${fdt(m.data)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.lancamento || '—'}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${m.cliente || '—'}</td>
          <td style="text-align:center;font-weight:600">${m.conta}</td>
          <td style="text-align:right;color:#15803d">${m.entrada > 0 ? 'R$ ' + fmt(m.entrada) : '—'}</td>
          <td style="text-align:right;color:#dc2626">${m.saida > 0 ? 'R$ ' + fmt(m.saida) : '—'}</td>
        </tr>`).join('');
      tfoot = '';
      const nEntradas = movimentosExtrato.filter(m => m.entrada > 0).length;
      const nSaidas   = movimentosExtrato.filter(m => m.saida > 0).length;
      const corSaldo  = saldoFinal >= 0 ? '#1d4ed8' : '#dc2626';
      const corPeriodo = saldoPeriodo >= 0 ? '#15803d' : '#dc2626';
      summaryHtml = `
        <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:10px">
          <div style="border:1px solid #e2e8f0;border-radius:8px;padding:10px">
            <p style="font-size:7.5px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Saldo Anterior</p>
            <p style="font-size:14px;font-weight:700;color:#1e293b">R$ ${fmt(saldoAnteriorNum)}</p>
          </div>
          <div style="border:1px solid #bbf7d0;border-radius:8px;padding:10px;background:#f0fdf4">
            <p style="font-size:7.5px;color:#16a34a;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">⊕ Entradas</p>
            <p style="font-size:14px;font-weight:700;color:#15803d">R$ ${fmt(totalEntradasExtrato)}</p>
            <p style="font-size:7px;color:#16a34a;margin-top:2px">${nEntradas} lançamento(s)</p>
          </div>
          <div style="border:1px solid #fecaca;border-radius:8px;padding:10px;background:#fff1f2">
            <p style="font-size:7.5px;color:#dc2626;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">⊖ Saídas</p>
            <p style="font-size:14px;font-weight:700;color:#dc2626">R$ ${fmt(totalSaidasExtrato)}</p>
            <p style="font-size:7px;color:#dc2626;margin-top:2px">${nSaidas} lançamento(s)</p>
          </div>
          <div style="border:1px solid #bfdbfe;border-radius:8px;padding:10px;background:#eff6ff">
            <p style="font-size:7.5px;color:#2563eb;font-weight:600;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Saldo Final</p>
            <p style="font-size:14px;font-weight:700;color:${corSaldo}">R$ ${fmt(saldoFinal)}</p>
            <p style="font-size:7px;color:${corPeriodo};margin-top:2px">Período: ${saldoPeriodo >= 0 ? '+' : ''}R$ ${fmt(saldoPeriodo)}</p>
          </div>
        </div>`;
    } else if (aba === 'recebidas') {
      titulo = `Contas Recebidas — ${fdt(dateFrom)} a ${fdt(dateTo)}`;
      thead = `<tr><th style="width:60px">Data Rec.</th><th>Descrição</th><th>Cliente</th><th style="width:70px">Conta</th><th style="width:80px;text-align:right">Valor</th></tr>`;
      tbody = contasRecebidas.map(r => `
        <tr>
          <td>${fdt(r.data_recebimento || r.data)}</td>
          <td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.descricao || '—'}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.cliente_nome || '—'}</td>
          <td style="text-align:center;font-weight:600">${r.conta_bancaria || '—'}</td>
          <td style="text-align:right;color:#15803d;font-weight:600">R$ ${fmt(r.valor)}</td>
        </tr>`).join('');
      tfoot = `<tr style="border-top:2px solid #334155"><td colspan="4" style="text-align:right;font-weight:700">Total Recebido:</td><td style="text-align:right;font-weight:700;color:#15803d;font-size:12px">R$ ${fmt(totalRecebido)}</td></tr>`;
    } else if (aba === 'receber') {
      titulo = `Contas a Receber — ${fdt(dateFrom)} a ${fdt(dateTo)}`;
      thead = `<tr><th style="width:60px">Vencimento</th><th>Descrição</th><th>Cliente</th><th style="width:60px;text-align:center">Parcela</th><th style="width:60px;text-align:center">Status</th><th style="width:80px;text-align:right">Valor</th></tr>`;
      tbody = contasReceber.map(r => `
        <tr>
          <td>${fdt(r.data)}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.descricao || '—'}</td>
          <td style="max-width:150px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.cliente_nome || '—'}</td>
          <td style="text-align:center">${r.parcela || '—'}</td>
          <td style="text-align:center">${r.status || '—'}</td>
          <td style="text-align:right;color:#15803d;font-weight:600">R$ ${fmt(r.valor)}</td>
        </tr>`).join('');
      tfoot = `<tr style="border-top:2px solid #334155"><td colspan="5" style="text-align:right;font-weight:700">Total:</td><td style="text-align:right;font-weight:700;color:#15803d;font-size:12px">R$ ${fmt(contasReceber.reduce((s,r)=>s+parseFloat(r.valor||0),0))}</td></tr>`;
    } else if (aba === 'pagar') {
      titulo = `Pagamento de Contas — ${fdt(dateFrom)} a ${fdt(dateTo)}`;
      thead = `<tr><th style="width:60px">Vencimento</th><th>Descrição</th><th style="width:60px;text-align:center">Status</th><th style="width:80px;text-align:right">Valor</th></tr>`;
      tbody = contasPagar.map(p => `
        <tr>
          <td>${fdt(p.data)}</td>
          <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${p.descricao || '—'}</td>
          <td style="text-align:center">${p.status || '—'}</td>
          <td style="text-align:right;color:#dc2626;font-weight:600">R$ ${fmt(p.valor)}</td>
        </tr>`).join('');
      tfoot = `<tr style="border-top:2px solid #334155"><td colspan="3" style="text-align:right;font-weight:700">Total:</td><td style="text-align:right;font-weight:700;color:#dc2626;font-size:12px">R$ ${fmt(contasPagar.reduce((s,p)=>s+parseFloat(p.valor||0),0))}</td></tr>`;
    } else if (aba === 'vendas_aberto') {
      titulo = `Vendas em Aberto — ${fdt(dateFrom)} a ${fdt(dateTo)}`;
      thead = `<tr><th style="width:60px">Data</th><th>Cliente</th><th>Produtos/Serviços</th><th style="width:60px;text-align:center">OS</th><th style="width:60px;text-align:center">Status</th><th style="width:80px;text-align:right">Valor</th></tr>`;
      tbody = vendasAberto.map(v => {
        const nome = v.cliente?.nome || v.cliente_nome || '(Avulso)';
        const os = v.ordens_servico?.[0]?.numero_os || '—';
        return `
        <tr>
          <td>${fdt(v.data)}</td>
          <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${nome}</td>
          <td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${v.produtos || '—'}</td>
          <td style="text-align:center">${os}</td>
          <td style="text-align:center">${v.status}</td>
          <td style="text-align:right;color:#15803d;font-weight:600">R$ ${fmt(v.valor)}</td>
        </tr>`;
      }).join('');
      tfoot = `<tr style="border-top:2px solid #334155"><td colspan="5" style="text-align:right;font-weight:700">Total em Aberto:</td><td style="text-align:right;font-weight:700;color:#dc2626;font-size:12px">R$ ${fmt(totalVendasAberto)}</td></tr>`;
    } else {
      // Resumo Geral — usa window.print() simples
      window.print();
      return;
    }

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${titulo}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: 9px; color: #1e293b; padding: 12mm 10mm; }
    h1 { font-size: 13px; margin-bottom: 4px; }
    .sub { font-size: 8px; color: #64748b; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; table-layout: fixed; }
    th { background: #f1f5f9; padding: 4px 5px; text-align: left; font-size: 8px; border-bottom: 2px solid #cbd5e1; white-space: nowrap; }
    td { padding: 3px 5px; border-bottom: 1px solid #e2e8f0; font-size: 8.5px; vertical-align: middle; }
    tr:nth-child(even) td { background: #f8fafc; }
    tfoot td { padding: 4px 5px; background: #f8fafc; }
    @page { size: A4 portrait; margin: 0; }
    @media print { body { padding: 10mm 8mm; } }
  </style>
</head>
<body>
  <h1>Gráfica Express — ${titulo}</h1>
  <p class="sub">Gerado em ${now} | CNPJ 07.240.770/0001-50</p>
  ${summaryHtml}
  <table>
    <thead>${thead}</thead>
    <tbody>${tbody || '<tr><td colspan="6" style="text-align:center;padding:12px;color:#94a3b8">Nenhum lançamento no período</td></tr>'}</tbody>
    <tfoot>${tfoot}</tfoot>
  </table>
</body>
</html>`;

    const win = window.open('', '_blank', 'width=900,height=700');
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
  };

  // ── Extrato (entradas recebidas + saídas pagas) ───────────────────────────
  const movimentosExtrato = useMemo(() => {
    const entradas = recebimentos
      .filter(r => r.status === 'Recebido')
      .filter(r => {
        const dataEfetiva = r.data_recebimento || r.data;
        if (dateFrom && dataEfetiva < dateFrom) return false;
        if (dateTo && dataEfetiva > dateTo) return false;
        if (contaFiltro !== 'TODOS' && (r.conta_bancaria || 'CAIXA') !== contaFiltro) return false;
        return true;
      })
      .map(r => ({
        id: r.id,
        data: r.data_recebimento || r.data,
        lancamento: r.descricao,
        cliente: r.cliente_nome || r.venda?.cliente?.nome || '—',
        conta: r.conta_bancaria || 'CAIXA',
        entrada: parseFloat(r.valor || 0),
        saida: 0,
      }));

    const saidas = pagamentos
      .filter(p => p.status === 'Pago')
      .filter(p => {
        const dataEfetiva = p.data_pagamento || p.data;
        if (dateFrom && dataEfetiva < dateFrom) return false;
        if (dateTo && dataEfetiva > dateTo) return false;
        if (contaFiltro !== 'TODOS' && (p.conta_bancaria || 'SICOOB') !== contaFiltro) return false;
        return true;
      })
      .map(p => ({
        id: p.id,
        data: p.data_pagamento || p.data,
        lancamento: p.descricao,
        cliente: p.descricao,
        conta: p.conta_bancaria || 'SICOOB',
        entrada: p.tipo === 'entrada' ? parseFloat(p.valor || 0) : 0,
        saida: p.tipo !== 'entrada' ? parseFloat(p.valor || 0) : 0,
      }));

    return [...entradas, ...saidas].sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [recebimentos, pagamentos, dateFrom, dateTo, contaFiltro]);

  const totalEntradasExtrato = movimentosExtrato.reduce((s, m) => s + m.entrada, 0);
  const totalSaidasExtrato   = movimentosExtrato.reduce((s, m) => s + m.saida, 0);
  const saldoAnteriorNum     = parseFloat(saldoAnterior.replace(',', '.') || 0);
  const saldoPeriodo         = totalEntradasExtrato - totalSaidasExtrato;
  const saldoFinal           = saldoAnteriorNum + saldoPeriodo;

  const CONTAS = ['TODOS', 'CAIXA', 'SICOOB', 'MAQUININHA'];
  const CONTA_CORES = {
    CAIXA:      'bg-green-100 text-green-700',
    SICOOB:     'bg-blue-100 text-blue-700',
    MAQUININHA: 'bg-purple-100 text-purple-700',
  };

  const abas = [
    { key: 'recebidas',     label: `Contas Recebidas (${contasRecebidas.length})` },
    { key: 'receber',       label: `Contas a Receber (${contasReceber.length})` },
    { key: 'pagar',         label: `Pagamento de Contas (${contasPagar.length})` },
    { key: 'vendas_aberto', label: `Vendas em Aberto (${vendasAberto.length})` },
    { key: 'extrato',       label: 'Extrato / Caixa' },
    { key: 'resumo',        label: 'Resumo Geral' },
  ];

  return (
    <div className="space-y-4 print:space-y-2">
      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 1cm; }

          /* Esconde elementos de interface */
          .print-hidden, .print\\:hidden { display: none !important; }

          /* Corpo */
          body { font-size: 8px !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

          /* Remove scroll lateral — garante que tabela caiba na página */
          .overflow-x-auto { overflow: visible !important; }

          /* Tabela: layout fixo, sem quebra de linha nas células */
          table {
            font-size: 8px !important;
            border-collapse: collapse !important;
            width: 100% !important;
            table-layout: fixed !important;
          }
          th {
            font-size: 8px !important;
            padding: 3px 4px !important;
            background: #f1f5f9 !important;
            white-space: nowrap !important;
          }
          td {
            font-size: 8px !important;
            padding: 2px 4px !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          /* Larguras fixas para tabela do extrato (6 colunas — A4 = ~190mm) */
          table th:nth-child(1), table td:nth-child(1) { width: 52px !important; }  /* Data */
          table th:nth-child(2), table td:nth-child(2) { width: 30% !important; }   /* Lançamento */
          table th:nth-child(3), table td:nth-child(3) { width: 25% !important; }   /* Cliente */
          table th:nth-child(4), table td:nth-child(4) { width: 60px !important; }  /* Conta */
          table th:nth-child(5), table td:nth-child(5) { width: 70px !important; }  /* Entrada */
          table th:nth-child(6), table td:nth-child(6) { width: 70px !important; }  /* Saída */

          /* Badges de conta: texto simples, sem pill */
          span[class*="rounded-full"] {
            background: none !important;
            border: none !important;
            border-radius: 0 !important;
            padding: 0 !important;
            font-size: 7px !important;
            font-weight: 600 !important;
          }

          /* Cards de resumo: uma linha horizontal compacta */
          .grid {
            display: flex !important;
            flex-wrap: nowrap !important;
            gap: 6px !important;
            margin-bottom: 8px !important;
          }
          .grid > div {
            flex: 1 !important;
            padding: 4px 6px !important;
            min-width: 0 !important;
          }
          .grid p { font-size: 7px !important; margin: 0 !important; }
          .grid input { font-size: 9px !important; font-weight: bold; }

          /* Reduz espaços internos de Cards */
          .p-4 { padding: 6px !important; }
          .px-4 { padding-left: 6px !important; padding-right: 6px !important; }
          .py-3 { padding-top: 3px !important; padding-bottom: 3px !important; }
          .py-2\\.5 { padding-top: 2px !important; padding-bottom: 2px !important; }

          /* Rodapé da tabela (totais) */
          tfoot td { font-size: 8px !important; white-space: nowrap !important; }
          tfoot tr:last-child td { font-size: 10px !important; }

          /* Ícones SVG: esconde para não ocupar espaço */
          svg { display: none !important; }
        }
      `}</style>
      {/* Header com abas e filtros */}
      <Card>
        <div className="p-4 border-b border-slate-200">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-blue-600" /> Relatórios
              </h2>
              <div className="flex gap-4 mt-2">
                {abas.map(a => (
                  <button
                    key={a.key}
                    onClick={() => setAba(a.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      aba === a.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 print:hidden flex-wrap">
              {aba === 'extrato' && (
                <select
                  value={contaFiltro}
                  onChange={e => setContaFiltro(e.target.value)}
                  className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {CONTAS.map(c => <option key={c} value={c}>{c === 'TODOS' ? 'Todas as contas' : c}</option>)}
                </select>
              )}
              {aba !== 'resumo' && <AtalhoPeriodo onSelect={setPeriodo} />}
              {aba !== 'resumo' && (
                <>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => setDateFrom(e.target.value)}
                    className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-slate-400 text-sm">até</span>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => setDateTo(e.target.value)}
                    className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}
              <button
                onClick={handlePrint}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-slate-300 rounded-lg hover:bg-slate-50 text-slate-600"
              >
                <Printer className="w-4 h-4" /> Imprimir
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* ── ABA: CONTAS RECEBIDAS ────────────────────────────────────────── */}
      {aba === 'recebidas' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-green-50 border border-green-200 rounded-xl p-4">
              <p className="text-sm text-green-700 font-medium flex items-center gap-1">
                <CheckCircle className="w-4 h-4" /> Total Recebido no Período
              </p>
              <p className="text-2xl font-bold text-green-700 mt-1">R$ {fmtMoney(totalRecebido)}</p>
              <p className="text-xs text-green-500 mt-1">{contasRecebidas.length} lançamento(s)</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500 font-medium">Período</p>
              <p className="text-base font-semibold text-slate-700 mt-1">
                {fmtDate(dateFrom)} até {fmtDate(dateTo)}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium">Ticket Médio</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                R$ {fmtMoney(contasRecebidas.length > 0 ? totalRecebido / contasRecebidas.length : 0)}
              </p>
              <p className="text-xs text-blue-400 mt-1">por recebimento</p>
            </div>
          </div>

          <Card>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">
                Contas Recebidas — {fmtDate(dateFrom)} até {fmtDate(dateTo)}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Data Recebimento</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-center font-semibold">Forma</th>
                    <th className="px-4 py-3 text-center font-semibold">Conta</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {contasRecebidas.length > 0 ? contasRecebidas.map(r => (
                    <tr key={r.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmtDate(r.data_recebimento || r.data)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {r.cliente_nome || r.venda?.cliente?.nome || '—'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.descricao}>
                        {r.descricao}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs">
                        {r.forma_recebimento || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTA_CORES[r.conta_bancaria] || 'bg-slate-100 text-slate-600'}`}>
                          {r.conta_bancaria || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700">
                        R$ {fmtMoney(r.valor)}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhum recebimento no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
                {contasRecebidas.length > 0 && (
                  <tfoot className="bg-green-50 border-t-2 border-green-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 font-semibold text-slate-700 text-right">
                        Total Recebido:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                        R$ {fmtMoney(totalRecebido)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── ABA: RESUMO GERAL ─────────────────────────────────────────────── */}
      {aba === 'resumo' && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Relatório de Pagamentos */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingDown className="w-5 h-5 text-red-500" />
                Pagamentos (Saídas)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total Pago:</span>
                  <span className="font-bold text-red-600">R$ {fmtMoney(totalPagamentos)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Pendentes (todos):</span>
                  <span className="font-semibold text-yellow-600">
                    R$ {fmtMoney(pagamentos.filter(p => p.status === 'Pendente').reduce((s, p) => s + parseFloat(p.valor || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Qtd. pendentes:</span>
                  <span className="font-semibold text-slate-800">
                    {pagamentos.filter(p => p.status === 'Pendente').length}
                  </span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Por Categoria:</h4>
                <div className="space-y-1.5">
                  {Object.entries(pagamentosPorCategoria).length > 0 ? (
                    Object.entries(pagamentosPorCategoria).map(([cat, val]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-medium text-slate-800">R$ {fmtMoney(val)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-2">Nenhum pagamento registrado</p>
                  )}
                </div>
              </div>
            </Card>

            {/* Relatório de Recebimentos */}
            <Card className="p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-green-500" />
                Recebimentos (Entradas)
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total Recebido:</span>
                  <span className="font-bold text-green-600">R$ {fmtMoney(totalRecebimentos)}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Pendentes (todos):</span>
                  <span className="font-semibold text-yellow-600">
                    R$ {fmtMoney(recebimentos.filter(r => r.status !== 'Recebido').reduce((s, r) => s + parseFloat(r.valor || 0), 0))}
                  </span>
                </div>
                <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
                  <span className="text-slate-600">Total de Vendas:</span>
                  <span className="font-semibold text-slate-800">R$ {fmtMoney(totalVendas)}</span>
                </div>
              </div>
              <div className="mt-4 pt-4 border-t border-slate-200">
                <h4 className="text-sm font-semibold text-slate-700 mb-2">Por Categoria:</h4>
                <div className="space-y-1.5">
                  {Object.entries(recebimentosPorCategoria).length > 0 ? (
                    Object.entries(recebimentosPorCategoria).map(([cat, val]) => (
                      <div key={cat} className="flex justify-between text-sm">
                        <span className="text-slate-600">{cat}</span>
                        <span className="font-medium text-slate-800">R$ {fmtMoney(val)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-400 text-center py-2">Nenhum recebimento registrado</p>
                  )}
                </div>
              </div>
            </Card>
          </div>

          {/* Resumo Geral */}
          <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
            <div className="p-6">
              <h3 className="text-xl font-bold mb-6">Resumo Geral (todos os períodos)</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-sm text-slate-300 mb-1">Receita Total</div>
                  <div className="text-2xl font-bold">R$ {fmtMoney(totalRecebimentos)}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-sm text-slate-300 mb-1">Despesa Total</div>
                  <div className="text-2xl font-bold">R$ {fmtMoney(totalPagamentos)}</div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-sm text-slate-300 mb-1">Lucro Líquido</div>
                  <div className={`text-2xl font-bold ${saldoAtual >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    R$ {fmtMoney(saldoAtual)}
                  </div>
                </div>
                <div className="bg-white/10 rounded-lg p-4">
                  <div className="text-sm text-slate-300 mb-1">Total de Vendas</div>
                  <div className="text-2xl font-bold">{vendas.length}</div>
                  <div className="text-sm text-slate-300 mt-1">
                    {vendas.filter(v => v.status === 'Pendente').length} pendentes
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="p-6">
              <h4 className="font-semibold text-slate-700 mb-3">Margem de Lucro</h4>
              <div className="text-3xl font-bold text-blue-600">
                {totalRecebimentos > 0 ? ((saldoAtual / totalRecebimentos) * 100).toFixed(1) : 0}%
              </div>
              <p className="text-sm text-slate-500 mt-2">Sobre receita total</p>
            </Card>
            <Card className="p-6">
              <h4 className="font-semibold text-slate-700 mb-3">Ticket Médio</h4>
              <div className="text-3xl font-bold text-green-600">
                R$ {vendas.length > 0 ? fmtMoney(totalVendas / vendas.length) : '0,00'}
              </div>
              <p className="text-sm text-slate-500 mt-2">Por venda</p>
            </Card>
            <Card className="p-6">
              <h4 className="font-semibold text-slate-700 mb-3">Taxa de Conversão</h4>
              <div className="text-3xl font-bold text-purple-600">
                {vendas.length > 0
                  ? ((vendas.filter(v => v.status === 'Pago').length / vendas.length) * 100).toFixed(1)
                  : 0}%
              </div>
              <p className="text-sm text-slate-500 mt-2">Vendas pagas</p>
            </Card>
          </div>
        </>
      )}

      {/* ── ABA: CONTAS A RECEBER ─────────────────────────────────────────── */}
      {aba === 'receber' && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500 font-medium">Total a Receber</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">R$ {fmtMoney(totalReceber)}</p>
              <p className="text-xs text-slate-400 mt-1">{contasReceber.length} lançamento(s)</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Vencidos
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">R$ {fmtMoney(totalVencidoRec)}</p>
              <p className="text-xs text-red-400 mt-1">
                {contasReceber.filter(r => r.data < today()).length} lançamento(s)
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium flex items-center gap-1">
                <Clock className="w-4 h-4" /> A Vencer
              </p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                R$ {fmtMoney(totalReceber - totalVencidoRec)}
              </p>
              <p className="text-xs text-blue-400 mt-1">
                {contasReceber.filter(r => r.data >= today()).length} lançamento(s)
              </p>
            </div>
          </div>

          <Card>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">
                Contas a Receber — {dateFrom ? fmtDate(dateFrom) : '...'} até {dateTo ? fmtDate(dateTo) : '...'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-center font-semibold">Parcela</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                    <th className="px-4 py-3 text-center font-semibold print:hidden">Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {contasReceber.length > 0 ? (
                    contasReceber.map(r => {
                      const vencido = r.data && r.data < today();
                      return (
                        <tr key={r.id} className={`border-t hover:bg-slate-50 ${vencido ? 'bg-red-50/40' : ''}`}>
                          <td className={`px-4 py-3 ${vencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                            {fmtDate(r.data)}
                            {vencido && <span className="ml-1 text-xs text-red-500">(vencido)</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-800">
                            {r.cliente_nome || r.venda?.cliente?.nome || '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={r.descricao}>
                            {r.descricao}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-500">
                            {r.parcelas > 1 ? `${r.parcela_atual}/${r.parcelas}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <BadgeStatus status={r.status || 'Não Pago'} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-green-700">
                            R$ {fmtMoney(r.valor)}
                          </td>
                          <td className="px-4 py-3 text-center print:hidden">
                            <button
                              onClick={() => abrirBaixa(r)}
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                              title="Dar baixa"
                            >
                              <Banknote className="w-3 h-3" /> Baixar
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhuma conta a receber no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
                {contasReceber.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={6} className="px-4 py-3 font-semibold text-slate-700 text-right">
                        Total a Receber:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-green-700 text-base">
                        R$ {fmtMoney(totalReceber)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── ABA: VENDAS EM ABERTO ────────────────────────────────────────── */}
      {aba === 'vendas_aberto' && (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
              <p className="text-sm text-orange-700 font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Total em Aberto
              </p>
              <p className="text-2xl font-bold text-orange-700 mt-1">R$ {fmtMoney(totalVendasAberto)}</p>
              <p className="text-xs text-orange-500 mt-1">{vendasAberto.length} venda(s) pendente(s)</p>
            </div>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500 font-medium">Período</p>
              <p className="text-base font-semibold text-slate-700 mt-1">
                {fmtDate(dateFrom)} até {fmtDate(dateTo)}
              </p>
            </div>
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <p className="text-sm text-blue-600 font-medium">Ticket Médio</p>
              <p className="text-2xl font-bold text-blue-700 mt-1">
                R$ {fmtMoney(vendasAberto.length > 0 ? totalVendasAberto / vendasAberto.length : 0)}
              </p>
              <p className="text-xs text-blue-400 mt-1">por venda em aberto</p>
            </div>
          </div>

          <Card>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">
                Vendas em Aberto — {fmtDate(dateFrom)} até {fmtDate(dateTo)}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente</th>
                    <th className="px-4 py-3 text-left font-semibold">Produtos/Serviços</th>
                    <th className="px-4 py-3 text-center font-semibold">OS</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasAberto.length > 0 ? vendasAberto.map(v => (
                    <tr key={v.id} className="border-t hover:bg-slate-50">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                        {fmtDate(v.data)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium">
                        {getClienteNomeVenda(v)}
                        {v.cliente_telefone && (
                          <span className="block text-xs text-slate-400">{v.cliente_telefone}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={v.produtos}>
                        {v.produtos || '—'}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-500 text-xs font-medium">
                        {v.ordens_servico?.[0]?.numero_os || '—'}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">
                          {v.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700">
                        R$ {fmtMoney(v.valor)}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhuma venda em aberto no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
                {vendasAberto.length > 0 && (
                  <tfoot className="bg-orange-50 border-t-2 border-orange-200">
                    <tr>
                      <td colSpan={5} className="px-4 py-3 font-semibold text-slate-700 text-right">
                        Total em Aberto:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-orange-700 text-base">
                        R$ {fmtMoney(totalVendasAberto)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── ABA: EXTRATO / CAIXA ─────────────────────────────────────────── */}
      {aba === 'extrato' && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">Saldo Anterior</p>
              <div className="mt-1 flex items-center gap-1">
                <span className="text-slate-400 text-sm">R$</span>
                <input
                  type="text"
                  value={saldoAnterior}
                  onChange={e => handleSaldoAnterior(e.target.value)}
                  className="w-full text-xl font-bold text-slate-800 bg-transparent border-b border-dashed border-slate-300 focus:outline-none focus:border-blue-400"
                  placeholder="0,00"
                  title="Saldo de abertura do período — salvo automaticamente"
                />
              </div>
            </div>
            <div className="bg-green-50 border border-green-100 rounded-xl p-4">
              <p className="text-xs text-green-600 font-medium uppercase tracking-wide flex items-center gap-1">
                <ArrowUpCircle className="w-3 h-3" /> Entradas
              </p>
              <p className="text-xl font-bold text-green-700 mt-1">R$ {fmtMoney(totalEntradasExtrato)}</p>
              <p className="text-xs text-green-500 mt-0.5">{movimentosExtrato.filter(m => m.entrada > 0).length} lançamento(s)</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-xs text-red-600 font-medium uppercase tracking-wide flex items-center gap-1">
                <ArrowDownCircle className="w-3 h-3" /> Saídas
              </p>
              <p className="text-xl font-bold text-red-700 mt-1">R$ {fmtMoney(totalSaidasExtrato)}</p>
              <p className="text-xs text-red-500 mt-0.5">{movimentosExtrato.filter(m => m.saida > 0).length} lançamento(s)</p>
            </div>
            <div className={`border rounded-xl p-4 ${saldoFinal >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-200'}`}>
              <p className={`text-xs font-medium uppercase tracking-wide ${saldoFinal >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
                Saldo Final
              </p>
              <p className={`text-xl font-bold mt-1 ${saldoFinal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                R$ {fmtMoney(saldoFinal)}
              </p>
              <p className={`text-xs mt-0.5 ${saldoPeriodo >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                Período: {saldoPeriodo >= 0 ? '+' : ''}R$ {fmtMoney(saldoPeriodo)}
              </p>
            </div>
          </div>

          <Card>
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-700">
                Extrato — {dateFrom ? fmtDate(dateFrom) : '...'} até {dateTo ? fmtDate(dateTo) : '...'}
                {contaFiltro !== 'TODOS' && <span className="ml-2 text-blue-600">({contaFiltro})</span>}
              </h3>
              <p className="text-xs text-slate-400">{movimentosExtrato.length} lançamento(s)</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Lançamento</th>
                    <th className="px-4 py-3 text-left font-semibold">Cliente/Fornecedor</th>
                    <th className="px-4 py-3 text-center font-semibold">Conta Bancária</th>
                    <th className="px-4 py-3 text-right font-semibold">Entrada</th>
                    <th className="px-4 py-3 text-right font-semibold">Saída</th>
                  </tr>
                </thead>
                <tbody>
                  {movimentosExtrato.length > 0 ? (
                    movimentosExtrato.map((m, i) => (
                      <tr key={m.id + i} className="border-t hover:bg-slate-50">
                        <td className="px-4 py-2.5 text-slate-600 whitespace-nowrap">{fmtDate(m.data)}</td>
                        <td className="px-4 py-2.5 text-slate-800 max-w-xs truncate" title={m.lancamento}>
                          {m.lancamento}
                        </td>
                        <td className="px-4 py-2.5 text-slate-600 max-w-xs truncate" title={m.cliente}>
                          {m.cliente}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${CONTA_CORES[m.conta] || 'bg-slate-100 text-slate-600'}`}>
                            {m.conta}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-green-700">
                          {m.entrada > 0 ? `R$ ${fmtMoney(m.entrada)}` : '—'}
                        </td>
                        <td className="px-4 py-2.5 text-right font-medium text-red-700">
                          {m.saida > 0 ? `R$ ${fmtMoney(m.saida)}` : '—'}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        Nenhum lançamento no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
                {movimentosExtrato.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200 text-sm">
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Saldo Anterior:</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-semibold text-slate-700">R$ {fmtMoney(saldoAnteriorNum)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Entradas:</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-semibold text-green-700">R$ {fmtMoney(totalEntradasExtrato)}</td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="px-4 py-2 text-right text-slate-500">Saídas:</td>
                      <td colSpan={2} className="px-4 py-2 text-right font-semibold text-red-700">R$ {fmtMoney(totalSaidasExtrato)}</td>
                    </tr>
                    <tr className="border-t border-slate-300">
                      <td colSpan={4} className="px-4 py-3 text-right font-bold text-slate-700">Saldo Final:</td>
                      <td colSpan={2} className={`px-4 py-3 text-right font-bold text-lg ${saldoFinal >= 0 ? 'text-blue-700' : 'text-red-700'}`}>
                        R$ {fmtMoney(saldoFinal)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}

      {/* ── ABA: CONTAS A PAGAR ───────────────────────────────────────────── */}
      {aba === 'pagar' && (
        <>
          {/* Cards de resumo */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
              <p className="text-sm text-slate-500 font-medium">Total a Pagar</p>
              <p className="text-2xl font-bold text-slate-800 mt-1">R$ {fmtMoney(totalPagar)}</p>
              <p className="text-xs text-slate-400 mt-1">{contasPagar.length} lançamento(s)</p>
            </div>
            <div className="bg-red-50 border border-red-100 rounded-xl p-4">
              <p className="text-sm text-red-600 font-medium flex items-center gap-1">
                <AlertCircle className="w-4 h-4" /> Vencidos
              </p>
              <p className="text-2xl font-bold text-red-700 mt-1">R$ {fmtMoney(totalVencidoPag)}</p>
              <p className="text-xs text-red-400 mt-1">
                {contasPagar.filter(p => p.data < today()).length} lançamento(s)
              </p>
            </div>
            <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4">
              <p className="text-sm text-yellow-700 font-medium flex items-center gap-1">
                <Clock className="w-4 h-4" /> A Vencer
              </p>
              <p className="text-2xl font-bold text-yellow-700 mt-1">
                R$ {fmtMoney(totalPagar - totalVencidoPag)}
              </p>
              <p className="text-xs text-yellow-500 mt-1">
                {contasPagar.filter(p => p.data >= today()).length} lançamento(s)
              </p>
            </div>
          </div>

          <Card>
            <div className="p-4 border-b border-slate-100">
              <h3 className="font-semibold text-slate-700">
                Pagamento de Contas — {dateFrom ? fmtDate(dateFrom) : '...'} até {dateTo ? fmtDate(dateTo) : '...'}
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold">Vencimento</th>
                    <th className="px-4 py-3 text-left font-semibold">Descrição</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-center font-semibold">Status</th>
                    <th className="px-4 py-3 text-right font-semibold">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  {contasPagar.length > 0 ? (
                    contasPagar.map(p => {
                      const vencido = p.data && p.data < today();
                      return (
                        <tr key={p.id} className={`border-t hover:bg-slate-50 ${vencido ? 'bg-red-50/40' : ''}`}>
                          <td className={`px-4 py-3 ${vencido ? 'text-red-600 font-medium' : 'text-slate-600'}`}>
                            {fmtDate(p.data)}
                            {vencido && <span className="ml-1 text-xs text-red-500">(vencido)</span>}
                          </td>
                          <td className="px-4 py-3 text-slate-800 max-w-xs truncate" title={p.descricao}>
                            {p.descricao}
                          </td>
                          <td className="px-4 py-3 text-slate-600">{p.categoria || '—'}</td>
                          <td className="px-4 py-3 text-center">
                            <BadgeStatus status={p.status || 'Pendente'} />
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-red-700">
                            R$ {fmtMoney(p.valor)}
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-4 py-10 text-center text-slate-400">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-40" />
                        Nenhuma conta a pagar no período selecionado
                      </td>
                    </tr>
                  )}
                </tbody>
                {contasPagar.length > 0 && (
                  <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                    <tr>
                      <td colSpan={4} className="px-4 py-3 font-semibold text-slate-700 text-right">
                        Total a Pagar:
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-red-700 text-base">
                        R$ {fmtMoney(totalPagar)}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </Card>
        </>
      )}
      {/* Modal: Baixar recebimento direto do relatório */}
      {showBaixaModal && recSelecionado && (
        <Modal
          isOpen={showBaixaModal}
          onClose={() => setShowBaixaModal(false)}
          title="Confirmar Recebimento"
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowBaixaModal(false)}>Cancelar</Button>
              <Button icon={Banknote} onClick={handleBaixar}>Confirmar</Button>
            </>
          }
        >
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm">
              <p className="font-medium text-slate-800">{recSelecionado.cliente_nome || recSelecionado.venda?.cliente?.nome || '—'}</p>
              <p className="text-slate-500 mt-0.5">{recSelecionado.descricao}</p>
              <p className="text-2xl font-bold text-green-700 mt-1">R$ {fmtMoney(recSelecionado.valor)}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Recebimento</label>
              <select className="input" value={baixaForm.forma_recebimento}
                onChange={e => { const f = e.target.value; setBaixaForm(p => ({ ...p, forma_recebimento: f, conta_bancaria: formaParaConta(f) })); }}>
                {['Dinheiro','PIX','Cartão de Crédito','Cartão de Débito','Boleto','Cheque','Transferência'].map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária</label>
              <select className="input" value={baixaForm.conta_bancaria}
                onChange={e => setBaixaForm(p => ({ ...p, conta_bancaria: e.target.value }))}>
                <option value="SICOOB">SICOOB (Banco / PIX)</option>
                <option value="CAIXA">CAIXA (Dinheiro físico)</option>
                <option value="MAQUININHA">MAQUININHA (Cartão)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data do Recebimento</label>
              <input type="date" className="input" value={baixaForm.data_recebimento}
                onChange={e => setBaixaForm(p => ({ ...p, data_recebimento: e.target.value }))} />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (R$)</label>
              <input type="number" step="0.01" min="0" className="input" value={baixaForm.desconto}
                onChange={e => setBaixaForm(p => ({ ...p, desconto: e.target.value }))}
                placeholder="0,00 — deixe em branco se não houver" />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
};

export default Relatorios;
