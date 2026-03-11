import React, { useEffect } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useRecebimentoStore from '@store/recebimentoStore';
import usePagamentoStore from '@store/pagamentoStore';
import useClienteStore from '@store/clienteStore';
import Card from '@components/common/Card';

const Dashboard = () => {
  const { vendas, getTotalVendas, fetchVendas } = useVendaStore();
  const { getTotalEntradas, fetchRecebimentos } = useRecebimentoStore();
  const { getTotalPagamentos, fetchPagamentos, pagamentos } = usePagamentoStore();
  const { clientes, fetchClientes } = useClienteStore();
  
  useEffect(() => {
    fetchVendas();
    fetchRecebimentos();
    fetchPagamentos();
    fetchClientes();
  }, []);
  
  const totalVendas = getTotalVendas();
  const totalRecebimentos = getTotalEntradas();
  const totalPagamentos = getTotalPagamentos();
  const saldoAtual = totalRecebimentos - totalPagamentos;
  const pagamentosPendentes = pagamentos.filter(p => p.status === 'pendente');
  
  const vendasRecentes = vendas.slice(0, 5);
  
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Total Vendas</span>
            <ShoppingCart className="w-5 h-5 text-blue-500" />
          </div>
          <div className="text-2xl font-bold text-slate-800">
            R$ {totalVendas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">{vendas.length} vendas</div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Recebimentos</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            R$ {totalRecebimentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Entradas</div>
        </Card>
        
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Pagamentos</span>
            <TrendingDown className="w-5 h-5 text-red-500" />
          </div>
          <div className="text-2xl font-bold text-red-600">
            R$ {totalPagamentos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">Saídas</div>
        </Card>
        
        <Card className="p-6 bg-gradient-to-br from-blue-500 to-blue-600 text-white border-0">
          <div className="flex items-center justify-between mb-2">
            <span className="text-blue-100 text-sm font-medium">Saldo Atual</span>
            <DollarSign className="w-5 h-5 text-blue-200" />
          </div>
          <div className="text-2xl font-bold">
            R$ {saldoAtual.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-blue-100 mt-1">Disponível</div>
        </Card>
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Vendas Recentes">
          <div className="p-6">
            <div className="space-y-3">
              {vendasRecentes.map(venda => {
                const cliente = clientes.find(c => c.id === venda.clienteId);
                return (
                  <div key={venda.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-800">{cliente?.nome}</div>
                      <div className="text-sm text-slate-500">
                        {new Date(venda.data).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-slate-800">
                        R$ {venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        venda.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {venda.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
        
        <Card title="Pagamentos Pendentes">
          <div className="p-6">
            <div className="space-y-3">
              {pagamentosPendentes.length > 0 ? (
                pagamentosPendentes.map(pagamento => (
                  <div key={pagamento.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div>
                      <div className="font-medium text-slate-800">{pagamento.descricao}</div>
                      <div className="text-sm text-slate-500">
                        {new Date(pagamento.data).toLocaleDateString('pt-BR')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-red-600">
                        R$ {pagamento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </div>
                      <span className="text-xs px-2 py-1 rounded-full bg-red-100 text-red-700">
                        {pagamento.status}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center text-slate-500 py-8">
                  Nenhum pagamento pendente
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
