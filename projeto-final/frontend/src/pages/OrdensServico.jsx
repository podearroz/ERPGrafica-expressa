import React, { useState, useEffect } from 'react';
import { ClipboardList, CheckCircle, XCircle, FileText, Eye, Trash2, Eraser } from 'lucide-react';
import useOrdemServicoStore from '@store/ordemServicoStore';
import { supabase } from '@/config/supabaseClient';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import toast from 'react-hot-toast';

const STATUS_CONFIG = {
  ABERTA: { label: 'Aberta', className: 'bg-blue-100 text-blue-700' },
  FATURADA: { label: 'Faturada', className: 'bg-green-100 text-green-700' },
  FATURADA_SEM_NF: { label: 'Faturada s/ NF', className: 'bg-teal-100 text-teal-700' },
  CANCELADA: { label: 'Cancelada', className: 'bg-red-100 text-red-700' },
};

const BadgeStatus = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || { label: status, className: 'bg-slate-100 text-slate-600' };
  return (
    <span className={`px-2 py-1 rounded-full text-xs font-medium ${cfg.className}`}>
      {cfg.label}
    </span>
  );
};

const OrdensServico = () => {
  const { ordensServico, loading, fetchOrdensServico, faturarOS, cancelarOS, deleteOS } = useOrdemServicoStore();

  const [filtroStatus, setFiltroStatus] = useState('TODOS');
  const [osSelecionada, setOsSelecionada] = useState(null);
  const [showDetalhesModal, setShowDetalhesModal] = useState(false);
  const [showCancelarModal, setShowCancelarModal] = useState(false);
  const [showFaturarModal, setShowFaturarModal] = useState(false);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [faturarComNF, setFaturarComNF] = useState(false);

  useEffect(() => { fetchOrdensServico(); }, []);

  const ordens = filtroStatus === 'TODOS'
    ? ordensServico
    : ordensServico.filter((os) => os.status === filtroStatus);

  const contadores = {
    TODOS: ordensServico.length,
    ABERTA: ordensServico.filter((o) => o.status === 'ABERTA').length,
    FATURADA: ordensServico.filter((o) => o.status === 'FATURADA' || o.status === 'FATURADA_SEM_NF').length,
    CANCELADA: ordensServico.filter((o) => o.status === 'CANCELADA').length,
  };

  const abrirDetalhes = (os) => { setOsSelecionada(os); setShowDetalhesModal(true); };

  const abrirFaturar = (os) => {
    setOsSelecionada(os);
    setFaturarComNF(false);
    setShowFaturarModal(true);
  };

  const abrirCancelar = (os) => {
    setOsSelecionada(os);
    setMotivoCancelamento('');
    setShowCancelarModal(true);
  };

  const handleFaturar = async () => {
    try {
      const resultado = await faturarOS(osSelecionada.id, faturarComNF);
      if (faturarComNF && resultado.notaFiscal) {
        toast.success(`OS faturada! NF nº ${resultado.notaFiscal.numero} criada como "Pendente" em Notas Fiscais.`, { duration: 5000 });
      } else {
        toast.success('OS faturada sem NF-e com sucesso!');
      }
      setShowFaturarModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao faturar OS.');
    }
  };

  const handleCancelar = async () => {
    try {
      await cancelarOS(osSelecionada.id, motivoCancelamento);
      toast.success('OS cancelada.');
      setShowCancelarModal(false);
    } catch (error) {
      toast.error(error.message || 'Erro ao cancelar OS.');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Tem certeza que deseja excluir esta OS?')) return;
    try {
      await deleteOS(id);
      toast.success('OS excluída.');
    } catch (error) {
      toast.error('Erro ao excluir OS.');
    }
  };

  const handleLimparTudo = async () => {
    if (!confirm('⚠️ Isso vai apagar TODAS as ordens de serviço. Continuar?')) return;
    try {
      await supabase.from('itens_os').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await supabase.from('ordens_servico').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      await fetchOrdensServico();
      toast.success('Todas as OS foram removidas.');
    } catch (e) {
      toast.error('Erro ao limpar OS: ' + e.message);
    }
  };

  const headers = [
    { label: 'Nº OS' },
    { label: 'Data' },
    { label: 'Cliente' },
    { label: 'Valor Final' },
    { label: 'Status' },
    { label: 'Ações', align: 'right' },
  ];

  const abas = [
    { key: 'TODOS', label: 'Todas' },
    { key: 'ABERTA', label: 'Abertas' },
    { key: 'FATURADA', label: 'Faturadas' },
    { key: 'CANCELADA', label: 'Canceladas' },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-800">Ordens de Serviço</h2>
              <div className="flex gap-4 mt-2">
                {abas.map((aba) => (
                  <button
                    key={aba.key}
                    onClick={() => setFiltroStatus(aba.key)}
                    className={`text-sm font-medium pb-1 border-b-2 transition-colors ${
                      filtroStatus === aba.key
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {aba.label}
                    <span className="ml-1 text-xs opacity-70">({contadores[aba.key] ?? 0})</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Resumo rápido */}
            <div className="flex items-center gap-3">
              <button
                onClick={handleLimparTudo}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors"
                title="Limpar todas as OS (apenas para testes)"
              >
                <Eraser className="w-3.5 h-3.5" /> Limpar OS
              </button>
            <div className="hidden md:flex gap-4 text-center">
              <div className="bg-blue-50 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-blue-700">{contadores.ABERTA}</p>
                <p className="text-xs text-blue-600">Abertas</p>
              </div>
              <div className="bg-green-50 rounded-lg px-4 py-2">
                <p className="text-2xl font-bold text-green-700">{contadores.FATURADA}</p>
                <p className="text-xs text-green-600">Faturadas</p>
              </div>
            </div>
            </div>
          </div>
        </div>

        <Table headers={headers}>
          {ordens.length > 0 ? (
            ordens.map((os) => (
              <tr key={os.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-mono font-medium text-slate-800">{os.numero_os}</td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(os.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm text-slate-800">
                  {os.cliente?.nome || 'Cliente não informado'}
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {parseFloat(os.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm">
                  <BadgeStatus status={os.status} />
                </td>
                <td className="px-6 py-4 text-sm text-right space-x-2">
                  <button onClick={() => abrirDetalhes(os)} className="text-slate-500 hover:text-slate-700" title="Ver detalhes">
                    <Eye className="w-4 h-4" />
                  </button>
                  {os.status === 'ABERTA' && (
                    <>
                      <button onClick={() => abrirFaturar(os)} className="text-green-600 hover:text-green-700" title="Faturar">
                        <CheckCircle className="w-4 h-4" />
                      </button>
                      <button onClick={() => abrirCancelar(os)} className="text-red-500 hover:text-red-700" title="Cancelar">
                        <XCircle className="w-4 h-4" />
                      </button>
                    </>
                  )}
                  {os.status === 'CANCELADA' && (
                    <button onClick={() => handleDelete(os.id)} className="text-red-400 hover:text-red-600" title="Excluir">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-40" />
                Nenhuma ordem de serviço encontrada
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal: Detalhes da OS */}
      <Modal
        isOpen={showDetalhesModal}
        onClose={() => setShowDetalhesModal(false)}
        title={`OS ${osSelecionada?.numero_os}`}
      >
        {osSelecionada && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Status</p>
                <BadgeStatus status={osSelecionada.status} />
              </div>
              <div>
                <p className="text-slate-500">Data de Abertura</p>
                <p className="font-medium">{new Date(osSelecionada.data_abertura + 'T00:00:00').toLocaleDateString('pt-BR')}</p>
              </div>
              <div>
                <p className="text-slate-500">Cliente</p>
                <p className="font-medium">{osSelecionada.cliente?.nome || '-'}</p>
              </div>
              <div>
                <p className="text-slate-500">Valor Final</p>
                <p className="font-semibold text-slate-800">
                  R$ {parseFloat(osSelecionada.valor_final).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              {osSelecionada.faturado_em && (
                <div>
                  <p className="text-slate-500">Faturado em</p>
                  <p className="font-medium">{new Date(osSelecionada.faturado_em).toLocaleString('pt-BR')}</p>
                </div>
              )}
              {osSelecionada.cancelado_em && (
                <div className="col-span-2">
                  <p className="text-slate-500">Motivo do Cancelamento</p>
                  <p className="font-medium text-red-700">{osSelecionada.motivo_cancelamento}</p>
                </div>
              )}
            </div>

            {osSelecionada.observacoes && (
              <div className="text-sm">
                <p className="text-slate-500 mb-1">Observações</p>
                <p className="bg-slate-50 rounded p-2 text-slate-700">{osSelecionada.observacoes}</p>
              </div>
            )}

            {osSelecionada.itens && osSelecionada.itens.length > 0 && (
              <div>
                <p className="text-sm font-medium text-slate-700 mb-2">Itens</p>
                <div className="border rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-slate-600 font-medium">Descrição</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">Qtd</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">V. Unit.</th>
                        <th className="px-4 py-2 text-right text-slate-600 font-medium">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {osSelecionada.itens.map((item) => (
                        <tr key={item.id} className="border-t">
                          <td className="px-4 py-2 text-slate-800">{item.descricao}</td>
                          <td className="px-4 py-2 text-right text-slate-600">{item.quantidade}</td>
                          <td className="px-4 py-2 text-right text-slate-600">
                            R$ {parseFloat(item.valor_unitario).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-slate-800">
                            R$ {parseFloat(item.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {osSelecionada.status === 'ABERTA' && (
              <div className="flex gap-2 pt-2">
                <Button onClick={() => { setShowDetalhesModal(false); abrirFaturar(osSelecionada); }} className="flex-1">
                  <CheckCircle className="w-4 h-4 mr-1" /> Faturar
                </Button>
                <Button variant="secondary" onClick={() => { setShowDetalhesModal(false); abrirCancelar(osSelecionada); }} className="flex-1">
                  <XCircle className="w-4 h-4 mr-1" /> Cancelar
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Modal: Faturar */}
      <Modal
        isOpen={showFaturarModal}
        onClose={() => setShowFaturarModal(false)}
        title={`Faturar OS ${osSelecionada?.numero_os}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowFaturarModal(false)}>Cancelar</Button>
            <Button icon={CheckCircle} onClick={handleFaturar} disabled={loading}>
              {faturarComNF ? 'Faturar com NF-e' : 'Faturar sem NF-e'}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-800">
            <p className="font-medium mb-1">Valor a faturar:</p>
            <p className="text-2xl font-bold">
              R$ {parseFloat(osSelecionada?.valor_final || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          </div>

          <div>
            <p className="text-sm font-medium text-slate-700 mb-3">Selecione o tipo de faturamento:</p>
            <div className="space-y-2">
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="tipoFaturamento"
                  checked={!faturarComNF}
                  onChange={() => setFaturarComNF(false)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">Faturar sem NF-e</p>
                  <p className="text-xs text-slate-500">Baixa o estoque e fecha a OS sem emitir nota fiscal.</p>
                </div>
              </label>
              <label className="flex items-start gap-3 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="tipoFaturamento"
                  checked={faturarComNF}
                  onChange={() => setFaturarComNF(true)}
                  className="mt-0.5"
                />
                <div>
                  <p className="font-medium text-slate-800">Faturar com NF-e</p>
                  <p className="text-xs text-slate-500">Baixa o estoque e emite nota fiscal (acesse Notas Fiscais para emissão).</p>
                </div>
              </label>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            Esta ação irá dar baixa automática no estoque dos produtos vinculados e não poderá ser desfeita.
          </p>
        </div>
      </Modal>

      {/* Modal: Cancelar */}
      <Modal
        isOpen={showCancelarModal}
        onClose={() => setShowCancelarModal(false)}
        title={`Cancelar OS ${osSelecionada?.numero_os}`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCancelarModal(false)}>Voltar</Button>
            <Button
              onClick={handleCancelar}
              disabled={loading || motivoCancelamento.trim().length < 15}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="w-4 h-4 mr-1" /> Confirmar Cancelamento
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
            Atenção: o cancelamento não realiza baixa no estoque e não pode ser desfeito.
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              Motivo do Cancelamento * <span className="text-slate-400 font-normal">(mínimo 15 caracteres)</span>
            </label>
            <textarea
              className="input resize-none"
              rows={4}
              value={motivoCancelamento}
              onChange={(e) => setMotivoCancelamento(e.target.value)}
              placeholder="Descreva o motivo do cancelamento..."
            />
            <p className={`text-xs mt-1 ${motivoCancelamento.trim().length < 15 ? 'text-red-500' : 'text-green-600'}`}>
              {motivoCancelamento.trim().length}/15 caracteres mínimos
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default OrdensServico;
