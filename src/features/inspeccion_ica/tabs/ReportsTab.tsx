import React from 'react';
import { BarChart, Activity, AlertTriangle, CheckSquare } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

export const ReportsTab: React.FC = () => {
    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    label="Inspecciones Hoy"
                    value="12"
                    icon={Activity}
                    trend="+20%"
                    trendUp={true}
                />
                <StatCard
                    label="Promedio Score"
                    value="8.5"
                    icon={BarChart}
                    color="text-blue-500"
                />
                <StatCard
                    label="Aprobados"
                    value="10"
                    icon={CheckSquare}
                    color="text-green-500"
                />
                <StatCard
                    label="Rechazados"
                    value="2"
                    icon={AlertTriangle}
                    color="text-red-500"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <GlassCard title="Defectos por Categoría">
                    {/* Mock Chart Visualization */}
                    <div className="space-y-4 pt-2">
                        <ChartBar label="Limpieza Exterior" percent={45} color="bg-blue-500" />
                        <ChartBar label="Estado de Asientos" percent={30} color="bg-indigo-500" />
                        <ChartBar label="Iluminación" percent={15} color="bg-violet-500" />
                        <ChartBar label="Otros" percent={10} color="bg-slate-400" />
                    </div>
                </GlassCard>

                <GlassCard title="Evolución Semanal">
                    {/* Mock Line Chart */}
                    <div className="h-48 flex items-end justify-between gap-2 pt-4 px-2">
                        {[40, 65, 45, 80, 55, 90, 75].map((h, i) => (
                            <div key={i} className="w-full bg-slate-100 dark:bg-slate-700 rounded-t-lg relative group">
                                <div
                                    className="absolute bottom-0 left-0 right-0 bg-blue-500/80 rounded-t-lg transition-all hover:bg-blue-500"
                                    style={{ height: `${h}%` }}
                                />
                            </div>
                        ))}
                    </div>
                    <div className="flex justify-between mt-2 text-xs text-slate-400 uppercase font-medium">
                        <span>Lun</span><span>Mar</span><span>Mie</span><span>Jue</span><span>Vie</span><span>Sab</span><span>Dom</span>
                    </div>
                </GlassCard>
            </div>
        </div>
    );
};

// Helper Components
const StatCard = ({ label, value, icon: Icon, trend, trendUp, color = 'text-slate-800 dark:text-white' }: any) => (
    <GlassCard className="!p-5">
        <div className="flex justify-between items-start">
            <div>
                <p className="text-sm font-medium text-slate-500">{label}</p>
                <h4 className={`text-2xl font-bold mt-1 ${color}`}>{value}</h4>
                {trend && (
                    <span className={`text-xs font-semibold ${trendUp ? 'text-green-500' : 'text-red-500'}`}>
                        {trend} vs ayer
                    </span>
                )}
            </div>
            <div className="p-2 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                <Icon className="w-5 h-5 text-slate-400" />
            </div>
        </div>
    </GlassCard>
);

const ChartBar = ({ label, percent, color }: any) => (
    <div className="space-y-1">
        <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-300">{label}</span>
            <span className="font-semibold text-slate-700 dark:text-white">{percent}%</span>
        </div>
        <div className="h-2 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
            <div className={`h-full ${color}`} style={{ width: `${percent}%` }} />
        </div>
    </div>
);
