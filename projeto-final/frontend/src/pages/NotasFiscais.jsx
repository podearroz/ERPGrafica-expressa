import React, { useState } from 'react';
import { Plus, Edit, Trash2, Save } from 'lucide-react';
import useNotaFiscalStore from '@store/notaFiscalStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';

const NotasFiscais = () => {
  const { notasFiscais, addNotaFiscal, updateNotaFiscal, deleteNotaFiscal, getProximoNumero } = useNotaFiscalStore();
  const [showModal, setShowModal] = useState(false);
  const [editingNota, setEditingNota] = useState(null);
  const [formData, setFormData] = useState({
    numero: '',
    data: new Date().toISOString().split('T')[0],
    cliente: '',
    tipo: 'NF-e',
    valor: ''
  });

  const headers = [
    { label: 'Número' },
    { label: 'Data' },
    { label: 'Cliente' },
    { label: 'Tipo' },
    { label: 'Valor' },
    { label: 'Ações', align: 'right' }
  ];

  const openModal = (nota = null) => {
    if (nota) {
      setEditingNota(nota);
      setFormData(nota);
    } else {
      setEditingNota(null);
      setFormData({
        numero: getProximoNumero(),
        data: new Date().toISOString().split('T')[0],
        cliente: '',
        tipo: 'NF-e',
        valor: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingNota(null);
  };

  const handleSave = () => {
    if (!formData.numero || !formData.data || !formData.cliente || !formData.valor) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    const notaData = {
      ...formData,
      valor: parseFloat(formData.valor)
    };

    if (editingNota) {
      updateNotaFiscal(editingNota.id, notaData);
      toast.success('Nota fiscal atualizada com sucesso!');
    } else {
      addNotaFiscal(notaData);
      toast.success('Nota fiscal cadastrada com sucesso!');
    }
    closeModal();
  };

  const handleDelete = (id) => {
    if (confirm('Tem certeza que deseja excluir esta nota fiscal?')) {
      deleteNotaFiscal(id);
      toast.success('Nota fiscal excluída com sucesso!');
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
            <h2 className="text-xl font-bold text-slate-800">Notas Fiscais</h2>
            <Button icon={Plus} onClick={() => openModal()}>
              Nova Nota Fiscal
            </Button>
          </div>
        </div>

        <Table headers={headers}>
          {notasFiscais.length > 0 ? (
            notasFiscais.map(nota => (
              <tr key={nota.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {nota.numero}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {new Date(nota.data).toLocaleDateString('pt-BR')}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {nota.cliente}
                </td>
                <td className="px-6 py-4 text-sm">
                  <span className="px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                    {nota.tipo}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm font-semibold text-slate-800">
                  R$ {nota.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openModal(nota)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(nota.id)}
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
                Nenhuma nota fiscal cadastrada
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingNota ? 'Editar Nota Fiscal' : 'Nova Nota Fiscal'}
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
            label="Número *"
            value={formData.numero}
            onChange={(e) => handleInputChange('numero', e.target.value)}
            placeholder="001"
          />

          <Input
            label="Data *"
            type="date"
            value={formData.data}
            onChange={(e) => handleInputChange('data', e.target.value)}
          />

          <Input
            label="Cliente *"
            value={formData.cliente}
            onChange={(e) => handleInputChange('cliente', e.target.value)}
            placeholder="Nome do cliente"
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
              <option value="NF-e">NF-e</option>
              <option value="NFC-e">NFC-e</option>
              <option value="NFS-e">NFS-e</option>
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

export default NotasFiscais;
