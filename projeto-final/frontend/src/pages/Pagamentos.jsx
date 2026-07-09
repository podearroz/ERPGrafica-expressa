import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, Search, CheckCircle } from 'lucide-react';
import usePagamentoStore from '@store/pagamentoStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import Pagination from '@components/common/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const Pagamentos = () => {
  const { pagamentos, addPagamento, updatePagamento, deletePagamento, fetchPagamentos, loading } = usePagamentoStore();
  
  useEffect(() => {
    fetchPagamentos();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [showBaixarModal, setShowBaixarModal] = useState(false);
  const [editingPagamento, setEditingPagamento] = useState(null);
  const [baixandoPagamento, setBaixandoPagamento] = useState(null);
  const [baixarForm, setBaixarForm] = useState({ data_pagamento: new Date().toISOString().split('T')[0], conta_bancaria: 'SICOOB' });
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    tipo: 'saida',
    descricao: '',
    categoria: '',
    status: 'Pendente',
    conta_bancaria: 'SICOOB',
  });

  const headers = [
    { label: 'Data' },
    { label: 'Descrição' },
    { label: 'Categoria' },
    { label: 'Conta' },
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
        status: 'Pendente',
        conta_bancaria: 'SICOOB',
      });
    }
    setShowModal(true);
  };

  const abrirBaixar = (pag) => {
    setBaixandoPagamento(pag);
    setBaixarForm({ data_pagamento: new Date().toISOString().split('T')[0], conta_bancaria: pag.conta_bancaria || 'SICOOB' });
    setShowBaixarModal(true);
  };

  const handleBaixar = async () => {
    try {
      await updatePagamento(baixandoPagamento.id, {
        status: 'Pago',
        data_pagamento: baixarForm.data_pagamento,
        conta_bancaria: baixarForm.conta_bancaria,
      });
      toast.success('Pagamento baixado com sucesso!');
      setShowBaixarModal(false);
    } catch { toast.error('Erro ao baixar pagamento.'); }
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

  const resetPage = () => setCurrentPage(1);
  const handleSearch = (v) => { setSearchTerm(v); resetPage(); };

  const filteredPagamentos = pagamentos.filter(p => {
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      if (!(p.descricao || '').toLowerCase().includes(q) && !(p.categoria || '').toLowerCase().includes(q)) return false;
    }
    if (dateFrom && p.data < dateFrom) return false;
    if (dateTo && p.data > dateTo) return false;
    if (cpfFilter) {
      const q = cpfFilter.replace(/\D/g, '');
      if (!(p.descricao || '').replace(/\D/g, '').includes(q) && !(p.descricao || '').toLowerCase().includes(cpfFilter.toLowerCase())) return false;
    }
    return true;
  });
  const pagedPagamentos = filteredPagamentos.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div>
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Pagamentos</h2>
            <Button icon={Plus} variant="danger" onClick={() => openModal()}>
              Novo Pagamento
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
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
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
              className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Data inicial"
            />
            <span className="text-slate-400 text-sm">até</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
              className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              title="Data final"
            />
            <input
              type="text"
              placeholder="CPF/CNPJ na descrição"
              value={cpfFilter}
              onChange={(e) => { setCpfFilter(e.target.value); resetPage(); }}
              className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
            />
            {(searchTerm || dateFrom || dateTo || cpfFilter) && (
              <button
                onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setCpfFilter(''); resetPage(); }}
                className="text-sm text-slate-500 hover:text-slate-700 underline"
              >
                Limpar filtros
              </button>
            )}
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
                    pagamento.conta_bancaria === 'CAIXA' ? 'bg-green-100 text-green-700' :
                    pagamento.conta_bancaria === 'MAQUININHA' ? 'bg-purple-100 text-purple-700' :
                    'bg-blue-100 text-blue-700'
                  }`}>
                    {pagamento.conta_bancaria || 'SICOOB'}
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
                <td className="px-6 py-4 text-sm text-right space-x-1">
                  {pagamento.status !== 'Pago' && (
                    <button
                      onClick={() => abrirBaixar(pagamento)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                      title="Dar baixa (marcar como pago)"
                    >
                      <CheckCircle className="w-3 h-3" /> Baixar
                    </button>
                  )}
                  <button
                    onClick={() => openModal(pagamento)}
                    className="text-blue-600 hover:text-blue-700 ml-1"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(pagamento.id)}
                    className="text-red-600 hover:text-red-700 ml-1"
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
            <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária *</label>
            <select
              value={formData.conta_bancaria || 'SICOOB'}
              onChange={(e) => handleInputChange('conta_bancaria', e.target.value)}
              className="input"
            >
              <option value="SICOOB">SICOOB (Banco)</option>
              <option value="CAIXA">CAIXA (Dinheiro)</option>
              <option value="MAQUININHA">MAQUININHA (Cartão)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
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

      {/* Modal: Baixar Pagamento */}
      <Modal
        isOpen={showBaixarModal}
        onClose={() => setShowBaixarModal(false)}
        title="Dar Baixa no Pagamento"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowBaixarModal(false)}>Cancelar</Button>
            <Button icon={CheckCircle} onClick={handleBaixar} disabled={loading}>Confirmar Baixa</Button>
          </>
        }
      >
        {baixandoPagamento && (
          <div className="space-y-4">
            <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm">
              <p className="text-slate-600 font-medium">{baixandoPagamento.descricao}</p>
              <p className="text-2xl font-bold text-red-700 mt-1">
                R$ {parseFloat(baixandoPagamento.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária *</label>
              <select
                className="input"
                value={baixarForm.conta_bancaria}
                onChange={e => setBaixarForm(p => ({ ...p, conta_bancaria: e.target.value }))}
              >
                <option value="SICOOB">SICOOB (Banco)</option>
                <option value="CAIXA">CAIXA (Dinheiro)</option>
                <option value="MAQUININHA">MAQUININHA (Cartão)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Data do Pagamento *</label>
              <input
                type="date"
                className="input"
                value={baixarForm.data_pagamento}
                onChange={e => setBaixarForm(p => ({ ...p, data_pagamento: e.target.value }))}
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Pagamentos;
