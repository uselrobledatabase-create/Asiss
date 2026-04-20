import { useState } from 'react';
import * as XLSX from 'xlsx';
import { Icon } from '../../../shared/components/common/Icon';
import { TERMINALS } from '../../../shared/utils/terminal';
import { TerminalCode } from '../../../shared/types/terminal';
import { useInspecciones, useAllInspecciones } from '../hooks';
import { InspeccionICARow } from '../types';

// ── XLSX Export ───────────────────────────────────────────────────────────────

const exportToXLSX = (data: InspeccionICARow[]) => {
    const rows = data.map((row) => ({
        Fecha: row.fecha,
        'Hora registro': new Date(row.created_at).toLocaleTimeString('es-CL'),
        PPU: row.ppu,
        Terminal: TERMINALS[row.terminal_code as TerminalCode] ?? row.terminal_code,
        Fiscalizador: row.fiscalizador,
        Norma: row.norma,
        'C1 - Interior limpio': row.condiciones?.c1?.cumple === true ? 'CUMPLE' : row.condiciones?.c1?.cumple === false ? 'NO CUMPLE' : '-',
        'C1 - Observación': row.condiciones?.c1?.observacion || '',
        'C2 - Interior seco': row.condiciones?.c2?.cumple === true ? 'CUMPLE' : row.condiciones?.c2?.cumple === false ? 'NO CUMPLE' : '-',
        'C2 - Observación': row.condiciones?.c2?.observacion || '',
        'C3 - Cabina limpia': row.condiciones?.c3?.cumple === true ? 'CUMPLE' : row.condiciones?.c3?.cumple === false ? 'NO CUMPLE' : '-',
        'C3 - Observación': row.condiciones?.c3?.observacion || '',
        'C4 - Sin grafitis': row.condiciones?.c4?.cumple === true ? 'CUMPLE' : row.condiciones?.c4?.cumple === false ? 'NO CUMPLE' : '-',
        'C4 - Observación': row.condiciones?.c4?.observacion || '',
        'Score': `${row.score}/${row.total}`,
        Resultado: row.resultado === 'CUMPLE' ? 'CUMPLE' : 'NO CUMPLE',
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    ws['!cols'] = [
        { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 18 }, { wch: 22 }, { wch: 6 },
        { wch: 14 }, { wch: 40 },
        { wch: 14 }, { wch: 40 },
        { wch: 14 }, { wch: 40 },
        { wch: 14 }, { wch: 40 },
        { wch: 8 }, { wch: 12 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fiscalizaciones ICA');
    XLSX.writeFile(wb, `fiscalizacion_ica_${new Date().toISOString().slice(0, 10)}.xlsx`);
};

// ── HistoryTab ────────────────────────────────────────────────────────────────

export const HistoryTab = () => {
    const [search, setSearch] = useState('');
    const [terminalFilter, setTerminalFilter] = useState('');
    const [exporting, setExporting] = useState(false);

    const { data = [], isLoading, error } = useInspecciones({
        ppu: search || undefined,
        terminal_code: terminalFilter || undefined,
    });

    const allQuery = useAllInspecciones();

    const handleExport = async () => {
        setExporting(true);
        try {
            const allData = allQuery.data ?? await allQuery.refetch().then((r) => r.data ?? []);
            exportToXLSX(allData as InspeccionICARow[]);
        } finally {
            setExporting(false);
        }
    };

    return (
        <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Buscar por PPU..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value.toUpperCase())}
                        className="input pl-9 font-mono uppercase"
                    />
                </div>
                <select
                    value={terminalFilter}
                    onChange={(e) => setTerminalFilter(e.target.value)}
                    className="input sm:w-56"
                >
                    <option value="">Todos los terminales</option>
                    {Object.entries(TERMINALS).map(([code, name]) => (
                        <option key={code} value={code}>{name}</option>
                    ))}
                </select>

                {/* Export button */}
                <button
                    onClick={handleExport}
                    disabled={exporting || allQuery.isLoading}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex-shrink-0"
                >
                    <Icon name="download" size={15} />
                    {exporting ? 'Exportando...' : 'Exportar XLSX'}
                </button>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Icon name="loader" size={24} className="animate-spin text-blue-600" />
                        <p className="text-sm text-slate-500">Cargando historial...</p>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3 px-6 text-center">
                        <Icon name="alert-circle" size={32} className="text-red-400" />
                        <div>
                            <p className="text-sm font-semibold text-red-600">No se pudo cargar el historial</p>
                            <p className="text-xs text-slate-500 mt-1">
                                Asegúrate de ejecutar la migración SQL en el dashboard de Supabase.
                            </p>
                        </div>
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 gap-3">
                        <Icon name="clipboard" size={36} className="text-slate-300" />
                        <p className="text-sm text-slate-500">No hay registros para esta búsqueda.</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop table */}
                        <div className="hidden sm:block overflow-x-auto">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        {['Fecha', 'PPU', 'Terminal', 'Fiscalizador', 'Score', 'Resultado'].map((h) => (
                                            <th key={h} className="px-5 py-3.5 text-xs font-bold text-slate-500 uppercase tracking-wide">
                                                {h}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {data.map((row) => (
                                        <tr key={row.id} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-5 py-3.5 text-sm text-slate-600">{row.fecha}</td>
                                            <td className="px-5 py-3.5 text-sm font-bold font-mono text-slate-900">{row.ppu}</td>
                                            <td className="px-5 py-3.5 text-sm text-slate-600">
                                                {TERMINALS[row.terminal_code as TerminalCode] ?? row.terminal_code}
                                            </td>
                                            <td className="px-5 py-3.5 text-sm text-slate-600">{row.fiscalizador}</td>
                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center justify-center w-10 h-8 rounded-lg text-xs font-bold ${row.score === row.total ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {row.score}/{row.total}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3.5">
                                                <ResultadoBadge resultado={row.resultado} />
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile cards */}
                        <div className="sm:hidden divide-y divide-slate-100">
                            {data.map((row) => (
                                <div key={row.id} className="p-4">
                                    <div className="flex justify-between items-start mb-1.5">
                                        <span className="font-mono font-bold text-slate-900 text-base">{row.ppu}</span>
                                        <ResultadoBadge resultado={row.resultado} />
                                    </div>
                                    <div className="text-xs text-slate-500 space-y-0.5">
                                        <div>{row.fecha} · {TERMINALS[row.terminal_code as TerminalCode] ?? row.terminal_code}</div>
                                        <div>{row.fiscalizador} · Score: {row.score}/{row.total}</div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </div>

            {!isLoading && !error && data.length > 0 && (
                <p className="text-xs text-slate-400 text-right">
                    {data.length} registro{data.length !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
};

const ResultadoBadge = ({ resultado }: { resultado: 'CUMPLE' | 'NO_CUMPLE' }) => (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border ${resultado === 'CUMPLE'
        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
        : 'bg-red-50 text-red-700 border-red-200'
        }`}>
        {resultado === 'CUMPLE'
            ? <Icon name="check-circle" size={11} />
            : <Icon name="x-circle" size={11} />
        }
        {resultado === 'CUMPLE' ? 'CUMPLE' : 'NO CUMPLE'}
    </span>
);
