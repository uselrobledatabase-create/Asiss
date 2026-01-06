import { useState } from 'react';
import { Icon, IconName } from '../../../shared/components/common/Icon';
import { useSrlRealtime } from '../hooks';
import { RequestsTable } from '../components/RequestsTable';
import { SrlWorkspace } from '../components/SrlWorkspace';
import { CalendarView } from '../components/CalendarView';
import { ReportsView } from '../components/ReportsView';
import { ConfigView } from '../components/ConfigView';

type Tab = 'requests' | 'calendar' | 'reports' | 'config';

export const SrlPage = () => {
    const [activeTab, setActiveTab] = useState<Tab>('requests');
    const [workspaceOpen, setWorkspaceOpen] = useState(false);
    const [activeRequestId, setActiveRequestId] = useState<string | null>(null);

    // Enable Realtime Updates
    useSrlRealtime();

    const handleOpenWorkspace = (requestId?: string) => {
        setActiveRequestId(requestId || null);
        setWorkspaceOpen(true);
    };

    const handleCloseWorkspace = () => {
        setWorkspaceOpen(false);
        setActiveRequestId(null);
    };

    return (
        <div className="min-h-screen bg-slate-50/50 pb-20">
            {/* Enterprise Header */}
            <header className="bg-white/80 backdrop-blur-md sticky top-0 z-30 border-b border-slate-200 shadow-sm">
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-600 rounded-lg shadow-lg shadow-blue-200">
                                <Icon name="wrench" className="text-white" size={24} />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Gestión SRL</h1>
                                <p className="text-xs text-slate-500 font-medium">Sistema de Reparaciones y Logística</p>
                            </div>
                        </div>

                        {/* Modern Tab Switcher */}
                        <nav className="flex items-center gap-1 bg-slate-100/80 p-1.5 rounded-xl overflow-x-auto no-scrollbar">
                            <TabButton
                                active={activeTab === 'requests'}
                                onClick={() => setActiveTab('requests')}
                                icon="inbox"
                                label="Solicitudes"
                            />
                            <TabButton
                                active={activeTab === 'calendar'}
                                onClick={() => setActiveTab('calendar')}
                                icon="calendar"
                                label="Calendario"
                            />
                            <TabButton
                                active={activeTab === 'reports'}
                                onClick={() => setActiveTab('reports')}
                                icon="bar-chart"
                                label="Reportes"
                            />
                            <TabButton
                                active={activeTab === 'config'}
                                onClick={() => setActiveTab('config')}
                                icon="settings"
                                label="Configuración"
                            />
                        </nav>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                {activeTab === 'requests' && (
                    <RequestsTable
                        onCreate={() => handleOpenWorkspace()}
                        onView={(id) => handleOpenWorkspace(id)}
                    />
                )}
                {activeTab === 'calendar' && <CalendarView />}
                {activeTab === 'reports' && <ReportsView />}
                {activeTab === 'config' && <ConfigView />}
            </main>

            {/* Workspace Panel (Slide-over) */}
            <SrlWorkspace
                isOpen={workspaceOpen}
                onClose={handleCloseWorkspace}
                requestId={activeRequestId}
            />
        </div>
    );
};

const TabButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: IconName, label: string }) => (
    <button
        onClick={onClick}
        className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 whitespace-nowrap
            ${active
                ? 'bg-white text-blue-700 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:bg-slate-200/50 hover:text-slate-900'
            }
        `}
    >
        <Icon name={icon} size={18} className={active ? 'text-blue-600' : 'text-slate-400'} />
        {label}
    </button>
);
