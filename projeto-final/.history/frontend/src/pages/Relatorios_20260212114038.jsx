import React, { useEffect } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useRecebimentoStore from '@store/recebimentoStore';
import usePagamentoStore from '@store/pagamentoStore';
import Card from '@components/common/Card';

const Relatorios = () => {
  const { getTotalVendas, vendas, fetchVendas } = useVendaStore();
  const { getTotalEntradas, getTotalSaidas, getRecebimentosByCategoria, fetchRecebimentos } = useRecebimentoStore();
  const { getTotalPagamentos, getPagamentosByCategoria, pagamentos, fetchPagamentos } = usePagamentoStore();

  useEffect(() => {
    fetchVendas();
    fetchRecebimentos();
    fetchPagamentos();
  }, []);

  const totalVendas = getTotalVendas();
  const totalRecebimentos = getTotalEntradas();
  const totalPagamentos = getTotalPagamentos();
  const saldoAtual = totalRecebimentos - totalPagamentos;
  const pagamentosPendentes = pagamentos.filter(p => p.status === 'Pendente');

  const recebimentosPorCategoria = getRecebimentosByCategoria();
  const pagamentosPorCategoria = getPagamentosByCategoria();

  return (
    <div className="space-y-6">
      {/* Cards de Resumo */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Relatório de Pagamentos */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-500" />
            Relatório de Pagamentos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Total em Pagamentos:</span>
              <span className="font-bold text-red-600">
                R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Pagamentos Pendentes:</span>
              <span className="font-semibold text-slate-800">
                {pagamentosPendentes.length}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Valor Pendente:</span>
              <span className="font-semibold text-yellow-600">
                R$ {pagamentosPendentes.reduce((sum, p) => sum + p.valor, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Por Categoria:</h4>
            <div className="space-y-2">
              {Object.entries(pagamentosPorCategoria).length > 0 ? (
                Object.entries(pagamentosPorCategoria).map(([categoria, valor]) => (
                  <div key={categoria} className="flex justify-between text-sm">
                    <span className="text-slate-600">{categoria}</span>
                    <span className="font-medium text-slate-800">
                      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 text-center py-2">
                  Nenhum pagamento registrado
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Relatório de Recebimentos */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-500" />
            Relatório de Recebimentos
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Total em Recebimentos:</span>
              <span className="font-bold text-green-600">
                R$ {totalRecebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Total de Vendas:</span>
              <span className="font-semibold text-slate-800">
                R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-slate-50 rounded-lg">
              <span className="text-slate-600">Vendas Pendentes:</span>
              <span className="font-semibold text-slate-800">
                {vendas.filter(v => v.status === 'Pendente').length}
              </span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-200">
            <h4 className="text-sm font-semibold text-slate-700 mb-2">Por Categoria:</h4>
            <div className="space-y-2">
              {Object.entries(recebimentosPorCategoria).length > 0 ? (
                Object.entries(recebimentosPorCategoria).map(([categoria, valor]) => (
                  <div key={categoria} className="flex justify-between text-sm">
                    <span className="text-slate-600">{categoria}</span>
                    <span className="font-medium text-slate-800">
                      R$ {valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-sm text-slate-500 text-center py-2">
                  Nenhum recebimento registrado
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Resumo Geral */}
      <Card className="bg-gradient-to-br from-slate-800 to-slate-900 text-white border-0">
        <div className="p-6">
          <h3 className="text-xl font-bold mb-6">Resumo Geral do Período</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm text-slate-300 mb-1">Receita Total</div>
              <div className="text-2xl font-bold">
                R$ {totalRecebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm text-slate-300 mb-1">Despesa Total</div>
              <div className="text-2xl font-bold">
                R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </div>
            </div>
            <div className="bg-white/10 rounded-lg p-4">
              <div className="text-sm text-slate-300 mb-1">Lucro Líquido</div>
              <div className="text-2xl font-bold">
                R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

      {/* Estatísticas Adicionais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="p-6">
          <h4 className="font-semibold text-slate-700 mb-3">Margem de Lucro</h4>
          <div className="text-3xl font-bold text-blue-600">
            {totalRecebimentos > 0 ? ((saldoAtual / totalRecebimentos) * 100).toFixed(1) : 0}%
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Sobre receita total
          </p>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold text-slate-700 mb-3">Ticket Médio</h4>
          <div className="text-3xl font-bold text-green-600">
            R$ {vendas.length > 0 ? (totalVendas / vendas.length).toLocaleString('pt-BR', { minimumFractionDigits: 2 }) : '0,00'}
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Por venda
          </p>
        </Card>

        <Card className="p-6">
          <h4 className="font-semibold text-slate-700 mb-3">Taxa de Conversão</h4>
          <div className="text-3xl font-bold text-purple-600">
            {vendas.length > 0 ? ((vendas.filter(v => v.status === 'Pago').length / vendas.length) * 100).toFixed(1) : 0}%
          </div>
          <p className="text-sm text-slate-500 mt-2">
            Vendas pagas
          </p>
        </Card>
      </div>
    </div>
  );
};

export default Relatorios;
