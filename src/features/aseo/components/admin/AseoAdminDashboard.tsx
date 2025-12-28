import { useQuery } from '@tanstack/react-query';
import { Icon } from '../../../../shared/components/common/Icon';
import { fetchAseoRecords, fetchAllCleaners, fetchAllTasks } from '../../api/aseoApi';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Stats {
    totalRecordsToday: number;
    totalRecordsWeek: number;
    totalRecords: number;
    activeCleaners: number;
    pendingTasks: number;
    completedTasks: number;
    byTerminal: Record<string, number>;
    byType: Record<string, number>;
    weeklyTrend: Array<{ day: string; count: number }>;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4'];

const TERMINAL_COLORS: Record<string, string> = {
    'EL_ROBLE': '#3b82f6',
    'LA_REINA': '#8b5cf6',
    'MARIA_ANGELICA': '#10b981',
    'EL_DESCANSO': '#f59e0b',
    'TAREA': '#ec4899'
};

export const AseoAdminDashboard = () => {
    const { data: records = [] } = useQuery({
        queryKey: ['aseo', 'records'],
        queryFn: () => fetchAseoRecords(),
        refetchInterval: 5000 // Auto-refresh every 5 seconds
    });

    const { data: cleaners = [] } = useQuery({
        queryKey: ['aseo', 'cleaners'],
        queryFn: fetchAllCleaners,
        refetchInterval: 10000 // Auto-refresh every 10 seconds
    });

    const { data: tasks = [] } = useQuery({
        queryKey: ['aseo', 'all-tasks'],
        queryFn: () => fetchAllTasks(),
        refetchInterval: 5000 // Auto-refresh every 5 seconds
    });

    const today = new Date();
    const todayStr = today.toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Calculate weekly trend
    const weeklyTrend = [];
    const dayNames = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    for (let i = 6; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const count = records.filter((r: any) => r.created_at.startsWith(dateStr)).length;
        weeklyTrend.push({
            day: dayNames[date.getDay()],
            count
        });
    }

    const stats: Stats = {
        totalRecordsToday: records.filter((r: any) => r.created_at.startsWith(todayStr)).length,
        totalRecordsWeek: records.filter((r: any) => r.created_at >= weekAgo).length,
        totalRecords: records.length,
        activeCleaners: cleaners.length,
        pendingTasks: tasks.filter((t: any) => t.status === 'PENDIENTE').length,
        completedTasks: tasks.filter((t: any) => t.status === 'TERMINADA').length,
        byTerminal: records.reduce((acc: Record<string, number>, r: any) => {
            acc[r.terminal_code] = (acc[r.terminal_code] || 0) + 1;
            return acc;
        }, {}),
        byType: records.reduce((acc: Record<string, number>, r: any) => {
            acc[r.cleaning_type] = (acc[r.cleaning_type] || 0) + 1;
            return acc;
        }, {}),
        weeklyTrend
    };

    const kpis = [
        { label: 'Registros Hoy', value: stats.totalRecordsToday, icon: 'calendar' as const, color: 'from-blue-500 to-indigo-600', textColor: 'text-blue-600', bgColor: 'bg-blue-50' },
        { label: 'Registros Semana', value: stats.totalRecordsWeek, icon: 'bar-chart' as const, color: 'from-purple-500 to-pink-600', textColor: 'text-purple-600', bgColor: 'bg-purple-50' },
        { label: 'Limpiadores', value: stats.activeCleaners, icon: 'users' as const, color: 'from-emerald-500 to-teal-600', textColor: 'text-emerald-600', bgColor: 'bg-emerald-50' },
        { label: 'Tareas Pendientes', value: stats.pendingTasks, icon: 'clock' as const, color: 'from-amber-500 to-orange-600', textColor: 'text-amber-600', bgColor: 'bg-amber-50' },
        { label: 'Tareas Completadas', value: stats.completedTasks, icon: 'check-circle' as const, color: 'from-green-500 to-emerald-600', textColor: 'text-green-600', bgColor: 'bg-green-50' },
        { label: 'Total Registros', value: stats.totalRecords, icon: 'file-text' as const, color: 'from-slate-500 to-gray-600', textColor: 'text-slate-600', bgColor: 'bg-slate-50' },
    ];

    // Prepare chart data
    const terminalData = Object.entries(stats.byTerminal).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value,
        color: TERMINAL_COLORS[name] || '#94a3b8'
    }));

    const typeData = Object.entries(stats.byType).map(([name, value]) => ({
        name: name.replace(/_/g, ' '),
        value
    }));

    // Recent activity
    const recentRecords = records.slice(0, 5);

    const formatTimeAgo = (dateStr: string) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `Hace ${diffMins}m`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `Hace ${diffHours}h`;
        const diffDays = Math.floor(diffHours / 24);
        return `Hace ${diffDays}d`;
    };

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {kpis.map((kpi, i) => (
                    <div
                        key={i}
                        className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden border border-slate-200 hover:scale-105"
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${kpi.color} opacity-0 group-hover:opacity-5 transition-opacity`} />
                        <div className="relative p-5">
                            <div className="flex items-start justify-between mb-3">
                                <div className={`w-11 h-11 ${kpi.bgColor} rounded-xl flex items-center justify-center shadow-sm`}>
                                    <Icon name={kpi.icon} size={22} className={kpi.textColor} />
                                </div>
                            </div>
                            <div className="text-3xl font-black text-slate-900 mb-1">{kpi.value}</div>
                            <div className="text-xs font-semibold text-slate-600">{kpi.label}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Weekly Trend */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center">
                            <Icon name="bar-chart" size={18} className="text-white" />
                        </div>
                        Tendencia Semanal
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <LineChart data={stats.weeklyTrend}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis dataKey="day" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#64748b" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                                labelStyle={{ fontWeight: 'bold' }}
                            />
                            <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#3b82f6', r: 5 }} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>

                {/* Terminal Distribution */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center">
                            <Icon name="users" size={18} className="text-white" />
                        </div>
                        Por Terminal
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <PieChart>
                            <Pie
                                data={terminalData}
                                cx="50%"
                                cy="50%"
                                labelLine={false}
                                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                outerRadius={80}
                                fill="#8884d8"
                                dataKey="value"
                            >
                                {terminalData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                ))}
                            </Pie>
                            <Tooltip />
                        </PieChart>
                    </ResponsiveContainer>
                </div>

                {/* Type Distribution */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center">
                            <Icon name="layers" size={18} className="text-white" />
                        </div>
                        Tipos de Limpieza
                    </h3>
                    <ResponsiveContainer width="100%" height={250}>
                        <BarChart data={typeData} layout="vertical">
                            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                            <XAxis type="number" stroke="#64748b" style={{ fontSize: '12px' }} />
                            <YAxis dataKey="name" type="category" stroke="#64748b" style={{ fontSize: '12px' }} width={120} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px' }}
                            />
                            <Bar dataKey="value" fill="#8b5cf6" radius={[0, 8, 8, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Recent Activity */}
                <div className="bg-white rounded-2xl shadow-lg p-6 border border-slate-200">
                    <h3 className="text-lg font-black text-slate-900 mb-4 flex items-center gap-3">
                        <div className="w-9 h-9 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center">
                            <Icon name="activity" size={18} className="text-white" />
                        </div>
                        Actividad Reciente
                    </h3>
                    <div className="space-y-3">
                        {recentRecords.length > 0 ? recentRecords.map((record: any) => (
                            <div key={record.id} className="flex items-center gap-3 py-2 border-b border-slate-100 last:border-0">
                                <img
                                    src={record.photo_url}
                                    alt={record.bus_code}
                                    className="w-12 h-12 rounded-lg object-cover shadow-sm"
                                />
                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-sm text-slate-900 truncate">{record.bus_code}</p>
                                    <p className="text-xs text-slate-500 truncate">{record.cleaner_name}</p>
                                </div>
                                <div className="text-right">
                                    <span className="text-xs font-semibold text-slate-400">
                                        {formatTimeAgo(record.created_at)}
                                    </span>
                                </div>
                            </div>
                        )) : (
                            <div className="text-center py-8 text-slate-400">
                                <Icon name="inbox" size={40} className="mx-auto mb-2 opacity-30" />
                                <p className="text-sm font-semibold">No hay actividad reciente</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
