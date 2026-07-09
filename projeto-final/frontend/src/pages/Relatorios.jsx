import React, { useEffect, useState, useMemo } from 'react';
import { TrendingUp, TrendingDown, BarChart2, AlertCircle, CheckCircle, Clock, Printer } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useRecebimentoStore from '@store/recebimentoStore';
import usePagamentoStore from '@store/pagamentoStore';
import Card from '@components/common/Card';

const fmtMoney = (v) =>
  parseFloat(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const fmtDate = (d) =>
  d ? new Date(d + 'T00:00:00').toLocaleDateString('pt-BR') : '—';

const today = () => new Date().toISOString().split('T')[0];

// ── Primeiro e último dia do mês atual
const primeiroDiaMes = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
};
const ultimoDiaMes = () => {
  const d = new Date();
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return last.toISOString().split('T')[0];
};

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
  const { recebimentos, getTotalEntradas, getTotalSaidas, getRecebimentosByCategoria, fetchRecebimentos } = useRecebimentoStore();
  const { getTotalPagamentos, getPagamentosByCategoria, pagamentos, fetchPagamentos } = usePagamentoStore();

  const [aba, setAba] = useState('resumo'); // 'resumo' | 'receber' | 'pagar'
  const [dateFrom, setDateFrom] = useState(primeiroDiaMes());
  const [dateTo, setDateTo] = useState(ultimoDiaMes());

  useEffect(() => {
    fetchVendas();
    fetchRecebimentos();
    fetchPagamentos();
  }, []);

  const totalVendas = getTotalVendas();
  const totalRecebimentos = getTotalEntradas();
  const totalPagamentos = getTotalPagamentos();
  const saldoAtual = totalRecebimentos - totalPagamentos;
  const recebimentosPorCategoria = getRecebimentosByCategoria();
  const pagamentosPorCategoria = getPagamentosByCategoria();

  // ── Contas a Receber filtradas pelo período ────────────────────────────────
  const contasReceber = useMemo(() => {
    return recebimentos
      .filter(r => r.tipo === 'entrada' || !r.tipo)
      .filter(r => r.status !== 'Recebido')
      .filter(r => {
        if (dateFrom && r.data < dateFrom) return false;
        if (dateTo && r.data > dateTo) return false;
        return true;
      })
      .sort((a, b) => (a.data || '').localeCompare(b.data || ''));
  }, [recebimentos, dateFrom, dateTo]);

  const totalReceber = contasReceber.reduce((s, r) => s + parseFloat(r.valor || 0), 0);
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

  const handlePrint = () => window.print();

  const abas = [
    { key: 'resumo', label: 'Resumo Geral' },
    { key: 'receber', label: `Contas a Receber (${contasReceber.length})` },
    { key: 'pagar', label: `Contas a Pagar (${contasPagar.length})` },
  ];

  return (
    <div className="space-y-4 print:space-y-3">
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
            <div className="flex items-center gap-2 print:hidden">
              <label className="text-sm text-slate-600">Período:</label>
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
                      <td colSpan={5} className="px-4 py-3 font-semibold text-slate-700 text-right">
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
                Contas a Pagar — {dateFrom ? fmtDate(dateFrom) : '...'} até {dateTo ? fmtDate(dateTo) : '...'}
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
    </div>
  );
};

export default Relatorios;
