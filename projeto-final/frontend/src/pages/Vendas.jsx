import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, CheckCircle } from 'lucide-react';
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

const ITEM_VAZIO = { descricao: '', unidade: 'UN', quantidade: '1.00', valorUnitario: '' };

const FORM_VAZIO = {
  tipoCliente: 'cadastrado',
  clienteId: '',
  clienteNome: '',
  clienteTelefone: '',
  data: new Date().toISOString().split('T')[0],
  status: 'Pendente',
  formaPagamento: '',
  itens: [{ ...ITEM_VAZIO }],
};

const formatarMoeda = (digits) => {
  if (!digits) return '';
  const padded = digits.padStart(3, '0');
  const int = parseInt(padded.slice(0, -2), 10);
  const dec = padded.slice(-2);
  return `${int}.${dec}`;
};

const Vendas = () => {
  const { vendas, addVenda, updateVenda, deleteVenda, fetchVendas, loading } = useVendaStore();
  const { clientes, fetchClientes } = useClienteStore();

  useEffect(() => {
    fetchVendas();
    fetchClientes();
  }, []);

  const [showModal, setShowModal] = useState(false);
  const [editingVenda, setEditingVenda] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);

  const headers = [
    { label: 'Data' },
    { label: 'Cliente' },
    { label: 'Produtos' },
    { label: 'Valor' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' },
  ];

  // Retorna o nome do cliente de uma venda (cadastrado ou avulso)
  const getClienteNome = (venda) => {
    if (venda.cliente?.nome) return venda.cliente.nome;
    if (venda.cliente_nome) return venda.cliente_nome;
    return '—';
  };

  const openModal = (venda = null) => {
    if (venda) {
      setEditingVenda(venda);
      const isCadastrado = !!venda.cliente_id;
      const itens = venda.itens || [{
        descricao: venda.produtos || '',
        unidade: venda.unidade || 'UN',
        quantidade: String(venda.quantidade || '1'),
        valorUnitario: String(venda.valor_unitario || venda.valor || ''),
      }];
      setFormData({
        tipoCliente: isCadastrado ? 'cadastrado' : 'avulso',
        clienteId: venda.cliente_id || '',
        clienteNome: venda.cliente_nome || '',
        clienteTelefone: venda.cliente_telefone || '',
        data: venda.data,
        status: venda.status,
        formaPagamento: venda.forma_pagamento || venda.formaPagamento || '',
        itens,
      });
    } else {
      setEditingVenda(null);
      setFormData({ ...FORM_VAZIO, itens: [{ ...ITEM_VAZIO }] });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVenda(null);
  };

  const handleSave = async () => {
    const itensValidos = formData.itens.filter((i) => i.descricao.trim());

    if (formData.tipoCliente === 'cadastrado' && !formData.clienteId) {
      toast.error('Selecione um cliente cadastrado!');
      return;
    }
    if (formData.tipoCliente === 'avulso' && !formData.clienteNome.trim()) {
      toast.error('Informe o nome do cliente!');
      return;
    }
    if (!formData.data || !formData.formaPagamento) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }
    if (itensValidos.length === 0 || !itensValidos.some((i) => i.valorUnitario)) {
      toast.error('Adicione pelo menos um produto com valor!');
      return;
    }

    const valorFinal = itensValidos.reduce(
      (sum, i) => sum + (parseFloat(i.valorUnitario) || 0) * (parseFloat(i.quantidade) || 1),
      0
    );
    const primItem = itensValidos[0];

    const vendaData = {
      data: formData.data,
      valor: valorFinal,
      valor_unitario: parseFloat(primItem.valorUnitario) || 0,
      quantidade: parseFloat(primItem.quantidade) || 1,
      unidade: primItem.unidade || 'UN',
      produtos: itensValidos.map((i) => i.descricao).join(' | '),
      itens: itensValidos,
      status: formData.status,
      forma_pagamento: formData.formaPagamento,
      cliente_id: formData.tipoCliente === 'cadastrado' ? formData.clienteId : null,
      cliente_nome: formData.tipoCliente === 'avulso' ? formData.clienteNome.trim() : null,
      cliente_telefone: formData.tipoCliente === 'avulso' ? (formData.clienteTelefone.trim() || null) : null,
    };

    try {
      if (editingVenda) {
        await updateVenda(editingVenda.id, vendaData);
        try {
          await ordemServicoService.atualizarDeVenda(editingVenda.id, vendaData);
        } catch { /* OS sync opcional */ }
        toast.success('Venda atualizada com sucesso!');
      } else {
        const novaVenda = await addVenda(vendaData);

        // Nome do cliente para recebimento e OS
        const nomeDisplay =
          formData.tipoCliente === 'avulso'
            ? formData.clienteNome.trim()
            : clientes.find((c) => c.id === formData.clienteId)?.nome || '';

        let os = null;
        try {
          os = await ordemServicoService.criarDeVenda(novaVenda);
        } catch { /* OS opcional */ }
        try {
          await recebimentoService.criarDeVenda(novaVenda, os, nomeDisplay);
        } catch { /* Recebimento opcional */ }

        toast.success('Venda cadastrada! OS e recebimento gerados automaticamente.');
      }
      closeModal();
    } catch {
      toast.error('Erro ao salvar venda. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta venda?')) return;
    try {
      await deleteVenda(id);
      toast.success('Venda excluída com sucesso!');
    } catch {
      toast.error('Erro ao excluir venda.');
    }
  };

  const handleMarcarPago = async (venda) => {
    try {
      await updateVenda(venda.id, { status: 'Pago' });
      toast.success('Venda marcada como paga!');
    } catch {
      toast.error('Erro ao atualizar status.');
    }
  };

  const set = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const updateItem = (index, field, value) => {
    setFormData((prev) => {
      const itens = [...prev.itens];
      itens[index] = { ...itens[index], [field]: value };
      return { ...prev, itens };
    });
  };

  const addItem = () =>
    setFormData((prev) => ({ ...prev, itens: [...prev.itens, { ...ITEM_VAZIO }] }));

  const removeItem = (index) =>
    setFormData((prev) => ({ ...prev, itens: prev.itens.filter((_, i) => i !== index) }));

  const handleCurrencyChange = (e, index, field) => {
    const digits = e.target.value.replace(/\D/g, '');
    updateItem(index, field, formatarMoeda(digits));
  };

  const valorFinalCalculado = formData.itens
    .reduce((sum, i) => sum + (parseFloat(i.valorUnitario) || 0) * (parseFloat(i.quantidade) || 1), 0)
    .toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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
            vendas.map((venda) => (
              <tr key={venda.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(venda.data + 'T00:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {getClienteNome(venda)}
                  {venda.cliente_telefone && (
                    <span className="block text-xs text-slate-400">{venda.cliente_telefone}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">{venda.produtos}</td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {(venda.valor || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      venda.status === 'Pago'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                    }`}
                  >
                    {venda.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  {venda.status === 'Pendente' && (
                    <button
                      onClick={() => handleMarcarPago(venda)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                      title="Marcar como Pago"
                    >
                      <CheckCircle className="w-3 h-3" /> Pago
                    </button>
                  )}
                  <button
                    onClick={() => openModal(venda)}
                    className="text-blue-600 hover:text-blue-700"
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
            <Button icon={Save} onClick={handleSave} disabled={loading}>
              Salvar
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {/* Seção Cliente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Cliente *</label>

            {/* Toggle tipo de cliente */}
            <div className="flex rounded-lg border border-slate-200 overflow-hidden mb-3">
              <button
                type="button"
                onClick={() => set('tipoCliente', 'cadastrado')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  formData.tipoCliente === 'cadastrado'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cliente Cadastrado
              </button>
              <button
                type="button"
                onClick={() => set('tipoCliente', 'avulso')}
                className={`flex-1 px-3 py-2 text-sm font-medium transition-colors ${
                  formData.tipoCliente === 'avulso'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}
              >
                Cliente Avulso
              </button>
            </div>

            {formData.tipoCliente === 'cadastrado' ? (
              <select
                value={formData.clienteId}
                onChange={(e) => set('clienteId', e.target.value)}
                className="input"
              >
                <option value="">Selecione um cliente</option>
                {clientes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome_fantasia || c.nome}
                  </option>
                ))}
              </select>
            ) : (
              <div className="space-y-2">
                <Input
                  label="Nome do Cliente *"
                  value={formData.clienteNome}
                  onChange={(e) => set('clienteNome', e.target.value)}
                  placeholder="Ex: Luiz Silva"
                />
                <Input
                  label="Telefone"
                  value={formData.clienteTelefone}
                  onChange={(e) => set('clienteTelefone', e.target.value)}
                  placeholder="Ex: (69) 99999-0000"
                />
              </div>
            )}
          </div>

          <Input
            label="Data *"
            type="date"
            value={formData.data}
            onChange={(e) => set('data', e.target.value)}
          />

          {/* Lista de itens */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-slate-700">Produtos/Serviços *</label>

            {formData.itens.map((item, index) => (
              <div key={index} className="border border-slate-200 rounded-lg p-3 space-y-2 bg-slate-50">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                    Item {index + 1}
                  </span>
                  {formData.itens.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="text-red-400 hover:text-red-600"
                      title="Remover item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Descrição *</label>
                  <textarea
                    value={item.descricao}
                    onChange={(e) => updateItem(index, 'descricao', e.target.value)}
                    className="input resize-none"
                    rows={2}
                    placeholder="Ex: Impressão gráfica, Panfletos A5..."
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Unidade</label>
                    <select
                      value={item.unidade}
                      onChange={(e) => updateItem(index, 'unidade', e.target.value)}
                      className="input"
                    >
                      <option value="UN">UN</option>
                      <option value="KG">KG</option>
                      <option value="M2">M2</option>
                      <option value="M">M</option>
                      <option value="L">L</option>
                      <option value="CX">CX</option>
                      <option value="PC">PC</option>
                      <option value="SV">SV</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Qtd</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.quantidade}
                      onChange={(e) => handleCurrencyChange(e, index, 'quantidade')}
                      className="input"
                      placeholder="1.00"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Valor Unit. (R$) *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={item.valorUnitario}
                      onChange={(e) => handleCurrencyChange(e, index, 'valorUnitario')}
                      className="input"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                {item.valorUnitario && (
                  <p className="text-right text-xs text-slate-500">
                    Subtotal:{' '}
                    <span className="font-semibold text-slate-700">
                      R${' '}
                      {((parseFloat(item.valorUnitario) || 0) * (parseFloat(item.quantidade) || 1))
                        .toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </p>
                )}
              </div>
            ))}

            <button
              type="button"
              onClick={addItem}
              className="w-full py-2 border-2 border-dashed border-slate-300 rounded-lg text-sm text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Adicionar Produto
            </button>
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
              onChange={(e) => set('formaPagamento', e.target.value)}
              className="input"
            >
              <option value="">Selecione</option>
              <option value="Dinheiro">Dinheiro</option>
              <option value="PIX">PIX</option>
              <option value="Cartão Débito">Cartão Débito</option>
              <option value="Cartão Crédito">Cartão Crédito</option>
              <option value="Boleto">Boleto</option>
              <option value="À Vista na Entrega">À Vista na Entrega</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status *</label>
            <select
              value={formData.status}
              onChange={(e) => set('status', e.target.value)}
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
