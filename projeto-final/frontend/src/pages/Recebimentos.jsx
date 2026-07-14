import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, CheckCircle, CreditCard, XCircle, RotateCcw, Search, SplitSquareHorizontal } from 'lucide-react';
import useRecebimentoStore from '@store/recebimentoStore';
import useClienteStore from '@store/clienteStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import Pagination from '@components/common/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

// ─── Config ──────────────────────────────────────────────────────────────────
const FORMAS = ['Dinheiro', 'PIX', 'Cartão de Crédito', 'Cartão de Débito', 'Boleto', 'Cheque', 'Transferência'];

const formaParaConta = (forma) => {
  if (forma === 'Dinheiro') return 'CAIXA';
  if (forma === 'Cartão de Crédito' || forma === 'Cartão de Débito') return 'MAQUININHA';
  return 'SICOOB'; // PIX, Boleto, Transferência, Cheque
};

const STATUS_CFG = {
  'Recebido':  { label: 'Recebido',  className: 'bg-green-100 text-green-700' },
  'Parcelado': { label: 'Parcelado', className: 'bg-blue-100 text-blue-700' },
  'Não Pago':  { label: 'Não Pago',  className: 'bg-red-100 text-red-700' },
};

const BadgeStatus = ({ status }) => {
  const cfg = STATUS_CFG[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>{cfg.label}</span>;
};

const FORM_VAZIO = {
  data: new Date().toISOString().split('T')[0],
  valor: '', tipo: 'entrada', descricao: '', categoria: 'Venda', status: 'Não Pago',
  data_recebimento: '',
};

// ─── Página ───────────────────────────────────────────────────────────────────
const Recebimentos = () => {
  const {
    recebimentos, loading, fetchRecebimentos,
    addRecebimento, updateRecebimento, deleteRecebimento,
    marcarRecebido, marcarParcelado, marcarNaoPago, marcarParcialmentePago,
    getTotalRecebido, getTotalPendente,
  } = useRecebimentoStore();

  const { clientes } = useClienteStore();

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [cpfFilter, setCpfFilter] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showRecebidoModal, setShowRecebidoModal] = useState(false);
  const [showParceladoModal, setShowParceladoModal] = useState(false);
  const [editingRec, setEditingRec] = useState(null);
  const [recSelecionado, setRecSelecionado] = useState(null);
  const [formData, setFormData] = useState(FORM_VAZIO);

  // Recebido
  const [recebidoForm, setRecebidoForm] = useState({
    forma_recebimento: 'PIX',
    data_recebimento: new Date().toISOString().split('T')[0],
    observacao: '',
    conta_bancaria: 'SICOOB',
    desconto: '',
  });

  // Parcial
  const [showParcialModal, setShowParcialModal] = useState(false);
  const [parcialForm, setParcialForm] = useState({
    valor_pago: '',
    forma_recebimento: 'PIX',
    data_recebimento: new Date().toISOString().split('T')[0],
    conta_bancaria: 'SICOOB',
    observacao: '',
  });

  // Parcelado
  const [parceladoForm, setParceladoForm] = useState({
    parcelas: '2',
    forma_recebimento: 'Cartão de Crédito',
    data_primeira: new Date().toISOString().split('T')[0],
    observacao: '',
  });

  useEffect(() => { fetchRecebimentos(); }, []);

  const resetPage = () => setCurrentPage(1);
  const handleSearch = (v) => { setSearchTerm(v); resetPage(); };
  const handleFiltro = (v) => { setFiltroStatus(v); resetPage(); };

  // CPF lookup: pega nomes dos clientes que têm esse CPF/CNPJ
  const cpfNorm = cpfFilter.replace(/\D/g, '');
  const nomesPorCpf = cpfNorm
    ? clientes.filter(c => (c.cpf_cnpj || '').replace(/\D/g, '').includes(cpfNorm)).map(c => c.nome.toLowerCase())
    : null;

  // Filtro + ordenação
  const lista = (filtroStatus === 'TODOS' ? recebimentos : recebimentos.filter(r => r.status === filtroStatus))
    .filter(r => r.tipo === 'entrada' || !r.tipo)
    .filter(r => {
      if (searchTerm) {
        const q = searchTerm.toLowerCase();
        if (!(r.cliente_nome || r.venda?.cliente?.nome || '').toLowerCase().includes(q) &&
            !(r.descricao || '').toLowerCase().includes(q)) return false;
      }
      if (dateFrom && r.data < dateFrom) return false;
      if (dateTo && r.data > dateTo) return false;
      if (nomesPorCpf) {
        const nome = (r.cliente_nome || r.venda?.cliente?.nome || '').toLowerCase();
        if (!nomesPorCpf.some(n => nome.includes(n) || n.includes(nome))) return false;
      }
      return true;
    });

  const pagedLista = lista.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const contadores = {
    TODOS:      recebimentos.filter(r => r.tipo === 'entrada' || !r.tipo).length,
    'Não Pago': recebimentos.filter(r => r.status === 'Não Pago').length,
    'Parcelado':recebimentos.filter(r => r.status === 'Parcelado').length,
    'Recebido': recebimentos.filter(r => r.status === 'Recebido').length,
  };

  const totalRecebido = getTotalRecebido();
  const totalPendente = getTotalPendente();

  // ── Helpers de nome do cliente ──────────────────────────────────────────
  const nomeCliente = (rec) =>
    rec.cliente_nome || rec.venda?.cliente?.nome || '—';

  // ── Handlers Form ────────────────────────────────────────────────────────
  const abrirFormModal = (rec = null) => {
    if (rec) {
      setEditingRec(rec);
      setFormData({
        data: rec.data, valor: rec.valor, tipo: rec.tipo,
        descricao: rec.descricao, categoria: rec.categoria, status: rec.status,
        data_recebimento: rec.data_recebimento || '',
      });
    } else {
      setEditingRec(null);
      setFormData(FORM_VAZIO);
    }
    setShowFormModal(true);
  };

  const handleSave = async () => {
    if (!formData.data || !formData.valor || !formData.descricao || !formData.categoria) {
      toast.error('Preencha todos os campos obrigatórios!'); return;
    }
    try {
      const payload = {
        ...formData,
        valor: parseFloat(formData.valor),
        data_recebimento: formData.data_recebimento || null,
      };
      if (editingRec) {
        await updateRecebimento(editingRec.id, payload);
        toast.success('Recebimento atualizado!');
      } else {
        await addRecebimento(payload);
        toast.success('Recebimento cadastrado!');
      }
      setShowFormModal(false);
    } catch { toast.error('Erro ao salvar recebimento.'); }
  };

  const handleDelete = async (id) => {
    if (!confirm('Excluir este recebimento?')) return;
    try {
      await deleteRecebimento(id);
      toast.success('Recebimento excluído!');
    } catch { toast.error('Erro ao excluir.'); }
  };

  // ── Marcar Recebido ──────────────────────────────────────────────────────
  const abrirRecebido = (rec) => {
    setRecSelecionado(rec);
    const forma = rec.forma_recebimento || 'PIX';
    setRecebidoForm({
      forma_recebimento: forma,
      data_recebimento: new Date().toISOString().split('T')[0],
      observacao: '',
      conta_bancaria: formaParaConta(forma),
      desconto: '',
    });
    setShowRecebidoModal(true);
  };

  const handleMarcarRecebido = async () => {
    try {
      await marcarRecebido(recSelecionado.id, recebidoForm);
      toast.success('Recebimento confirmado!');
      setShowRecebidoModal(false);
    } catch (e) { toast.error(e.message); }
  };

  // ── Marcar Parcialmente Pago ─────────────────────────────────────────────
  const abrirParcial = (rec) => {
    setRecSelecionado(rec);
    setParcialForm({
      valor_pago: '',
      forma_recebimento: 'PIX',
      data_recebimento: new Date().toISOString().split('T')[0],
      conta_bancaria: 'SICOOB',
      observacao: '',
    });
    setShowParcialModal(true);
  };

  const handleMarcarParcial = async () => {
    const vPago = parseFloat(parcialForm.valor_pago);
    const vTotal = parseFloat(recSelecionado.valor);
    if (!vPago || vPago <= 0) { toast.error('Informe o valor recebido.'); return; }
    if (vPago >= vTotal) { toast.error(`O valor parcial deve ser menor que R$ ${vTotal.toFixed(2)}. Use "Recebido" para pagamento integral.`); return; }
    try {
      await marcarParcialmentePago(recSelecionado.id, parcialForm);
      toast.success(`Recebido R$ ${vPago.toFixed(2)}. Saldo restante de R$ ${(vTotal - vPago).toFixed(2)} lançado como pendente.`, { duration: 6000 });
      setShowParcialModal(false);
    } catch (e) { toast.error(e.message); }
  };

  // ── Marcar Parcelado ─────────────────────────────────────────────────────
  const abrirParcelado = (rec) => {
    setRecSelecionado(rec);
    setParceladoForm({
      parcelas: '2',
      forma_recebimento: 'Cartão de Crédito',
      data_primeira: new Date().toISOString().split('T')[0],
      observacao: '',
    });
    setShowParceladoModal(true);
  };

  const handleMarcarParcelado = async () => {
    const n = parseInt(parceladoForm.parcelas);
    if (!n || n < 2) { toast.error('Informe pelo menos 2 parcelas.'); return; }
    try {
      await marcarParcelado(recSelecionado.id, { ...parceladoForm, parcelas: n });
      toast.success(`Dividido em ${n}x parcelas!`);
      setShowParceladoModal(false);
    } catch (e) { toast.error(e.message); }
  };

  const handleMarcarNaoPago = async (id) => {
    try {
      await marcarNaoPago(id);
      toast.success('Marcado como Não Pago.');
    } catch (e) { toast.error(e.message); }
  };

  const valorParcela = () => {
    if (!recSelecionado || !parceladoForm.parcelas) return 0;
    return (parseFloat(recSelecionado.valor) / parseInt(parceladoForm.parcelas)).toFixed(2);
  };

  const headers = [
    { label: 'Data Venc.' },
    { label: 'Cliente' },
    { label: 'Descrição' },
    { label: 'Parcela' },
    { label: 'Valor' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' },
  ];

  const abas = [
    { key: 'TODOS',      label: 'Todos' },
    { key: 'Não Pago',   label: 'Não Pagos' },
    { key: 'Parcelado',  label: 'Parcelados' },
    { key: 'Recebido',   label: 'Recebidos' },
  ];

  return (
    <div className="space-y-4">
      {/* Cards de resumo */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-green-50 border border-green-100 rounded-xl p-4">
          <p className="text-sm text-green-600 font-medium">Total Recebido</p>
          <p className="text-2xl font-bold text-green-700 mt-1">
            R$ {totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-xl p-4">
          <p className="text-sm text-red-600 font-medium">Total Pendente</p>
          <p className="text-2xl font-bold text-red-700 mt-1">
            R$ {totalPendente.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div className="flex-1 mr-4">
              <h2 className="text-xl font-bold text-slate-800">Recebimentos</h2>
              <div className="flex gap-4 mt-2">
                {abas.map(aba => (
                  <button key={aba.key} onClick={() => handleFiltro(aba.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      filtroStatus === aba.key ? 'border-blue-500 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}>
                    {aba.label}
                    <span className="ml-1 text-xs opacity-70">({contadores[aba.key] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Cliente ou descrição..."
                  value={searchTerm}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="pl-9 pr-3 py-1.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-44"
                />
              </div>
              <input type="date" value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
                title="Vencimento — início"
                className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <span className="text-slate-400 text-sm">até</span>
              <input type="date" value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
                title="Vencimento — fim"
                className="py-1.5 px-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <input
                type="text"
                placeholder="CPF/CNPJ do cliente"
                value={cpfFilter}
                onChange={(e) => { setCpfFilter(e.target.value); resetPage(); }}
                className="py-1.5 px-3 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-40"
              />
              {(searchTerm || dateFrom || dateTo || cpfFilter) && (
                <button onClick={() => { setSearchTerm(''); setDateFrom(''); setDateTo(''); setCpfFilter(''); resetPage(); }}
                  className="text-xs text-slate-500 hover:text-red-500 underline">Limpar</button>
              )}
              <Button icon={Plus} onClick={() => abrirFormModal()}>Novo</Button>
            </div>
          </div>
        </div>

        <Table headers={headers}>
          {pagedLista.length > 0 ? pagedLista.map(rec => (
            <tr key={rec.id} className="hover:bg-slate-50">
              <td className="px-6 py-4 text-sm text-slate-600">
                {rec.data ? new Date(rec.data + 'T00:00:00').toLocaleDateString('pt-BR') : '—'}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-slate-800">{nomeCliente(rec)}</td>
              <td className="px-6 py-4 text-sm text-slate-600 max-w-xs truncate" title={rec.descricao}>
                {rec.descricao}
              </td>
              <td className="px-6 py-4 text-sm text-slate-500 text-center">
                {rec.parcelas > 1 ? `${rec.parcela_atual}/${rec.parcelas}` : '—'}
              </td>
              <td className="px-6 py-4 text-sm font-semibold text-green-700">
                R$ {parseFloat(rec.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </td>
              <td className="px-6 py-4 text-sm">
                <BadgeStatus status={rec.status || 'Não Pago'} />
                {rec.data_recebimento && rec.status === 'Recebido' && (
                  <p className="text-xs text-slate-400 mt-0.5">
                    em {new Date(rec.data_recebimento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    {rec.forma_recebimento ? ` · ${rec.forma_recebimento}` : ''}
                  </p>
                )}
              </td>
              <td className="px-6 py-4 text-sm text-right space-x-1">
                {rec.status !== 'Recebido' && (
                  <>
                    <button onClick={() => abrirRecebido(rec)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-green-50 text-green-700 hover:bg-green-100 font-medium"
                      title="Marcar como Recebido">
                      <CheckCircle className="w-3 h-3" /> Recebido
                    </button>
                    {rec.status !== 'Parcelado' && rec.parcelas <= 1 && (
                      <button onClick={() => abrirParcelado(rec)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-blue-50 text-blue-700 hover:bg-blue-100 font-medium"
                        title="Parcelar">
                        <CreditCard className="w-3 h-3" /> Parcelar
                      </button>
                    )}
                    <button onClick={() => abrirParcial(rec)}
                      className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-orange-50 text-orange-700 hover:bg-orange-100 font-medium"
                      title="Recebimento parcial">
                      <SplitSquareHorizontal className="w-3 h-3" /> Parcial
                    </button>
                  </>
                )}
                {rec.status === 'Recebido' && (
                  <button onClick={() => handleMarcarNaoPago(rec.id)}
                    className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded bg-slate-100 text-slate-600 hover:bg-slate-200 font-medium"
                    title="Desfazer recebimento">
                    <RotateCcw className="w-3 h-3" /> Desfazer
                  </button>
                )}
                <button onClick={() => abrirFormModal(rec)} className="text-blue-500 hover:text-blue-700 ml-1" title="Editar">
                  <Edit className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(rec.id)} className="text-red-500 hover:text-red-700 ml-1" title="Excluir">
                  <Trash2 className="w-4 h-4" />
                </button>
              </td>
            </tr>
          )) : (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-slate-500">
                Nenhum recebimento encontrado
              </td>
            </tr>
          )}
        </Table>
        <Pagination
          currentPage={currentPage}
          totalItems={lista.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
      </Card>

      {/* Modal: Cadastro/Edição manual */}
      <Modal isOpen={showFormModal} onClose={() => setShowFormModal(false)}
        title={editingRec ? 'Editar Recebimento' : 'Novo Recebimento'}
        footer={
          <><Button variant="secondary" onClick={() => setShowFormModal(false)}>Cancelar</Button>
          <Button icon={Save} onClick={handleSave} disabled={loading}>Salvar</Button></>
        }>
        <div className="space-y-4">
          <Input label="Data *" type="date" value={formData.data} onChange={e => setFormData(p => ({ ...p, data: e.target.value }))} />
          <Input label="Descrição *" value={formData.descricao} onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))} placeholder="Ex: Pagamento de cliente" />
          <Input label="Categoria *" value={formData.categoria} onChange={e => setFormData(p => ({ ...p, categoria: e.target.value }))} placeholder="Ex: Venda, Serviço" />
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
            <select className="input" value={formData.status} onChange={e => setFormData(p => ({ ...p, status: e.target.value }))}>
              <option>Não Pago</option><option>Parcelado</option><option>Recebido</option>
            </select>
          </div>
          {formData.status === 'Recebido' && (
            <Input
              label="Data do Recebimento"
              type="date"
              value={formData.data_recebimento}
              onChange={e => setFormData(p => ({ ...p, data_recebimento: e.target.value }))}
            />
          )}
          <Input label="Valor (R$) *" type="number" step="0.01" value={formData.valor} onChange={e => setFormData(p => ({ ...p, valor: e.target.value }))} placeholder="0.00" />
        </div>
      </Modal>

      {/* Modal: Marcar como Recebido */}
      <Modal isOpen={showRecebidoModal} onClose={() => setShowRecebidoModal(false)}
        title="Confirmar Recebimento"
        footer={
          <><Button variant="secondary" onClick={() => setShowRecebidoModal(false)}>Cancelar</Button>
          <Button icon={CheckCircle} onClick={handleMarcarRecebido} disabled={loading}>Confirmar</Button></>
        }>
        {recSelecionado && (
          <div className="space-y-4">
            {/* Resumo do valor */}
            <div className="bg-green-50 border border-green-100 rounded-lg p-3 text-sm">
              <p className="text-slate-600">{recSelecionado.descricao}</p>
              <div className="flex items-end justify-between mt-1">
                <div>
                  <p className="text-xs text-slate-400">Valor original</p>
                  <p className="text-2xl font-bold text-green-700">
                    R$ {parseFloat(recSelecionado.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
                {parseFloat(recebidoForm.desconto || 0) > 0 && (
                  <div className="text-right">
                    <p className="text-xs text-slate-400">Valor líquido</p>
                    <p className="text-xl font-bold text-blue-700">
                      R$ {Math.max(0, parseFloat(recSelecionado.valor) - parseFloat(recebidoForm.desconto)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Forma de recebimento */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Recebimento *</label>
              <select className="input" value={recebidoForm.forma_recebimento}
                onChange={e => {
                  const forma = e.target.value;
                  setRecebidoForm(p => ({ ...p, forma_recebimento: forma, conta_bancaria: formaParaConta(forma) }));
                }}>
                {FORMAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>

            {/* Conta bancária (auto preenchida, editável) */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária *</label>
              <select className="input" value={recebidoForm.conta_bancaria}
                onChange={e => setRecebidoForm(p => ({ ...p, conta_bancaria: e.target.value }))}>
                <option value="SICOOB">SICOOB (Banco / PIX)</option>
                <option value="CAIXA">CAIXA (Dinheiro físico)</option>
                <option value="MAQUININHA">MAQUININHA (Cartão)</option>
              </select>
            </div>

            {/* Desconto */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Desconto (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                className="input"
                value={recebidoForm.desconto}
                onChange={e => setRecebidoForm(p => ({ ...p, desconto: e.target.value }))}
                placeholder="0,00 — deixe em branco se não houver desconto"
              />
            </div>

            <Input label="Data do Recebimento *" type="date" value={recebidoForm.data_recebimento}
              onChange={e => setRecebidoForm(p => ({ ...p, data_recebimento: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
              <textarea className="input resize-none" rows={2} value={recebidoForm.observacao}
                onChange={e => setRecebidoForm(p => ({ ...p, observacao: e.target.value }))}
                placeholder="Ex: Depósito conta corrente..." />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Recebimento Parcial */}
      <Modal isOpen={showParcialModal} onClose={() => setShowParcialModal(false)}
        title="Recebimento Parcial"
        footer={
          <><Button variant="secondary" onClick={() => setShowParcialModal(false)}>Cancelar</Button>
          <Button icon={SplitSquareHorizontal} onClick={handleMarcarParcial} disabled={loading}>Confirmar Parcial</Button></>
        }>
        {recSelecionado && (
          <div className="space-y-4">
            <div className="bg-orange-50 border border-orange-100 rounded-lg p-3 text-sm">
              <p className="text-slate-600">{recSelecionado.descricao}</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                Total: R$ {parseFloat(recSelecionado.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <Input
              label="Valor Recebido (R$) *"
              type="number"
              step="0.01"
              min="0.01"
              max={parseFloat(recSelecionado.valor) - 0.01}
              value={parcialForm.valor_pago}
              onChange={e => setParcialForm(p => ({ ...p, valor_pago: e.target.value }))}
              placeholder="0,00"
            />
            {parcialForm.valor_pago > 0 && parseFloat(parcialForm.valor_pago) < parseFloat(recSelecionado.valor) && (
              <div className="bg-yellow-50 border border-yellow-100 rounded p-2 text-xs text-yellow-700">
                Saldo restante a receber: <strong>R$ {(parseFloat(recSelecionado.valor) - parseFloat(parcialForm.valor_pago)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> — será lançado automaticamente como pendente.
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Recebimento *</label>
              <select className="input" value={parcialForm.forma_recebimento}
                onChange={e => {
                  const forma = e.target.value;
                  setParcialForm(p => ({ ...p, forma_recebimento: forma, conta_bancaria: formaParaConta(forma) }));
                }}>
                {FORMAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Conta Bancária *</label>
              <select className="input" value={parcialForm.conta_bancaria}
                onChange={e => setParcialForm(p => ({ ...p, conta_bancaria: e.target.value }))}>
                <option value="SICOOB">SICOOB (Banco / PIX)</option>
                <option value="CAIXA">CAIXA (Dinheiro físico)</option>
                <option value="MAQUININHA">MAQUININHA (Cartão)</option>
              </select>
            </div>
            <Input label="Data do Recebimento *" type="date" value={parcialForm.data_recebimento}
              onChange={e => setParcialForm(p => ({ ...p, data_recebimento: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
              <textarea className="input resize-none" rows={2} value={parcialForm.observacao}
                onChange={e => setParcialForm(p => ({ ...p, observacao: e.target.value }))}
                placeholder="Ex: Cliente pagou metade hoje..." />
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Parcelar */}
      <Modal isOpen={showParceladoModal} onClose={() => setShowParceladoModal(false)}
        title="Parcelar Recebimento"
        footer={
          <><Button variant="secondary" onClick={() => setShowParceladoModal(false)}>Cancelar</Button>
          <Button icon={CreditCard} onClick={handleMarcarParcelado} disabled={loading}>Parcelar</Button></>
        }>
        {recSelecionado && (
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-sm">
              <p className="text-slate-600">{recSelecionado.descricao}</p>
              <p className="text-lg font-bold text-slate-800 mt-1">
                Total: R$ {parseFloat(recSelecionado.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input label="Número de Parcelas *" type="number" min="2" max="60"
                value={parceladoForm.parcelas}
                onChange={e => setParceladoForm(p => ({ ...p, parcelas: e.target.value }))} />
              <div>
                <p className="text-sm font-medium text-slate-700 mb-1">Valor por Parcela</p>
                <div className="input bg-slate-50 text-slate-700 font-semibold">
                  R$ {parseFloat(valorParcela()).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Forma de Recebimento *</label>
              <select className="input" value={parceladoForm.forma_recebimento}
                onChange={e => setParceladoForm(p => ({ ...p, forma_recebimento: e.target.value }))}>
                {FORMAS.map(f => <option key={f}>{f}</option>)}
              </select>
            </div>
            <Input label="Data da 1ª Parcela *" type="date" value={parceladoForm.data_primeira}
              onChange={e => setParceladoForm(p => ({ ...p, data_primeira: e.target.value }))} />
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Observação</label>
              <textarea className="input resize-none" rows={2} value={parceladoForm.observacao}
                onChange={e => setParceladoForm(p => ({ ...p, observacao: e.target.value }))}
                placeholder="Ex: Cartão parcelado em 3x sem juros..." />
            </div>
            <p className="text-xs text-slate-400">
              Serão criadas {parceladoForm.parcelas || '?'} entradas mensais a partir da data selecionada.
            </p>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Recebimentos;
