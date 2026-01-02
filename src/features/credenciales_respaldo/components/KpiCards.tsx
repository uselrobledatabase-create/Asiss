import { CreditCard, Clock, AlertTriangle, TrendingUp, DollarSign } from 'lucide-react';
import { BackupKpis, INVENTORY_TERMINALS } from '../types';

interface Props {
    kpis: BackupKpis;
    isLoading?: boolean;
}

interface KpiCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: React.ReactNode;
    colorClass?: string;
}

const KpiCard = ({ title, value, subtitle, icon, colorClass = 'bg-slate-50 text-slate-600' }: KpiCardProps) => (
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex items-start justify-between">
            <div>
                <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">{title}</p>
                <p className="text-2xl font-bold text-slate-900 mt-1">{value}</p>
                {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
            </div>
            <div className={`p-2 rounded-lg ${colorClass}`}>
                {icon}
            </div>
        </div>
    </div>
);

export const KpiCards = ({ kpis, isLoading }: Props) => {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-24 mb-2" />
                        <div className="h-8 bg-slate-200 rounded w-16" />
                    </div>
                ))}
            </div>
        );
    }

    const totalAvailable = INVENTORY_TERMINALS.reduce(
        (sum, terminal) => sum + (kpis.availableByTerminal[terminal] || 0),
        0
    );

    const availableSubtitle = INVENTORY_TERMINALS
        .map((t) => `${t.split(' ')[0]}: ${kpis.availableByTerminal[t] || 0}`)
        .join(' | ');

    return (

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            <KpiCard
                title="Disponibles"
                value={totalAvailable}
                subtitle={availableSubtitle}
                icon={<CreditCard className="w-5 h-5" />}
                colorClass="bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100"
            />
            <KpiCard
                title="Prestamos Activos"
                value={kpis.activeLoans}
                icon={<Clock className="w-5 h-5" />}
                colorClass="bg-blue-50 text-blue-600 ring-1 ring-blue-100"
            />
            <KpiCard
                title="Atrasados (+7d)"
                value={kpis.overdueLoans}
                icon={<AlertTriangle className="w-5 h-5" />}
                colorClass={kpis.overdueLoans > 0 ? 'bg-amber-50 text-amber-600 ring-1 ring-amber-100' : 'bg-slate-50 text-slate-400 ring-1 ring-slate-100'}
            />
            <KpiCard
                title="Tiempo Promedio"
                value={`${kpis.avgReturnDays} dias`}
                subtitle="Ultimos 30 dias"
                icon={<TrendingUp className="w-5 h-5" />}
                colorClass="bg-indigo-50 text-indigo-600 ring-1 ring-indigo-100"
            />
            <KpiCard
                title="Descuentos"
                value={`$${kpis.totalDiscounts.toLocaleString('es-CL')}`}
                icon={<DollarSign className="w-5 h-5" />}
                colorClass="bg-violet-50 text-violet-600 ring-1 ring-violet-100"
            />
        </div>
    );
};
