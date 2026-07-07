import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Search } from 'lucide-react';
import usePagamentoStore from '@store/pagamentoStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import Pagination from '@components/common/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 50;

const Pagamentos = () => {
  const { pagamentos, addPagamento, updatePagamento, deletePagamento, fetchPagamentos, loading } = usePagamentoStore();
  
  useEffect(() => {
    fetchPagamentos();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingPagamento, setEditingPagamento] = useState(null);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    tipo: 'saida',
    descricao: '',
    categoria: '',
    status: 'Pendente'
  });

  const headers = [
    { label: 'Data' },
    { label: 'Descrição' },
    { label: 'Categoria' },
    { label: 'Tipo' },
    { label: 'Valor' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' }
  ];

  const openModal = (pagamento = null) => {
    if (pagamento) {
      setEditingPagamento(pagamento);
      setFormData(pagamento);
    } else {
      setEditingPagamento(null);
      setFormData({
        data: new Date().toISOString().split('T')[0],
        valor: '',
        tipo: 'saida',
        descricao: '',
        categoria: '',
        status: 'Pendente'
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingPagamento(null);
  };

  const handleSave = async () => {
    if (!formData.data || !formData.valor || !formData.descricao || !formData.categoria) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    const pagamentoData = {
      ...formData,
      valor: parseFloat(formData.valor)
    };

    try {
      if (editingPagamento) {
        await updatePagamento(editingPagamento.id, pagamentoData);
        toast.success('Pagamento atualizado com sucesso!');
      } else {
        await addPagamento(pagamentoData);
        toast.success('Pagamento cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar pagamento. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este pagamento?')) {
      try {
        await deletePagamento(id);
        toast.success('Pagamento excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir pagamento.');
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const filteredPagamentos = pagamentos.filter(p => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    return (p.descricao || '').toLowerCase().includes(q) || (p.categoria || '').toLowerCase().includes(q);
  });
  const pagedPagamentos = filteredPagamentos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const handleSearch = (v) => { setSearchTerm(v); setCurrentPage(1); };

  return (
    <div>
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Pagamentos</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar descrição ou categoria..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                />
              </div>
              <Button icon={Plus} variant="danger" onClick={() => openModal()}>
                Novo Pagamento
              </Button>
            </div>
          </div>
        </div>

        <Table headers={headers}>
          {pagedPagamentos.length > 0 ? (
            pagedPagamentos.map(pagamento => (
              <tr key={pagamento.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(pagamento.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {pagamento.descricao}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {pagamento.categoria}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    pagamento.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {pagamento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  <span className={pagamento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                    {pagamento.tipo === 'entrada' ? '+' : '-'} R$ {pagamento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    pagamento.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {pagamento.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openModal(pagamento)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pagamento.id)}
                    className="text-red-600 hover:text-red-700"
                    title="Excluir"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                Nenhum pagamento cadastrado
              </td>
            </tr>
          )}
        </Table>
        <Pagination
          currentPage={currentPage}
          totalItems={filteredPagamentos.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingPagamento ? 'Editar Pagamento' : 'Novo Pagamento'}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancelar
            </Button>
            <Button icon={Save} onClick={handleSave}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label="Data *"
            type="date"
            value={formData.data}
            onChange={(e) => handleInputChange('data', e.target.value)}
          />

          <Input
            label="Descrição *"
            value={formData.descricao}
            onChange={(e) => handleInputChange('descricao', e.target.value)}
            placeholder="Ex: Fornecedor XYZ"
          />

          <Input
            label="Categoria *"
            value={formData.categoria}
            onChange={(e) => handleInputChange('categoria', e.target.value)}
            placeholder="Ex: Compra, Fornecedor, Despesa"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Tipo *
            </label>
            <select
              value={formData.tipo}
              onChange={(e) => handleInputChange('tipo', e.target.value)}
              className="input"
            >
              <option value="saida">Saída</option>
              <option value="entrada">Entrada</option>
            </select>
          </div>

          <Input
            label="Valor (R$) *"
            type="number"
            step="0.01"
            value={formData.valor}
            onChange={(e) => handleInputChange('valor', e.target.value)}
            placeholder="0.00"
          />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Status *
            </label>
            <select
              value={formData.status}
              onChange={(e) => handleInputChange('status', e.target.value)}
              className="input"
            >
              <option value="Pendente">Pendente</option>
              <option value="Pago">Pago</option>
            </select>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Pagamentos;
