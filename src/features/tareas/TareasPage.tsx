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
        return <SettingsView />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 px-6 py-6 md:px-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-100">
                <Icon name="briefcase" size={14} />
                Centro Operativo
              </div>
              <h1 className="mt-3 text-2xl font-bold text-white md:text-3xl">Gestión Empresarial de Tareas</h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-300">
                Seguimiento por prioridad, control de vencimientos y ejecución diaria con foco en cumplimiento operacional.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveTab('reportes')}
                className="inline-flex items-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Icon name="bar-chart" size={16} />
                Reportes
              </button>
              {canManage && (
                <button
                  onClick={() => setShowNewTaskModal(true)}
                  className="inline-flex items-center gap-2 rounded-lg bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-brand-500/20 transition-colors hover:bg-brand-600"
                >
                  <Icon name="plus" size={16} />
                  Nueva tarea
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 border-t border-slate-200 bg-slate-50 p-4 md:grid-cols-4 md:p-6">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Pendientes</div>
            <div className="mt-1 text-2xl font-bold text-slate-900">{kpisQuery.data?.pending ?? 0}</div>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-blue-700">En ejecución</div>
            <div className="mt-1 text-2xl font-bold text-blue-900">{kpisQuery.data?.inProgress ?? 0}</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Vencidas</div>
            <div className="mt-1 text-2xl font-bold text-red-900">{kpisQuery.data?.overdue ?? 0}</div>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Cumplimiento</div>
            <div className="mt-1 text-2xl font-bold text-emerald-900">{executiveStats.completionRate}%</div>
          </div>
        </div>

        <div className="grid gap-3 border-t border-slate-200 bg-white p-4 md:grid-cols-3 md:p-6">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Carga activa</div>
            <div className="mt-2 text-xl font-bold text-slate-900">{executiveStats.openTasks} tareas abiertas</div>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">Próximas 48h</div>
            <div className="mt-2 text-xl font-bold text-amber-900">{executiveStats.dueIn48h} por vencer</div>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-red-700">Riesgo crítico</div>
            <div className="mt-2 text-xl font-bold text-red-900">{executiveStats.criticalOpen} críticas abiertas</div>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-xl border p-4 text-left transition-all ${activeTab === tab.id
              ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:shadow-sm'
              }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className={`rounded-lg p-2 ${activeTab === tab.id ? 'bg-white/15 text-white' : 'bg-slate-100 text-slate-700'}`}>
                <Icon name={tab.icon} size={18} />
              </div>
              {tabBadges[tab.id] !== null && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${activeTab === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'}`}>
                  {tabBadges[tab.id]}
                </span>
              )}
            </div>
            <div className="mt-3 text-sm font-semibold">{tab.label}</div>
            <p className={`mt-1 text-xs ${activeTab === tab.id ? 'text-slate-200' : 'text-slate-500'}`}>{tab.description}</p>
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
