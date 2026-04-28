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
import { ordemServicoService } from '@services/ordemServicoService';
import { recebimentoService } from '@services/recebimentoService';

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
    produtos: '',
    unidade: 'UN',
    quantidade: '1',
    valorUnitario: '',
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
      setFormData({
        clienteId: venda.cliente_id || venda.clienteId,
        data: venda.data,
        produtos: venda.produtos,
        unidade: venda.unidade || 'UN',
        quantidade: String(venda.quantidade || '1'),
        valorUnitario: String(venda.valor_unitario || venda.valor || ''),
        status: venda.status,
        formaPagamento: venda.forma_pagamento || venda.formaPagamento
      });
    } else {
      setEditingVenda(null);
      setFormData({
        clienteId: '',
        data: new Date().toISOString().split('T')[0],
        produtos: '',
        unidade: 'UN',
        quantidade: '1',
        valorUnitario: '',
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

  const handleSave = async () => {
    const valorUnitario = parseFloat(formData.valorUnitario) || 0;
    const quantidade = parseFloat(formData.quantidade) || 1;
    const valorFinal = valorUnitario * quantidade;

    if (!formData.clienteId || !formData.data || !formData.valorUnitario || !formData.produtos || !formData.formaPagamento) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    const vendaData = {
      data: formData.data,
      valor: valorFinal,
      valor_unitario: valorUnitario,
      quantidade,
      unidade: formData.unidade || 'UN',
      produtos: formData.produtos,
      status: formData.status,
      forma_pagamento: formData.formaPagamento,
      cliente_id: formData.clienteId
    };

    try {
      if (editingVenda) {
        await updateVenda(editingVenda.id, vendaData);
        toast.success('Venda atualizada com sucesso!');
      } else {
        const novaVenda = await addVenda(vendaData);
        const clienteNome = getClienteNome(vendaData.cliente_id);
        let os = null;
        try {
          os = await ordemServicoService.criarDeVenda(novaVenda);
        } catch { /* OS opcional */ }
        try {
          await recebimentoService.criarDeVenda(novaVenda, os, clienteNome);
        } catch { /* Recebimento opcional */ }
        toast.success('Venda cadastrada! OS e recebimento gerados automaticamente.');
      }
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar venda. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir esta venda?')) {
      try {
        await deleteVenda(id);
        toast.success('Venda excluída com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir venda.');
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const valorFinalCalculado = (
    (parseFloat(formData.valorUnitario) || 0) * (parseFloat(formData.quantidade) || 1)
  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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
                  {getClienteNome(venda.cliente_id || venda.clienteId)}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {venda.produtos}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {(venda.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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
            label="Descrição do Produto/Serviço *"
            value={formData.produtos}
            onChange={(e) => handleInputChange('produtos', e.target.value)}
            placeholder="Ex: Impressão gráfica, Panfletos A5..."
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
              <select
                value={formData.unidade}
                onChange={(e) => handleInputChange('unidade', e.target.value)}
                className="input"
              >
                <option value="UN">UN – Unidade</option>
                <option value="KG">KG – Quilograma</option>
                <option value="M2">M2 – Metro Quadrado</option>
                <option value="M">M – Metro</option>
                <option value="L">L – Litro</option>
                <option value="CX">CX – Caixa</option>
                <option value="PC">PC – Peça</option>
                <option value="SV">SV – Serviço</option>
              </select>
            </div>
            <Input
              label="Quantidade"
              type="number"
              step="0.001"
              min="0.001"
              value={formData.quantidade}
              onChange={(e) => handleInputChange('quantidade', e.target.value)}
              placeholder="1"
            />
            <Input
              label="Valor Unitário (R$) *"
              type="number"
              step="0.01"
              value={formData.valorUnitario}
              onChange={(e) => handleInputChange('valorUnitario', e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg px-4 py-3">
            <p className="text-xs text-slate-500 font-medium mb-0.5">VALOR FINAL</p>
            <p className="text-xl font-bold text-slate-800">R$ {valorFinalCalculado}</p>
          </div>

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
