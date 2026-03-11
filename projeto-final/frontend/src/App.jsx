import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import { BarChart3, Users, ShoppingCart, TrendingUp, TrendingDown, FileText, Calendar } from 'lucide-react';
import Dashboard from '@pages/Dashboard';
import Clientes from '@pages/Clientes';
import Vendas from '@pages/Vendas';
import Recebimentos from '@pages/Recebimentos';
import Pagamentos from '@pages/Pagamentos';
import NotasFiscais from '@pages/NotasFiscais';
import Relatorios from '@pages/Relatorios';

function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3, component: Dashboard },
    { id: 'clientes', label: 'Clientes', icon: Users, component: Clientes },
    { id: 'vendas', label: 'Vendas', icon: ShoppingCart, component: Vendas },
    { id: 'recebimentos', label: 'Recebimentos', icon: TrendingUp, component: Recebimentos },
    { id: 'pagamentos', label: 'Pagamentos', icon: TrendingDown, component: Pagamentos },
    { id: 'notas', label: 'Notas Fiscais', icon: FileText, component: NotasFiscais },
    { id: 'relatorios', label: 'Relatórios', icon: BarChart3, component: Relatorios }
  ];
  
  const ActiveComponent = tabs.find(tab => tab.id === activeTab)?.component || Dashboard;
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      <Toaster position="top-right" />
      
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Sistema de Gestão</h1>
              <p className="text-sm text-slate-500">Controle completo do seu negócio</p>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Calendar className="w-4 h-4" />
              <span>{new Date().toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </header>
      
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 bg-blue-50'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </nav>
      
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <ActiveComponent />
      </main>
    </div>
  );
}

export default App;
