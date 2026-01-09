import React, { useState } from 'react';
import { PageHeader } from '../../shared/components/common/PageHeader';
import { FormTab } from './tabs/FormTab';
import { HistoryTab } from './tabs/HistoryTab';
import { ReportsTab } from './tabs/ReportsTab';
import { ClipboardList, History, BarChart3 } from 'lucide-react';

type Tab = 'form' | 'history' | 'reports';

export const InspeccionICA: React.FC = () => {
    const [activeTab, setActiveTab] = useState<Tab>('form');

    return (
        <div className="min-h-screen bg-slate-50/50 dark:bg-slate-900 pb-20 md:pb-10">

            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                {/* Header & Tabs */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div>
                        <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                            Control de Fiscalizaciones <span className="text-blue-600">ICA</span>
                        </h1>
                        <p className="text-slate-500 mt-1">
                            Norma A18 - Gestión de Calidad y Estándar de Flota
                        </p>
                    </div>

                    {/* Tab Navigation */}
                    <div className="bg-white dark:bg-slate-800 p-1.5 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm flex items-center gap-1 overflow-x-auto">
                        <NavTab
                            active={activeTab === 'form'}
                            onClick={() => setActiveTab('form')}
                            icon={ClipboardList}
                            label="Nueva Inspección"
                        />
                        <NavTab
                            active={activeTab === 'history'}
                            onClick={() => setActiveTab('history')}
                            icon={History}
                            label="Historial"
                        />
                        <NavTab
                            active={activeTab === 'reports'}
                            onClick={() => setActiveTab('reports')}
                            icon={BarChart3}
                            label="Reportes"
                        />
                    </div>
                </div>

                {/* Content Area */}
                <div className="mt-8">
                    {activeTab === 'form' && <FormTab />}
                    {activeTab === 'history' && <HistoryTab />}
                    {activeTab === 'reports' && <ReportsTab />}
                </div>

            </div>
        </div>
    );
};

const NavTab = ({ active, onClick, icon: Icon, label }: any) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
            ${active
                ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 shadow-sm'
                : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'
            }
        `}
    >
        <Icon className="w-4 h-4" />
        {label}
    </button>
);
