import { useState } from 'react';
import { Icon, IconName } from '../../shared/components/common/Icon';
import { useSessionStore } from '../../shared/state/sessionStore';
import { MeetingsTableView } from './subpages/MeetingsTableView';
import { AgendaView } from './subpages/AgendaView';
import { MinutesView } from './subpages/MinutesView';
import { SettingsView } from './subpages/SettingsView';
import { MeetingWorkspace } from './workspace/MeetingWorkspace';
import { isMeetingManager } from './utils/permissions';

type Tab = 'agenda' | 'reuniones' | 'minutas' | 'config';

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'agenda', label: 'Agenda', icon: 'calendar' },
  { id: 'reuniones', label: 'Reuniones', icon: 'users' },
  { id: 'minutas', label: 'Minutas', icon: 'file-text' },
  { id: 'config', label: 'Configuración', icon: 'settings' },
];

export const ReunionesPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('reuniones');
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const session = useSessionStore((s) => s.session);
  const canManage = isMeetingManager(session?.supervisorName ?? '');
  const visibleTabs = TABS.filter((tab) => canManage || tab.id !== 'config');

  const handleOpenWorkspace = (meetingId: string) => {
    setSelectedMeetingId(meetingId);
  };

  const handleCloseWorkspace = () => {
    setSelectedMeetingId(null);
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'agenda':
        return <AgendaView onOpenMeeting={handleOpenWorkspace} />;
      case 'reuniones':
        return <MeetingsTableView onOpenMeeting={handleOpenWorkspace} />;
      case 'minutas':
        return <MinutesView onOpenMeeting={handleOpenWorkspace} />;
      case 'config':
        return canManage ? <SettingsView /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Tabs Navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b border-slate-200 pb-4">
        <div className="flex flex-wrap gap-2">
          {visibleTabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${activeTab === tab.id
                  ? 'bg-brand-600 text-white shadow-md'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
            >
              <Icon name={tab.icon} size={18} />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      {renderContent()}

      {/* Meeting Workspace Modal */}
      {selectedMeetingId && (
        <MeetingWorkspace
          meetingId={selectedMeetingId}
          onClose={handleCloseWorkspace}
        />
      )}
    </div>
  );
};
