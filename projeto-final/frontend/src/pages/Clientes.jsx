import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Save } from 'lucide-react';
import useClienteStore from '@store/clienteStore';
import Card from '@components/common/Card';
import Button from '@components/common/Button';
import Table from '@components/common/Table';
import Modal from '@components/common/Modal';
import Input from '@components/common/Input';
import Pagination from '@components/common/Pagination';
import toast from 'react-hot-toast';

const PAGE_SIZE = 10;

const emptyForm = {
  nome: '',
  nomeFantasia: '',
  cpfCnpj: '',
  inscricaoEstadual: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  municipio: '',
  uf: '',
  cep: '',
  telefone: '',
  email: '',
};

const Clientes = () => {
  const { clientes, addCliente, updateCliente, deleteCliente, fetchClientes, searchClientes, loading } = useClienteStore();

  useEffect(() => {
    fetchClientes();
  }, []);

  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingCliente, setEditingCliente] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // Debounce para busca server-side (evita request a cada tecla)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm.trim()) {
        searchClientes(searchTerm.trim());
      } else {
        fetchClientes();
      }
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const headers = [
    { label: 'Nome / Razão Social' },
    { label: 'CPF/CNPJ' },
    { label: 'Município/UF' },
    { label: 'Telefone' },
    { label: 'Ações', align: 'right' }
  ];

  // clientes já vem filtrado pelo server quando há searchTerm
  const pagedClientes = clientes.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const handleSearch = (v) => { setSearchTerm(v); setCurrentPage(1); };

  const openModal = (cliente = null) => {
    if (cliente) {
      setEditingCliente(cliente);
      setFormData({
        nome: cliente.nome || '',
        nomeFantasia: cliente.nome_fantasia || '',
        cpfCnpj: cliente.cpf_cnpj || cliente.cpfCnpj || '',
        inscricaoEstadual: cliente.inscricao_estadual || '',
        logradouro: cliente.logradouro || '',
        numero: cliente.numero || '',
        complemento: cliente.complemento || '',
        bairro: cliente.bairro || '',
        municipio: cliente.municipio || '',
        uf: cliente.uf || '',
        cep: cliente.cep || '',
        telefone: cliente.telefone || '',
        email: cliente.email || '',
      });
    } else {
      setEditingCliente(null);
      setFormData(emptyForm);
    }
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingCliente(null);
    setFormData(emptyForm);
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value.toUpperCase() }));
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.cpfCnpj || !formData.logradouro || !formData.numero ||
        !formData.bairro || !formData.municipio || !formData.uf || !formData.cep) {
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
              onChange={(e) => handleSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <Table headers={headers}>
          {pagedClientes.length > 0 ? (
            pagedClientes.map(cliente => (
              <tr key={cliente.id} className="hover:bg-slate-50">
                <td className="px-6 py-4 text-sm font-medium text-slate-800">
                  {cliente.nome}
                  {cliente.nome_fantasia && (
                    <span className="block text-xs text-slate-400">{cliente.nome_fantasia}</span>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {cliente.cpf_cnpj || cliente.cpfCnpj}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {[cliente.municipio, cliente.uf].filter(Boolean).join(' / ')}
                </td>
                <td className="px-6 py-4 text-sm text-slate-600">
                  {cliente.telefone}
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
        <Pagination
          currentPage={currentPage}
          totalItems={clientes.length}
          pageSize={PAGE_SIZE}
          onPageChange={setCurrentPage}
        />
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
          {/* Seção: Destinatário / Remetente */}
          <div className="border border-slate-200 rounded p-3">
            <p className="text-xs font-bold text-slate-500 uppercase mb-3">Destinatário / Remetente</p>

            {/* Razão Social, Nome Fantasia e CPF/CNPJ */}
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="col-span-2">
                <Input
                  label="Razão Social *"
                  value={formData.nome}
                  onChange={(e) => handleInputChange('nome', e.target.value)}
                  placeholder="RAZÃO SOCIAL OU NOME COMPLETO"
                />
              </div>
              <div>
                <Input
                  label="CNPJ / CPF *"
                  value={formData.cpfCnpj}
                  onChange={(e) => handleInputChange('cpfCnpj', e.target.value)}
                  placeholder="00.000.000/0000-00"
                />
              </div>
            </div>
            <div className="mb-3">
              <Input
                label="Nome Fantasia"
                value={formData.nomeFantasia}
                onChange={(e) => handleInputChange('nomeFantasia', e.target.value)}
                placeholder="NOME FANTASIA (OPCIONAL)"
              />
            </div>

            {/* Endereço */}
            <div className="grid grid-cols-4 gap-3 mb-3">
              <div className="col-span-2">
                <Input
                  label="Endereço *"
                  value={formData.logradouro}
                  onChange={(e) => handleInputChange('logradouro', e.target.value)}
                  placeholder="RUA / AVENIDA"
                />
              </div>
              <div>
                <Input
                  label="Número *"
                  value={formData.numero}
                  onChange={(e) => handleInputChange('numero', e.target.value)}
                  placeholder="191"
                />
              </div>
              <div>
                <Input
                  label="Complemento"
                  value={formData.complemento}
                  onChange={(e) => handleInputChange('complemento', e.target.value)}
                  placeholder="SALA 2"
                />
              </div>
            </div>

            {/* Bairro e CEP */}
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Input
                label="Bairro / Distrito *"
                value={formData.bairro}
                onChange={(e) => handleInputChange('bairro', e.target.value)}
                placeholder="BAIRRO"
              />
              <Input
                label="CEP *"
                value={formData.cep}
                onChange={(e) => handleInputChange('cep', e.target.value)}
                placeholder="00000-000"
              />
            </div>

            {/* Município, UF, Telefone e Inscrição Estadual */}
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2">
                <Input
                  label="Município *"
                  value={formData.municipio}
                  onChange={(e) => handleInputChange('municipio', e.target.value)}
                  placeholder="CIDADE"
                />
              </div>
              <div>
                <Input
                  label="UF *"
                  value={formData.uf}
                  onChange={(e) => handleInputChange('uf', e.target.value)}
                  placeholder="RO"
                  maxLength={2}
                />
              </div>
              <div>
                <Input
                  label="Fone / Fax"
                  value={formData.telefone}
                  onChange={(e) => handleInputChange('telefone', e.target.value)}
                  placeholder="(00) 00000-0000"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <Input
                label="Inscrição Estadual"
                value={formData.inscricaoEstadual}
                onChange={(e) => handleInputChange('inscricaoEstadual', e.target.value)}
                placeholder="INSCRIÇÃO ESTADUAL"
              />
              <Input
                label="Email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                placeholder="EMAIL@EXEMPLO.COM"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Clientes;
