import React, { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import useRecebimentoStore from '@store/recebimentoStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';

const Recebimentos = () => {
  const { recebimentos, addRecebimento, updateRecebimento, deleteRecebimento, fetchRecebimentos, loading } = useRecebimentoStore();
  
  useEffect(() => {
    fetchRecebimentos();
  }, []);
  const [showModal, setShowModal] = useState(false);
  const [editingRecebimento, setEditingRecebimento] = useState(null);
  const [formData, setFormData] = useState({
    data: new Date().toISOString().split('T')[0],
    valor: '',
    tipo: 'entrada',
    descricao: '',
    categoria: ''
  });

  const headers = [
    { label: 'Data' },
    { label: 'Descrição' },
    { label: 'Categoria' },
    { label: 'Tipo' },
    { label: 'Valor' },
    { label: 'Ações', align: 'right' }
  ];

  const openModal = (recebimento = null) => {
    if (recebimento) {
      setEditingRecebimento(recebimento);
      setFormData(recebimento);
    } else {
      setEditingRecebimento(null);
      setFormData({
        data: new Date().toISOString().split('T')[0],
        valor: '',
        tipo: 'entrada',
        descricao: '',
        categoria: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRecebimento(null);
  };

  const handleSave = async () => {
    if (!formData.data || !formData.valor || !formData.descricao || !formData.categoria) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    const recebimentoData = {
      ...formData,
      valor: parseFloat(formData.valor)
    };

    try {
      if (editingRecebimento) {
        await updateRecebimento(editingRecebimento.id, recebimentoData);
        toast.success('Recebimento atualizado com sucesso!');
      } else {
        await addRecebimento(recebimentoData);
        toast.success('Recebimento cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar recebimento. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este recebimento?')) {
      try {
        await deleteRecebimento(id);
        toast.success('Recebimento excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir recebimento.');
      }
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div>
      <Card>
        <div className="p-6 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-slate-800">Recebimentos</h2>
            <Button icon={Plus} variant="success" onClick={() => openModal()}>
              Novo Recebimento
            </Button>
          </div>
        </div>

        <Table headers={headers}>
          {recebimentos.length > 0 ? (
            recebimentos.map(recebimento => (
              <tr key={recebimento.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(recebimento.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {recebimento.descricao}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {recebimento.categoria}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    recebimento.tipo === 'entrada' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {recebimento.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold">
                  <span className={recebimento.tipo === 'entrada' ? 'text-green-600' : 'text-red-600'}>
                    {recebimento.tipo === 'entrada' ? '+' : '-'} R$ {recebimento.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openModal(recebimento)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(recebimento.id)}
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
                Nenhum recebimento cadastrado
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingRecebimento ? 'Editar Recebimento' : 'Novo Recebimento'}
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
            placeholder="Ex: Pagamento de cliente"
          />

          <Input
            label="Categoria *"
            value={formData.categoria}
            onChange={(e) => handleInputChange('categoria', e.target.value)}
            placeholder="Ex: Venda, Serviço, Outros"
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
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
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
        </div>
      </Modal>
    </div>
  );
};

export default Recebimentos;
