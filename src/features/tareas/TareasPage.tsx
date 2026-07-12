import { useMemo, useState } from 'react';
import { Icon, IconName } from '../../shared/components/common/Icon';
import { useSessionStore } from '../../shared/state/sessionStore';
import { KanbanView } from './subpages/KanbanView';
import { ListView } from './subpages/ListView';
import { CalendarView } from './subpages/CalendarView';
import { ReportsView } from './subpages/ReportsView';
import { SettingsView } from './subpages/SettingsView';
import { TaskWorkspace } from './workspace/TaskWorkspace';
import { TaskFormModal } from './components/TaskFormModal';
import { useTaskKPIs, useTasks } from './hooks';
import { isTaskManager } from './utils/permissions';

type Tab = 'kanban' | 'lista' | 'calendario' | 'reportes' | 'config';

const STAT_TONES: Record<string, { icon: string; value: string }> = {
  slate: { icon: 'bg-slate-100 text-slate-500', value: 'text-slate-900' },
  blue: { icon: 'bg-blue-100 text-blue-600', value: 'text-blue-700' },
  red: { icon: 'bg-red-100 text-red-600', value: 'text-red-700' },
  amber: { icon: 'bg-amber-100 text-amber-600', value: 'text-amber-700' },
  rose: { icon: 'bg-rose-100 text-rose-600', value: 'text-rose-700' },
  emerald: { icon: 'bg-emerald-100 text-emerald-600', value: 'text-emerald-700' },
};

const StatCard = ({ label, value, tone, icon }: { label: string; value: number | string; tone: keyof typeof STAT_TONES; icon: IconName }) => {
  const t = STAT_TONES[tone];
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</span>
        <span className={`flex h-7 w-7 items-center justify-center rounded-lg ${t.icon}`}>
          <Icon name={icon} size={14} />
        </span>
      </div>
      <div className={`mt-1.5 text-2xl font-bold ${t.value}`}>{value}</div>
    </div>
  );
};

const TABS: { id: Tab; label: string; icon: IconName; description: string }[] = [
  { id: 'kanban', label: 'Tablero', icon: 'layers', description: 'Flujo por estado y seguimiento visual' },
  { id: 'lista', label: 'Lista', icon: 'clipboard', description: 'Control detallado con búsqueda y filtros' },
  { id: 'calendario', label: 'Calendario', icon: 'calendar-range', description: 'Planificación por fecha de vencimiento' },
  { id: 'reportes', label: 'Reportes', icon: 'bar-chart', description: 'Métricas de desempeño y carga operativa' },
  { id: 'config', label: 'Configuración', icon: 'settings', description: 'Notificaciones y ajustes de operación' },
];

