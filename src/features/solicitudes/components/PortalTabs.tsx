
import { Icon } from '../../../shared/components/common/Icon';

type TabId = 'solicitudes' | 'videos' | 'patentes' | 'camaras';

interface PortalTabsProps {
    activeTab: TabId;
    onChange: (tab: TabId) => void;
}

export const PortalTabs = ({ activeTab, onChange }: PortalTabsProps) => {
    const tabs: { id: TabId; label: string; icon: string; desc: string }[] = [
        { id: 'solicitudes', label: 'Solicitudes', icon: 'file-text', desc: 'Requerimientos' },
        { id: 'videos', label: 'Videos', icon: 'eye', desc: 'Grabaciones' },
        { id: 'patentes', label: 'Patentes', icon: 'search', desc: 'Consultas' },
        { id: 'camaras', label: 'Cámaras', icon: 'activity', desc: 'Estado vivo' },
    ];

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-1.5 mb-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {tabs.map((tab) => {
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => onChange(tab.id)}
                            className={`
                relative flex items-center justify-center gap-3 p-3 rounded-xl transition-all duration-300 ease-out
                ${isActive
                                    ? 'bg-brand-50 text-brand-600 shadow-sm ring-1 ring-brand-200'
                                    : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                                }
              `}
                        >
                            <div className={`
                p-2 rounded-lg transition-colors
                ${isActive ? 'bg-white text-brand-500 shadow-sm' : 'bg-transparent'}
              `}>
                                <Icon name={tab.icon as any} size={20} />
                            </div>
                            <div className="text-left flex-1 hidden sm:block">
                                <div className={`font-semibold text-sm ${isActive ? 'text-brand-900' : 'text-slate-700'}`}>
                                    {tab.label}
                                </div>
                                <div className={`text-xs ${isActive ? 'text-brand-500' : 'text-slate-400'}`}>
                                    {tab.desc}
                                </div>
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
};
