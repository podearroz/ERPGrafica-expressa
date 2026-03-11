import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, X, Save } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useClienteStore from '@store/clienteStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';

const Vendas = () => {
  const { vendas, addVenda, updateVenda, deleteVenda, fetchVendas, loading } = useVendaStore();
  const { clientes, fetchClientes } = useClienteStore();
  
  useEffect(() => {
    fetchVendas();
    fetchClientes();
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [editingVenda, setEditingVenda] = useState(null);
  const [formData, setFormData] = useState({
    clienteId: '',
    data: new Date().toISOString().split('T')[0],
    valor: '',
    produtos: '',
    status: 'Pendente',
    formaPagamento: ''
  });

  const headers = [
    { label: 'Data' },
    { label: 'Cliente' },
    { label: 'Produtos' },
    { label: 'Valor' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' }
  ];

  const openModal = (venda = null) => {
    if (venda) {
      setEditingVenda(venda);
      setFormData(venda);
    } else {
      setEditingVenda(null);
      setFormData({
        clienteId: '',
        data: new Date().toISOString().split('T')[0],
        valor: '',
        produtos: '',
        status: 'Pendente',
        formaPagamento: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVenda(null);
  };

  const handleSave = () => {
    if (!formData.clienteId || !formData.data || !formData.valor || !formData.produtos || !formData.formaPagamento) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    const vendaData = {
      ...formData,
      valor: parseFloat(formData.valor),
      clienteId: parseInt(formData.clienteId)
    };

    if (editingVenda) {
      updateVenda(editingVenda.id, vendaData);
      toast.success('Venda atualizada com sucesso!');
    } else {
      addVenda(vendaData);
      toast.success('Venda cadastrada com sucesso!');
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (confirm('Tem certeza que deseja excluir esta venda?')) {
      deleteVenda(id);
      toast.success('Venda excluída com sucesso!');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const getClienteNome = (clienteId) => {
    const cliente = clientes.find(c => c.id === clienteId);
    return cliente ? cliente.nome : 'Cliente não encontrado';
  };

  return (
    <div>
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Vendas</h2>
            <Button icon={Plus} onClick={() => openModal()}>
              Nova Venda
            </Button>
          </div>
        </div>

        <Table headers={headers}>
          {vendas.length > 0 ? (
            vendas.map(venda => (
              <tr key={venda.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(venda.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {getClienteNome(venda.clienteId)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {venda.produtos}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {venda.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    venda.status === 'Pago' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                  }`}>
                    {venda.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openModal(venda)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(venda.id)}
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
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                Nenhuma venda cadastrada
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingVenda ? 'Editar Venda' : 'Nova Venda'}
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
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Cliente *
            </label>
            <select
              value={formData.clienteId}
              onChange={(e) => handleInputChange('clienteId', e.target.value)}
              className="input"
            >
              <option value="">Selecione um cliente</option>
              {clientes.map(c => (
                <option key={c.id} value={c.id}>{c.nome}</option>
              ))}
            </select>
          </div>

          <Input
            label="Data *"
            type="date"
            value={formData.data}
            onChange={(e) => handleInputChange('data', e.target.value)}
          />

          <Input
            label="Produtos *"
            value={formData.produtos}
            onChange={(e) => handleInputChange('produtos', e.target.value)}
            placeholder="Ex: Produto A, Produto B"
          />

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
              Forma de Pagamento *
            </label>
            <select
              value={formData.formaPagamento}
              onChange={(e) => handleInputChange('formaPagamento', e.target.value)}
              className="input"
            >
              <option value="">Selecione</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Boleto">Boleto</option>
            </select>
          </div>

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

export default Vendas;
