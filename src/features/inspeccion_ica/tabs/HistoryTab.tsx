import React, { useState } from 'react';
import { Search, Filter, Eye, AlertCircle, CheckCircle } from 'lucide-react';
import { GlassCard } from '../components/ui/GlassCard';

// Mock Data
const MOCK_HISTORY = [
    { id: '1', fecha: '2024-01-08 14:30', ppu: 'ABCD-12', fiscalizador: 'Juan Pérez', score: 10, status: 'APROBADO' },
    { id: '2', fecha: '2024-01-08 11:15', ppu: 'WX-4567', fiscalizador: 'Maria Diaz', score: 7, status: 'RECHAZADO' },
    { id: '3', fecha: '2024-01-07 09:00', ppu: 'ZZ-9988', fiscalizador: 'Juan Pérez', score: 9, status: 'APROBADO' },
    { id: '4', fecha: '2024-01-07 08:30', ppu: 'TR-1122', fiscalizador: 'Pedro Soto', score: 6, status: 'RECHAZADO' },
];

export const HistoryTab: React.FC = () => {
    const [searchTerm, setSearchTerm] = useState('');

    const filteredData = MOCK_HISTORY.filter(
        item => item.ppu.toLowerCase().includes(searchTerm.toLowerCase()) ||
            item.fiscalizador.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6 animate-in fade-in duration-500">

            {/* Actions Bar */}
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
                <div className="relative w-full md:w-96">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
                    <input
                        type="text"
                        placeholder="Buscar por Patente o Fiscalizador..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    />
                </div>
                <button className="flex items-center gap-2 px-4 py-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                    <Filter className="w-4 h-4" />
                    <span>Filtros</span>
                </button>
            </div>

            {/* Table */}
            <GlassCard className="!p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Fecha</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">PPU</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Fiscalizador</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-center">Score</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider">Estado</th>
                                <th className="p-4 text-xs font-semibold uppercase text-slate-500 tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                            {filteredData.map((item) => (
                                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                                    <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{item.fecha}</td>
                                    <td className="p-4 text-sm font-bold text-slate-800 dark:text-white font-mono">{item.ppu}</td>
                                    <td className="p-4 text-sm text-slate-600 dark:text-slate-300">{item.fiscalizador}</td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-sm ${item.score >= 8 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                                                'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}>
                                            {item.score}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${item.status === 'APROBADO'
                                                ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border border-green-200 dark:border-green-800'
                                                : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border border-red-200 dark:border-red-800'
                                            }`}>
                                            {item.status === 'APROBADO' ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                                            {item.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-right">
                                        <button className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-all">
                                            <Eye className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredData.length === 0 && (
                    <div className="p-12 text-center text-slate-400">
                        No se encontraron registros para tu búsqueda.
                    </div>
                )}
            </GlassCard>
        </div>
    );
};
