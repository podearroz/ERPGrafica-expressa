import React, { useEffect } from 'react';
import { ShoppingCart, TrendingUp, TrendingDown, DollarSign, ClipboardList, Package, AlertTriangle } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useRecebimentoStore from '@store/recebimentoStore';
import usePagamentoStore from '@store/pagamentoStore';
import useClienteStore from '@store/clienteStore';
import useOrdemServicoStore from '@store/ordemServicoStore';
import useProdutoStore from '@store/produtoStore';
import Card from '@components/common/Card';

const Dashboard = () => {
  const { vendas, getTotalVendas, fetchVendas } = useVendaStore();
  const { getTotalRecebido, getTotalPendente, fetchRecebimentos } = useRecebimentoStore();
  const { getTotalPagamentos, fetchPagamentos, pagamentos } = usePagamentoStore();
  const { clientes, fetchClientes } = useClienteStore();
  const { fetchOrdensServico, getOSAbertas } = useOrdemServicoStore();
  const { fetchProdutos, getProdutosEstoqueBaixo } = useProdutoStore();

  useEffect(() => {
    fetchVendas();
    fetchRecebimentos();
    fetchPagamentos();
    fetchClientes();
    fetchOrdensServico();
    fetchProdutos();
  }, []);

  const totalVendas = getTotalVendas();
  const totalRecebido = getTotalRecebido();
  const totalPendente = getTotalPendente();
  const totalPagamentos = getTotalPagamentos();
  const saldoAtual = totalRecebido - totalPagamentos;
  const pagamentosPendentes = pagamentos.filter(p => p.status === 'pendente');
  const osAbertas = getOSAbertas();
  const produtosEstoqueBaixo = getProdutosEstoqueBaixo();

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
            <span className="text-slate-600 text-sm font-medium">Recebido</span>
            <TrendingUp className="w-5 h-5 text-green-500" />
          </div>
          <div className="text-2xl font-bold text-green-600">
            R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Pendente: R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
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
          <div className="text-xs text-blue-100 mt-1">Recebido − Pago</div>
        </Card>
      </div>

      {/* OS e Estoque */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Ordens de Serviço Abertas</span>
            <ClipboardList className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-3xl font-bold text-indigo-700">{osAbertas.length}</div>
          {osAbertas.length > 0 ? (
            <div className="text-xs text-slate-500 mt-1">
              Total: R$ {osAbertas.reduce((s, os) => s + parseFloat(os.valor_final || 0), 0)
                .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
          ) : (
            <div className="text-xs text-green-600 mt-1">Nenhuma OS pendente</div>
          )}
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-600 text-sm font-medium">Estoque Baixo / Zerado</span>
            {produtosEstoqueBaixo.length > 0
              ? <AlertTriangle className="w-5 h-5 text-yellow-500" />
              : <Package className="w-5 h-5 text-slate-400" />
            }
          </div>
          <div className={`text-3xl font-bold ${produtosEstoqueBaixo.length > 0 ? 'text-yellow-600' : 'text-slate-400'}`}>
            {produtosEstoqueBaixo.length}
          </div>
          <div className={`text-xs mt-1 ${produtosEstoqueBaixo.length > 0 ? 'text-yellow-600' : 'text-slate-500'}`}>
            {produtosEstoqueBaixo.length > 0
              ? `produto(s) abaixo do mínimo`
              : 'Todos os estoques OK'}
          </div>
        </Card>
      </div>
      
      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card title="Vendas Recentes">
          <div className="p-6">
            <div className="space-y-3">
              {vendasRecentes.map(venda => {
                const cliente = clientes.find(c => c.id === (venda.cliente_id || venda.clienteId));
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
