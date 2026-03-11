import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, X, Save } from 'lucide-react';
import useClienteStore from '@store/clienteStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import toast from 'react-hot-toast';

const Clientes = () => {
  const { clientes, addCliente, updateCliente, deleteCliente, fetchClientes, loading } = useClienteStore();
  
  useEffect(() => {
    fetchClientes();
  }, []);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [formData, setFormData] = useState({
    nome: '',
    cpfCnpj: '',
    telefone: '',
    email: '',
    endereco: ''
  });

  const headers = [
    { label: 'Nome' },
    { label: 'CPF/CNPJ' },
    { label: 'Telefone' },
    { label: 'Email' },
    { label: 'Ações', align: 'right' }
  ];

  const filteredClientes = clientes.filter(c =>
    (c.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.cpf_cnpj || c.cpfCnpj || '').includes(searchTerm) ||
    (c.email || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const openModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome,
        cpfCnpj: cliente.cpf_cnpj || cliente.cpfCnpj,
        telefone: cliente.telefone,
        email: cliente.email,
        endereco: cliente.endereco
      });
    } else {
      setEditingCliente(null);
      setFormData({
        nome: '',
        cpfCnpj: '',
        telefone: '',
        email: '',
        endereco: ''
      });
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCliente(null);
    setFormData({
      nome: '',
      cpfCnpj: '',
      telefone: '',
      email: '',
      endereco: ''
    });
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cpfCnpj || !formData.telefone || !formData.email) {
      toast.error('Preencha todos os campos obrigatórios!');
      return;
    }

    try {
      if (editingCliente) {
        await updateCliente(editingCliente.id, formData);
        toast.success('Cliente atualizado com sucesso!');
      } else {
        await addCliente(formData);
        toast.success('Cliente cadastrado com sucesso!');
      }
      closeModal();
    } catch (error) {
      toast.error('Erro ao salvar cliente. Tente novamente.');
    }
  };

  const handleDelete = async (id) => {
    if (confirm('Tem certeza que deseja excluir este cliente?')) {
      try {
        await deleteCliente(id);
        toast.success('Cliente excluído com sucesso!');
      } catch (error) {
        toast.error('Erro ao excluir cliente.');
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
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-800">Clientes</h2>
            <Button icon={Plus} onClick={() => openModal()}>
              Novo Cliente
            </Button>
          </div>
          <div className="relative">
            <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar cliente por nome, CPF/CNPJ ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Table headers={headers}>
          {filteredClientes.length > 0 ? (
            filteredClientes.map(cliente => (
              <tr key={cliente.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {cliente.nome}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {cliente.cpf_cnpj || cliente.cpfCnpj}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {cliente.telefone}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {cliente.email}
                </td>
                <td className="px-6 py-4 text-sm text-right">
                  <button
                    onClick={() => openModal(cliente)}
                    className="text-blue-600 hover:text-blue-700 mr-3"
                    title="Editar"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(cliente.id)}
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
              <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                {searchTerm ? 'Nenhum cliente encontrado' : 'Nenhum cliente cadastrado'}
              </td>
            </tr>
          )}
        </Table>
      </Card>

      {/* Modal */}
      <Modal
        isOpen={showModal}
        onClose={closeModal}
        title={editingCliente ? 'Editar Cliente' : 'Novo Cliente'}
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
            label="Nome *"
            value={formData.nome}
            onChange={(e) => handleInputChange('nome', e.target.value)}
            placeholder="Nome completo"
          />
          <Input
            label="CPF/CNPJ *"
            value={formData.cpfCnpj}
            onChange={(e) => handleInputChange('cpfCnpj', e.target.value)}
            placeholder="000.000.000-00 ou 00.000.000/0000-00"
          />
          <Input
            label="Telefone *"
            value={formData.telefone}
            onChange={(e) => handleInputChange('telefone', e.target.value)}
            placeholder="(00) 00000-0000"
          />
          <Input
            label="Email *"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange('email', e.target.value)}
            placeholder="email@exemplo.com"
          />
          <Input
            label="Endereço"
            value={formData.endereco}
            onChange={(e) => handleInputChange('endereco', e.target.value)}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>
      </Modal>
    </div>
  );
};

export default Clientes;
