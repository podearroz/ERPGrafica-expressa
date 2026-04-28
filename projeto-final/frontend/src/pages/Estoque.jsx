import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Package, AlertTriangle, ArrowUpDown, History } from 'lucide-react';
import useProdutoStore from '@store/produtoStore';
import useEstoqueStore from '@store/estoqueStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';

const UNIDADES = ['UN', 'KG', 'MT', 'LT', 'CX', 'PC', 'M²', 'M³'];
const TIPOS_MOVIMENTACAO = [
  { value: 'ENTRADA', label: 'Entrada (Compra)' },
  { value: 'SAIDA', label: 'Saída Manual' },
  { value: 'AJUSTE', label: 'Ajuste de Inventário' },
  { value: 'DEVOLUCAO', label: 'Devolução' },
];

const FORM_INICIAL = {
  codigo: '',
  nome: '',
  descricao: '',
  categoria: '',
  unidade_medida: 'UN',
  preco_custo: '',
  preco_venda: '',
  estoque_atual: '0',
  estoque_minimo: '0',
  estoque_maximo: '',
  ativo: true,
};

const StatusEstoque = ({ produto }) => {
  if (produto.estoque_atual <= 0) {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">Sem Estoque</span>;
  }
  if (produto.estoque_atual <= produto.estoque_minimo) {
    return <span className="px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700">Estoque Baixo</span>;
  }
  return <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">Normal</span>;
};

