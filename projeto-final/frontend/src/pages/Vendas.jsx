import React, { useState, useEffect, useRef } from 'react';
import { Plus, Edit, Trash2, Save, CheckCircle, Search } from 'lucide-react';
import useVendaStore from '@store/vendaStore';
import useClienteStore from '@store/clienteStore';
import { clienteService } from '@services/clienteService';
import Card from '@components/common/Card';
import Pagination from '@components/common/Pagination';
const PAGE_SIZE = 10;
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

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingVenda, setEditingVenda] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);

  // Autocomplete de cliente cadastrado
  const [clienteSearch, setClienteSearch] = useState('');
  const [clienteSugestoes, setClienteSugestoes] = useState([]);
  const [showClienteDropdown, setShowClienteDropdown] = useState(false);
  const clienteSearchRef = useRef(null);

  // Busca debounced de clientes no autocomplete
  useEffect(() => {
    if (formData.tipoCliente !== 'cadastrado' || !clienteSearch.trim()) {
      setClienteSugestoes([]);
      setShowClienteDropdown(false);
      return;
    }
    const q = clienteSearch.toLowerCase();
    // Primeiro filtra do cache local
    const local = clientes.filter(c =>
      (c.nome_fantasia || '').toLowerCase().includes(q) ||
      (c.nome || '').toLowerCase().includes(q)
    ).slice(0, 8);
    if (local.length > 0) {
      setClienteSugestoes(local);
      setShowClienteDropdown(true);
      return;
    }
    // Se não achou localmente, busca no servidor
    const timer = setTimeout(() => {
      clienteService.search(clienteSearch).then(data => {
        setClienteSugestoes((data || []).slice(0, 8));
        setShowClienteDropdown(true);
      }).catch(() => {});
    }, 350);
    return () => clearTimeout(timer);
  }, [clienteSearch, clientes, formData.tipoCliente]);

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
      if (isCadastrado) {
        const c = clientes.find(x => x.id === venda.cliente_id);
        setClienteSearch(c ? (c.nome_fantasia || c.nome) : (venda.cliente?.nome || ''));
      } else {
        setClienteSearch('');
      }
    } else {
      setEditingVenda(null);
      setFormData({ ...FORM_VAZIO, itens: [{ ...ITEM_VAZIO }] });
      setClienteSearch('');
    }
    setClienteSugestoes([]);
    setShowClienteDropdown(false);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVenda(null);
    setClienteSearch('');
    setClienteSugestoes([]);
    setShowClienteDropdown(false);
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

  const handleTipoClienteChange = (tipo) => {
    set('tipoCliente', tipo);
    if (tipo !== 'cadastrado') {
      set('clienteId', '');
      setClienteSearch('');
      setClienteSugestoes([]);
      setShowClienteDropdown(false);
    }
  };

  const selecionarCliente = (c) => {
    set('clienteId', c.id);
    setClienteSearch(c.nome_fantasia || c.nome);
    setClienteSugestoes([]);
    setShowClienteDropdown(false);
  };

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

  const filteredVendas = vendas.filter(v => {
    if (!searchTerm) return true;
    const q = searchTerm.toLowerCase();
    const numeroOS = (v.ordens_servico?.[0]?.numero_os || '').toLowerCase();
    return getClienteNome(v).toLowerCase().includes(q) || (v.produtos || '').toLowerCase().includes(q) || numeroOS.includes(q);
  });
  const pagedVendas = filteredVendas.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const handleSearch = (val) => { setSearchTerm(val); setCurrentPage(1); };

  return (
    <div>
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Vendas</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Buscar cliente ou produto..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-52"
                />
              </div>
              <Button icon={Plus} onClick={() => openModal()}>
                Nova Venda
              </Button>
            </div>
          </div>
        </div>

        <Table headers={headers}>
          {pagedVendas.length > 0 ? (
            pagedVendas.map((venda) => (
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
        <Pagination
          currentPage={currentPage}
          totalItems={filteredVendas.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
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
                onClick={() => handleTipoClienteChange('cadastrado')}
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
                onClick={() => handleTipoClienteChange('avulso')}
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
              <div className="relative">
                <input
                  ref={clienteSearchRef}
                  type="text"
                  className="input pr-8"
                  placeholder="Digite o nome do cliente..."
                  value={clienteSearch}
                  onChange={(e) => {
                    setClienteSearch(e.target.value);
                    if (formData.clienteId) set('clienteId', '');
                  }}
                  onFocus={() => { if (clienteSugestoes.length > 0) setShowClienteDropdown(true); }}
                  onBlur={() => setTimeout(() => setShowClienteDropdown(false), 150)}
                  autoComplete="off"
                />
                {formData.clienteId && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-sm font-bold">✓</span>
                )}
                {showClienteDropdown && clienteSugestoes.length > 0 && (
                  <div className="absolute z-50 top-full left-0 right-0 bg-white border border-slate-200 rounded-lg shadow-lg max-h-52 overflow-y-auto mt-1">
                    {clienteSugestoes.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
                        onMouseDown={() => selecionarCliente(c)}
                      >
                        <span className="font-medium text-slate-800">{c.nome_fantasia || c.nome}</span>
                        {c.nome_fantasia && (
                          <span className="text-slate-400 text-xs ml-2 block">{c.nome}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
                {!formData.clienteId && clienteSearch.trim() && (
                  <p className="text-xs text-amber-600 mt-1">Selecione um cliente da lista para confirmar</p>
                )}
              </div>
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
              <option value="10 dias">10 dias</option>
              <option value="15 dias">15 dias</option>
              <option value="30 dias">30 dias</option>
              <option value="10x">10x</option>
              <option value="11x">11x</option>
              <option value="Entrada e 30">Entrada e 30</option>
              <option value="Entrada 15 e 30">Entrada 15 e 30</option>
              <option value="Entrada 15, 30 e 60">Entrada 15, 30 e 60</option>
              <option value="Entrada 30 e 60">Entrada 30 e 60</option>
              <option value="Entrada 30, 60, 90 e 120">Entrada 30, 60, 90 e 120</option>
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
