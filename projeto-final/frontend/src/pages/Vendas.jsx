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

const FORM_VAZIO = {
  tipoCliente: 'cadastrado',
  clienteId: '',
  clienteNome: '',
  clienteTelefone: '',
  data: new Date().toISOString().split('T')[0],
  produtos: '',
  unidade: 'UN',
  quantidade: '1',
  valorUnitario: '',
  status: 'Pendente',
  formaPagamento: '',
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
      setFormData({
        tipoCliente: isCadastrado ? 'cadastrado' : 'avulso',
        clienteId: venda.cliente_id || '',
        clienteNome: venda.cliente_nome || '',
        clienteTelefone: venda.cliente_telefone || '',
        data: venda.data,
        produtos: venda.produtos,
        unidade: venda.unidade || 'UN',
        quantidade: String(venda.quantidade || '1'),
        valorUnitario: String(venda.valor_unitario || venda.valor || ''),
        status: venda.status,
        formaPagamento: venda.forma_pagamento || venda.formaPagamento || '',
      });
    } else {
      setEditingVenda(null);
      setFormData(FORM_VAZIO);
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

    // Validação do cliente conforme tipo
    if (formData.tipoCliente === 'cadastrado' && !formData.clienteId) {
      toast.error('Selecione um cliente cadastrado!');
      return;
    }
    if (formData.tipoCliente === 'avulso' && !formData.clienteNome.trim()) {
      toast.error('Informe o nome do cliente!');
      return;
    }

    if (!formData.data || !formData.valorUnitario || !formData.produtos || !formData.formaPagamento) {
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
      // Cliente cadastrado
      cliente_id: formData.tipoCliente === 'cadastrado' ? formData.clienteId : null,
      // Cliente avulso (ou null se cadastrado)
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

  const valorFinalCalculado = (
    (parseFloat(formData.valorUnitario) || 0) * (parseFloat(formData.quantidade) || 1)
  ).toLocaleString('pt-BR', { minimumFractionDigits: 2 });

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

          <Input
            label="Descrição do Produto/Serviço *"
            value={formData.produtos}
            onChange={(e) => set('produtos', e.target.value)}
            placeholder="Ex: Impressão gráfica, Panfletos A5..."
          />

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Unidade</label>
              <select
                value={formData.unidade}
                onChange={(e) => set('unidade', e.target.value)}
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
              onChange={(e) => set('quantidade', e.target.value)}
              placeholder="1"
            />
            <Input
              label="Valor Unitário (R$) *"
              type="number"
              step="0.01"
              value={formData.valorUnitario}
              onChange={(e) => set('valorUnitario', e.target.value)}
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
