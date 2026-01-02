import { useStaffCounts } from '../hooks';
import { TerminalContext } from '../../../shared/types/terminal';
import { STAFF_CARGOS, StaffCargo } from '../types';
import { displayTerminal } from '../../../shared/utils/terminal';
import { Icon, IconName } from '../../../shared/components/common/Icon';

interface Props {
    terminalContext: TerminalContext;
}

const getCargoIcon = (cargo: StaffCargo): IconName => {
    const icons: Record<StaffCargo, IconName> = {
        conductor: 'calendar',
        inspector_patio: 'clipboard',
        cleaner: 'check-circle',
        planillero: 'layers',
        supervisor: 'users',
    };
    return icons[cargo] || 'users';
};

const getCargoLabel = (cargo: StaffCargo): string => {
    return STAFF_CARGOS.find((c) => c.value === cargo)?.label || cargo;
};

export const StaffCounters = ({ terminalContext }: Props) => {
    const { data: counts, isLoading } = useStaffCounts(terminalContext);

    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
                {[...Array(5)].map((_, i) => (
                    <div key={i} className="card p-4 animate-pulse">
                        <div className="h-4 bg-slate-200 rounded w-20 mb-2" />
                        <div className="h-8 bg-slate-200 rounded w-16" />
                    </div>
                ))}
            </div>
        );
    }

    if (!counts) return null;

    // Check if we should show ER-LR consolidated
    const showErLr =
        terminalContext.mode === 'ALL' ||
        (terminalContext.mode === 'TERMINAL' &&
            (terminalContext.value === 'EL_ROBLE' || terminalContext.value === 'LA_REINA'));

    return (
        <div className="space-y-4 mb-6">
            {/* Counters by Cargo */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Personal por Cargo {showErLr && '(ER-LR)'}
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
                    {counts.byCargo.map((item) => {
                        const effectiveCount = item.effective_count;
                        const isOverQ = item.max_q && effectiveCount > item.max_q;
                        const isAtOrBelowQ = item.max_q && effectiveCount <= item.max_q;
                        const percentage = item.max_q ? (effectiveCount / item.max_q) * 100 : 0;

                        return (
                            <div
                                key={item.cargo}
                                className={`card p-4 transition-all ${isOverQ
                                    ? 'border-red-300 bg-red-50'
                                    : isAtOrBelowQ
                                        ? 'border-green-300 bg-green-50'
                                        : ''
                                    }`}
                            >
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
                                        <Icon name={getCargoIcon(item.cargo)} size={18} className="text-slate-600" />
                                    </div>
                                    <span className="text-xs font-semibold text-slate-600 uppercase">
                                        {getCargoLabel(item.cargo)}
                                    </span>
                                </div>
                                <div className="flex items-baseline gap-1">
                                    <span
                                        className={`text-2xl font-bold ${isOverQ ? 'text-red-600' : isAtOrBelowQ ? 'text-green-600' : 'text-slate-900'
                                            }`}
                                    >
                                        {effectiveCount}
                                    </span>
                                    {item.max_q && (
                                        <span className="text-sm text-slate-500">/ {item.max_q}</span>
                                    )}
                                </div>
                                {/* Simplified mini report - only show if there are suspended */}
                                {item.suspended > 0 && (
                                    <div className="mt-2 text-xs text-slate-600 space-y-0.5">
                                        <div>Total: {item.count}</div>
                                        <div>Suspendidos: {item.suspended}</div>
                                        <div className="font-semibold pt-0.5 border-t border-slate-200">
                                            Efectivo: {effectiveCount}
                                        </div>
                                    </div>
                                )}
                                {item.max_q && (
                                    <div className="mt-2 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${isOverQ ? 'bg-red-500' : 'bg-green-500'
                                                }`}
                                            style={{ width: `${Math.min(percentage, 100)}%` }}
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Counters by Terminal */}
            <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">
                    Personal por Terminal
                </h3>
                <div className="flex flex-wrap gap-3">
                    {counts.byTerminal.map((item) => (
                        <div key={item.terminal_code} className="card px-4 py-3 flex items-center gap-3">
                            <Icon name="building" size={18} className="text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">{displayTerminal(item.terminal_code)}</p>
                                <p className="text-lg font-bold text-slate-900">{item.count}</p>
                            </div>
                        </div>
                    ))}
                    <div className="card px-4 py-3 flex items-center gap-3 bg-brand-50 border-brand-200">
                        <Icon name="users" size={18} className="text-brand-600" />
                        <div>
                            <p className="text-xs text-brand-600 font-semibold">Total</p>
                            <p className="text-lg font-bold text-brand-700">{counts.total}</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