export const TareasPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>('kanban');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showNewTaskModal, setShowNewTaskModal] = useState(false);
  const session = useSessionStore((s) => s.session);
  const kpisQuery = useTaskKPIs();
  const tasksQuery = useTasks();
  const canManage = isTaskManager(session?.supervisorName ?? '');
  const visibleTabs = TABS.filter((tab) => canManage || tab.id !== 'config');

  const handleOpenWorkspace = (taskId: string) => {
    setSelectedTaskId(taskId);
  };

  const handleCloseWorkspace = () => {
    setSelectedTaskId(null);
  };

  const executiveStats = useMemo(() => {
    const kpis = kpisQuery.data;
    const tasks = tasksQuery.data || [];
    const now = new Date();
    const in48h = now.getTime() + 48 * 60 * 60 * 1000;
    const in7days = now.getTime() + 7 * 24 * 60 * 60 * 1000;

    const dueIn48h = tasks.filter((task) => {
      if (!task.due_at || ['EVALUADO', 'RECHAZADO'].includes(task.status)) return false;
      const dueTime = new Date(task.due_at).getTime();
      return dueTime >= now.getTime() && dueTime <= in48h;
    }).length;

    const dueIn7Days = tasks.filter((task) => {
      if (!task.due_at || ['EVALUADO', 'RECHAZADO'].includes(task.status)) return false;
      const dueTime = new Date(task.due_at).getTime();
      return dueTime >= now.getTime() && dueTime <= in7days;
    }).length;

    const criticalOpen = tasks.filter((task) =>
      task.priority === 'CRITICA' && !['EVALUADO', 'RECHAZADO'].includes(task.status)
    ).length;

    const openTasks = tasks.filter((task) => !['EVALUADO', 'RECHAZADO'].includes(task.status)).length;
    const doneBase = kpis ? kpis.pending + kpis.inProgress + kpis.completed + kpis.evaluated : 0;
    const completionRate = doneBase > 0 && kpis ? Math.round((kpis.evaluated / doneBase) * 100) : 0;

    return {
      totalTasks: tasks.length,
      dueIn48h,
      dueIn7Days,
      criticalOpen,
      openTasks,
      completionRate,
    };
  }, [kpisQuery.data, tasksQuery.data]);

  const tabBadges: Record<Tab, number | null> = {
    kanban: kpisQuery.data ? kpisQuery.data.pending + kpisQuery.data.inProgress : null,
    lista: executiveStats.totalTasks || null,
    calendario: executiveStats.dueIn7Days || null,
    reportes: kpisQuery.data ? kpisQuery.data.overdue + kpisQuery.data.rejected : null,
    config: null,
  };

  const renderContent = () => {
    switch (activeTab) {
      case 'kanban':
        return <KanbanView onOpenTask={handleOpenWorkspace} />;
      case 'lista':
        return <ListView onOpenTask={handleOpenWorkspace} />;
      case 'calendario':
        return <CalendarView onOpenTask={handleOpenWorkspace} />;
      case 'reportes':
        return <ReportsView />;
      case 'config':
        return canManage ? <SettingsView /> : null;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-brand-50 via-white to-white shadow-sm">
        <div className="flex flex-col gap-5 px-6 py-6 md:px-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
              <Icon name="briefcase" size={14} />
              Centro de Tareas
            </div>
            <h1 className="mt-3 text-2xl font-bold text-slate-900 md:text-3xl">Gestión de Tareas</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-500">
              Organiza, asigna y da seguimiento al trabajo del equipo. Arrastra, comenta, adjunta y notifica automáticamente al terminar.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveTab('reportes')}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
            >
              <Icon name="bar-chart" size={16} />
              Reportes
            </button>
            {canManage && (
              <button
                onClick={() => setShowNewTaskModal(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-500/20 transition-colors hover:bg-brand-700"
              >
                <Icon name="plus" size={16} />
                Nueva tarea
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-200/70 bg-white/50 p-4 md:grid-cols-3 lg:grid-cols-6 md:p-6">
          <StatCard label="Pendientes" value={kpisQuery.data?.pending ?? 0} tone="slate" icon="clock" />
          <StatCard label="En ejecución" value={kpisQuery.data?.inProgress ?? 0} tone="blue" icon="activity" />
          <StatCard label="Vencidas" value={kpisQuery.data?.overdue ?? 0} tone="red" icon="alert-triangle" />
          <StatCard label="Próximas 48h" value={executiveStats.dueIn48h} tone="amber" icon="calendar" />
          <StatCard label="Críticas" value={executiveStats.criticalOpen} tone="rose" icon="alert-circle" />
          <StatCard label="Cumplimiento" value={`${executiveStats.completionRate}%`} tone="emerald" icon="check-circle" />
        </div>
      </section>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {visibleTabs.map((tab) => (
            <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            title={tab.description}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all ${activeTab === tab.id
              ? 'border-brand-600 bg-brand-600 text-white shadow-sm'
              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
              }`}
          >
            <Icon name={tab.icon} size={16} />
            {tab.label}
            {tabBadges[tab.id] !== null && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                {tabBadges[tab.id]}
              </span>
            )}
          </button>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
        {renderContent()}
      </section>

      {showNewTaskModal && (
        <TaskFormModal
          onClose={() => setShowNewTaskModal(false)}
          onSuccess={() => setShowNewTaskModal(false)}
        />
      )}

      {/* Task Workspace Modal */}
      {selectedTaskId && (
        <TaskWorkspace
          taskId={selectedTaskId}
          onClose={handleCloseWorkspace}
        />
      )}
    </div>
  );
};