const Estoque = () => {
  const { produtos, loading, fetchProdutos, addProduto, updateProduto, deleteProduto, getProdutosEstoqueBaixo } = useProdutoStore();
  const { registrarMovimentacao, fetchMovimentacoesByProduto, movimentacoes } = useEstoqueStore();

  const [showProdutoModal, setShowProdutoModal] = useState(false);
  const [showMovModal, setShowMovModal] = useState(false);
  const [showHistoricoModal, setShowHistoricoModal] = useState(false);
  const [editingProduto, setEditingProduto] = useState(null);
  const [produtoSelecionado, setProdutoSelecionado] = useState(null);
  const [abaAtiva, setAbaAtiva] = useState('todos');
  const [formData, setFormData] = useState(FORM_INICIAL);
  const [movForm, setMovForm] = useState({ tipo: 'ENTRADA', quantidade: '', motivo: '', observacao: '' });

  useEffect(() => { fetchProdutos(); }, []);

  const produtosExibidos = abaAtiva === 'baixo' ? getProdutosEstoqueBaixo() : produtos;
  const alertasEstoqueBaixo = getProdutosEstoqueBaixo().length;

  const abrirProdutoModal = (produto = null) => {
    if (produto) {
      setEditingProduto(produto);
      setFormData({
        codigo: produto.codigo,
        nome: produto.nome,
        descricao: produto.descricao || '',
        categoria: produto.categoria || '',
        unidade_medida: produto.unidade_medida,
        preco_custo: produto.preco_custo,
        preco_venda: produto.preco_venda,
        estoque_atual: produto.estoque_atual,
        estoque_minimo: produto.estoque_minimo,
        estoque_maximo: produto.estoque_maximo || '',
        ativo: produto.ativo,
      });
    } else {
      setEditingProduto(null);
      setFormData(FORM_INICIAL);
    }
    setShowProdutoModal(true);
  };

  const abrirMovModal = (produto) => {
    setProdutoSelecionado(produto);
    setMovForm({ tipo: 'ENTRADA', quantidade: '', motivo: '', observacao: '' });
    setShowMovModal(true);
  };

  const abrirHistorico = async (produto) => {
    setProdutoSelecionado(produto);
    await fetchMovimentacoesByProduto(produto.id);
    setShowHistoricoModal(true);
  };

  const handleSaveProduto = async () => {
    if (!formData.codigo || !formData.nome || !formData.preco_venda) {
      toast.error('Preencha os campos obrigatórios: Código, Nome e Preço de Venda.');
      return;
    }
    const payload = {
      ...formData,
      preco_custo: parseFloat(formData.preco_custo) || 0,
      preco_venda: parseFloat(formData.preco_venda) || 0,
      estoque_atual: parseInt(formData.estoque_atual) || 0,
      estoque_minimo: parseInt(formData.estoque_minimo) || 0,
      estoque_maximo: formData.estoque_maximo ? parseInt(formData.estoque_maximo) : null,
    };
    try {
      if (editingProduto) {
        await updateProduto(editingProduto.id, payload);
        toast.success('Produto atualizado!');
      } else {
        await addProduto(payload);
        toast.success('Produto cadastrado!');
      }
      setShowProdutoModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao salvar produto.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir este produto?')) return;
    try {
      await deleteProduto(id);
      toast.success('Produto excluído!');
    } catch (error) {
      toast.error('Erro ao excluir produto.');
    }
  };

  const handleMovimentacao = async () => {
    if (!movForm.quantidade || parseInt(movForm.quantidade) <= 0) {
      toast.error('Informe uma quantidade válida.');
      return;
    }
    if (!movForm.motivo) {
      toast.error('Informe o motivo da movimentação.');
      return;
    }
    try {
      await registrarMovimentacao({
        produto_id: produtoSelecionado.id,
        tipo: movForm.tipo,
        quantidade: parseInt(movForm.quantidade),
        motivo: movForm.motivo,
        observacao: movForm.observacao,
      });
      await fetchProdutos();
      toast.success('Movimentação registrada!');
      setShowMovModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao registrar movimentação.');
    }
  };

  const headersProdutos = [
    { label: 'Código' },
    { label: 'Nome' },
    { label: 'Categoria' },
    { label: 'Un.' },
    { label: 'Estoque' },
    { label: 'Mín.' },
    { label: 'Preço Venda' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' },
  ];

  const headersHistorico = [
    { label: 'Data' },
    { label: 'Tipo' },
    { label: 'Qtd' },
    { label: 'Antes' },
    { label: 'Depois' },
    { label: 'Motivo' },
  ];

  const corTipoMov = {
    ENTRADA: 'bg-green-100 text-green-700',
    SAIDA: 'bg-red-100 text-red-700',
    AJUSTE: 'bg-blue-100 text-blue-700',
    VENDA: 'bg-purple-100 text-purple-700',
    DEVOLUCAO: 'bg-yellow-100 text-yellow-700',
  };

  return (
    <div className="space-y-4">
      {/* Alerta de estoque baixo */}
      {alertasEstoqueBaixo > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
          <p className="text-yellow-800 text-sm font-medium">
            {alertasEstoqueBaixo} produto(s) com estoque baixo ou zerado.{' '}
            <button onClick={() => setAbaAtiva('baixo')} className="underline">Ver produtos</button>
          </p>
        </div>
      )}

      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Estoque</h2>
              <div className="flex gap-3 mt-2">
                <button
                  onClick={() => setAbaAtiva('todos')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors ${abaAtiva === 'todos' ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Todos ({produtos.length})
                </button>
                <button
                  onClick={() => setAbaAtiva('baixo')}
                  className={`text-sm font-medium pb-1 border-b-2 transition-colors flex items-center gap-1 ${abaAtiva === 'baixo' ? 'border-yellow-500 text-yellow-600' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
                >
                  Estoque Baixo
                  {alertasEstoqueBaixo > 0 && (
                    <span className="bg-yellow-100 text-yellow-700 text-xs px-1.5 py-0.5 rounded-full">{alertasEstoqueBaixo}</span>
                  )}
                </button>
              </div>
            </div>
            <Button icon={Plus} onClick={() => abrirProdutoModal()}>
              Novo Produto
            </Button>
          </div>
        </div>

        <Table headers={headersProdutos}>
          {produtosExibidos.length > 0 ? (
            produtosExibidos.map((produto) => (
              <tr key={produto.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-mono text-slate-600">{produto.codigo}</td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">{produto.nome}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{produto.categoria || '-'}</td>
                <td className="px-6 py-4 text-sm text-slate-600">{produto.unidade_medida}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">{produto.estoque_atual}</td>
                <td className="px-6 py-4 text-sm text-slate-500">{produto.estoque_minimo}</td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  R$ {parseFloat(produto.preco_venda).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <StatusEstoque produto={produto} />
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button onClick={() => abrirHistorico(produto)} className="text-slate-500 hover:text-slate-700 mr-2" title="Histórico">
                    <History className="w-4 h-4" />
                  </button>
                  <button onClick={() => abrirMovModal(produto)} className="text-green-600 hover:text-green-700 mr-2" title="Movimentar Estoque">
                    <ArrowUpDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => abrirProdutoModal(produto)} className="text-blue-600 hover:text-blue-700 mr-2" title="Editar">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(produto.id)} className="text-red-600 hover:text-red-700" title="Excluir">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={9} className="px-6 py-12 text-center text-slate-500">
                <Package className="w-8 h-8 mx-auto mb-2 opacity-40" />
                {abaAtiva === 'baixo' ? 'Nenhum produto com estoque baixo' : 'Nenhum produto cadastrado'}
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal: Produto */}
      <Modal
        isOpen={showProdutoModal}
        onClose={() => setShowProdutoModal(false)}
        title={editingProduto ? 'Editar Produto' : 'Novo Produto'}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowProdutoModal(false)}>Cancelar</Button>
            <Button icon={Save} onClick={handleSaveProduto} disabled={loading}>Salvar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Código *" value={formData.codigo} onChange={(e) => setFormData(p => ({ ...p, codigo: e.target.value }))} placeholder="Ex: PROD001" />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade *</label>
              <select className="input" value={formData.unidade_medida} onChange={(e) => setFormData(p => ({ ...p, unidade_medida: e.target.value }))}>
                {UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
          </div>

          <Input label="Nome *" value={formData.nome} onChange={(e) => setFormData(p => ({ ...p, nome: e.target.value }))} placeholder="Nome do produto" />
          <Input label="Categoria" value={formData.categoria} onChange={(e) => setFormData(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Impressão, Material, Serviço" />
          <Input label="Descrição" value={formData.descricao} onChange={(e) => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="Descrição opcional" />

          <div className="grid grid-cols-2 gap-4">
            <Input label="Preço de Custo (R$)" type="number" step="0.01" value={formData.preco_custo} onChange={(e) => setFormData(p => ({ ...p, preco_custo: e.target.value }))} placeholder="0.00" />
            <Input label="Preço de Venda (R$) *" type="number" step="0.01" value={formData.preco_venda} onChange={(e) => setFormData(p => ({ ...p, preco_venda: e.target.value }))} placeholder="0.00" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <Input label="Estoque Atual" type="number" value={formData.estoque_atual} onChange={(e) => setFormData(p => ({ ...p, estoque_atual: e.target.value }))} />
            <Input label="Estoque Mínimo" type="number" value={formData.estoque_minimo} onChange={(e) => setFormData(p => ({ ...p, estoque_minimo: e.target.value }))} />
            <Input label="Estoque Máximo" type="number" value={formData.estoque_maximo} onChange={(e) => setFormData(p => ({ ...p, estoque_maximo: e.target.value }))} placeholder="Opcional" />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="ativo" checked={formData.ativo} onChange={(e) => setFormData(p => ({ ...p, ativo: e.target.checked }))} className="w-4 h-4 rounded border-slate-300" />
            <label htmlFor="ativo" className="text-sm font-medium text-slate-700">Produto ativo</label>
          </div>
        </div>
      </Modal>

      {/* Modal: Movimentação */}
      <Modal
        isOpen={showMovModal}
        onClose={() => setShowMovModal(false)}
        title={`Movimentar Estoque — ${produtoSelecionado?.nome}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowMovModal(false)}>Cancelar</Button>
            <Button icon={ArrowUpDown} onClick={handleMovimentacao} disabled={loading}>Registrar</Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            Estoque atual: <strong className="text-slate-800">{produtoSelecionado?.estoque_atual} {produtoSelecionado?.unidade_medida}</strong>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Tipo de Movimentação *</label>
            <select className="input" value={movForm.tipo} onChange={(e) => setMovForm(p => ({ ...p, tipo: e.target.value }))}>
              {TIPOS_MOVIMENTACAO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          <Input
            label={movForm.tipo === 'AJUSTE' ? 'Novo Estoque Total *' : 'Quantidade *'}
            type="number"
            value={movForm.quantidade}
            onChange={(e) => setMovForm(p => ({ ...p, quantidade: e.target.value }))}
            placeholder={movForm.tipo === 'AJUSTE' ? 'Valor final do estoque' : 'Quantidade movimentada'}
          />

          <Input label="Motivo *" value={movForm.motivo} onChange={(e) => setMovForm(p => ({ ...p, motivo: e.target.value }))} placeholder="Ex: Compra fornecedor, Perda, Inventário..." />
          <Input label="Observação" value={movForm.observacao} onChange={(e) => setMovForm(p => ({ ...p, observacao: e.target.value }))} placeholder="Observações adicionais" />
        </div>
      </Modal>

      {/* Modal: Histórico */}
      <Modal
        isOpen={showHistoricoModal}
        onClose={() => setShowHistoricoModal(false)}
        title={`Histórico — ${produtoSelecionado?.nome}`}
      >
        <Table headers={headersHistorico}>
          {movimentacoes.length > 0 ? (
            movimentacoes.map((mov) => (
              <tr key={mov.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-sm text-slate-600">
                  {new Date(mov.created_at).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${corTipoMov[mov.tipo] || 'bg-slate-100 text-slate-600'}`}>
                    {mov.tipo}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{mov.quantidade}</td>
                <td className="px-4 py-3 text-sm text-slate-500">{mov.estoque_anterior}</td>
                <td className="px-4 py-3 text-sm text-slate-800">{mov.estoque_posterior}</td>
                <td className="px-4 py-3 text-sm text-slate-600">{mov.motivo || '-'}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-8 text-center text-slate-500">Nenhuma movimentação registrada</td>
            </tr>
          )}
        </Table>
      </Modal>
    </div>
  );
};

export default Estoque;
