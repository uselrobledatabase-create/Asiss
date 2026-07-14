/**
 * Control ASISS - Control HHEE
 * Analisis de horas extra a partir del layout oficial de HHEE.
 */

import { useMemo, useRef, useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useStaffWithShifts } from '../../asistencia2026/hooks';
import { HHEEAnalysis } from '../types';
import { analyzeHHEEFile } from '../utils/hheeAnalyzer';

export const ControlHHEEPage = () => {
    const { data: staff = [] } = useStaffWithShifts({ mode: 'ALL' }, undefined);

    const [analysis, setAnalysis] = useState<HHEEAnalysis | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [search, setSearch] = useState('');
    const [terminalFilter, setTerminalFilter] = useState('ALL');
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File | undefined) => {
        if (!file) return;
        if (!/\.(xlsx|xls|csv)$/i.test(file.name)) {
            setError('El archivo debe ser Excel (.xlsx, .xls) o CSV.');
            return;
        }

        setIsAnalyzing(true);
        setError(null);
        try {
            const result = await analyzeHHEEFile(file, staff);
            setAnalysis(result);
        } catch (e) {
            setAnalysis(null);
            setError(e instanceof Error ? e.message : 'Error al analizar el archivo.');
        } finally {
            setIsAnalyzing(false);
        }
    };

    const terminals = useMemo(() => {
        if (!analysis) return [];
        return Array.from(new Set(analysis.people.map((p) => p.terminal))).sort();
    }, [analysis]);

    const filteredPeople = useMemo(() => {
        if (!analysis) return [];
        const q = search.trim().toLowerCase();
        return analysis.people.filter((p) => {
            if (terminalFilter !== 'ALL' && p.terminal !== terminalFilter) return false;
            if (!q) return true;
            return (
                p.nombre.toLowerCase().includes(q) ||
                p.rut.toLowerCase().includes(q) ||
                p.cargo.toLowerCase().includes(q)
            );
        });
    }, [analysis, search, terminalFilter]);

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-slate-800">Control HHEE</h1>
                <p className="text-sm text-slate-500">
                    Control ASISS · Analisis de horas extra desde archivo Excel
                </p>
            </div>

            <div
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handleFile(e.dataTransfer.files?.[0]);
                }}
                onClick={() => inputRef.current?.click()}
                className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 py-10 transition-colors ${
                    dragOver
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-300 bg-white hover:border-blue-400 hover:bg-slate-50'
                }`}
            >
                <input
                    ref={inputRef}
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                    onChange={(e) => {
                        handleFile(e.target.files?.[0]);
                        e.target.value = '';
                    }}
                />
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100">
                    <Icon name="upload" size={28} className="text-blue-600" />
                </div>
                <div className="text-center">
                    <p className="font-bold text-slate-700">
                        {isAnalyzing ? 'Analizando archivo...' : 'Arrastra aqui el Excel de HHEE o haz clic para seleccionarlo'}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                        Usa el layout oficial: datos desde la fila 15, con RUT en A,
                        Nombre en B, Cargo en C y Total HHEE en S.
                    </p>
                </div>
            </div>

            {error && (
                <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                    <Icon name="x-circle" size={22} className="mt-0.5 shrink-0 text-red-600" />
                    <div>
                        <p className="font-bold text-red-800">No se pudo analizar el archivo</p>
                        <p className="text-sm text-red-700">{error}</p>
                    </div>
                </div>
            )}

            {analysis && (
                <>
                    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                            <span className="flex items-center gap-1.5">
                                <Icon name="file-text" size={14} className="text-blue-600" />
                                <b>{analysis.fileName}</b> (hoja "{analysis.sheetName}")
                            </span>
                            <span>Filas validas leidas: {analysis.rowsRead}</span>
                            <span>Personas analizadas: {analysis.people.length}</span>
                            <span>Cargos resumidos: {analysis.cargos.length}</span>
                        </div>
                        {analysis.warnings.map((warning, index) => (
                            <p key={index} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                <Icon name="alert-circle" size={14} /> {warning}
                            </p>
                        ))}
                    </div>

                    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                        <HheeKpi label="Total HHEE del periodo" value={`${analysis.totalHoras.toFixed(1)} hrs`} tone="blue" icon="clock" />
                        <HheeKpi label="Promedio por persona" value={`${analysis.promedioPersona.toFixed(1)} hrs`} tone="slate" icon="users" />
                        <HheeKpi
                            label="Sobre 40 hrs"
                            value={String(analysis.sobreLimiteCount)}
                            tone={analysis.sobreLimiteCount > 0 ? 'red' : 'green'}
                            icon="alert-triangle"
                        />
                        <HheeKpi
                            label="Criticos 60+ hrs"
                            value={String(analysis.criticoCount)}
                            tone={analysis.criticoCount > 0 ? 'red' : 'green'}
                            icon="clipboard"
                        />
                    </div>

                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="relative flex-1">
                            <Icon name="search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                placeholder="Buscar por nombre, RUT o cargo..."
                                className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                        <select
                            value={terminalFilter}
                            onChange={(e) => setTerminalFilter(e.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">Todos los terminales</option>
                            {terminals.map((terminal) => (
                                <option key={terminal} value={terminal}>
                                    {terminal}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-800 text-left text-xs uppercase text-white">
                                        <th className="px-4 py-3">#</th>
                                        <th className="px-4 py-3">Trabajador</th>
                                        <th className="px-4 py-3">RUT</th>
                                        <th className="px-4 py-3">Terminal</th>
                                        <th className="px-4 py-3">Cargo</th>
                                        <th className="px-4 py-3 text-right">Total HHEE</th>
                                        <th className="px-4 py-3 text-center">Estado</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredPeople.length === 0 && (
                                        <tr>
                                            <td colSpan={7} className="px-4 py-6 text-center text-slate-400">
                                                Sin resultados para el filtro aplicado
                                            </td>
                                        </tr>
                                    )}
                                    {filteredPeople.map((person, index) => (
                                        <tr key={person.rut} className="border-b border-slate-100 last:border-0 hover:bg-slate-50">
                                            <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
                                            <td className="px-4 py-2.5 font-semibold text-slate-800">{person.nombre}</td>
                                            <td className="px-4 py-2.5 text-slate-600">{person.rut}</td>
                                            <td className="px-4 py-2.5">
                                                <span
                                                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                                                        person.terminal === '—'
                                                            ? 'bg-slate-100 text-slate-500'
                                                            : 'bg-blue-50 text-blue-700'
                                                    }`}
                                                >
                                                    {person.terminal}
                                                </span>
                                            </td>
                                            <td className="px-4 py-2.5 text-slate-600">{person.cargo}</td>
                                            <td className="px-4 py-2.5 text-right font-bold text-slate-800">
                                                {person.totalHoras.toFixed(1)} hrs
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-bold ${estadoTone(person.estado)}`}>
                                                    {estadoLabel(person.estado)}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                        <div className="border-b border-slate-100 px-4 py-3">
                            <h2 className="text-sm font-bold text-slate-800">Resumen por cargo</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                                        <th className="px-4 py-3">Cargo</th>
                                        <th className="px-4 py-3 text-center">Personas</th>
                                        <th className="px-4 py-3 text-right">Total</th>
                                        <th className="px-4 py-3 text-right">Promedio</th>
                                        <th className="px-4 py-3">Maximo</th>
                                        <th className="px-4 py-3 text-center">40+ hrs</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {analysis.cargos.map((cargo) => (
                                        <tr key={cargo.cargo} className="border-b border-slate-100 last:border-0">
                                            <td className="px-4 py-2.5 font-semibold text-slate-800">{cargo.cargo}</td>
                                            <td className="px-4 py-2.5 text-center text-slate-600">{cargo.personas}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-slate-800">{cargo.totalHoras.toFixed(1)} hrs</td>
                                            <td className="px-4 py-2.5 text-right text-slate-600">{cargo.promedio.toFixed(1)} hrs</td>
                                            <td className="px-4 py-2.5 text-slate-600">
                                                {cargo.maxPersona} ({cargo.maximo.toFixed(1)} hrs)
                                            </td>
                                            <td className="px-4 py-2.5 text-center text-slate-600">{cargo.sobreLimite}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {analysis.excludedCargos.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                            <p className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800">
                                <Icon name="alert-circle" size={16} />
                                Registros excluidos por cargo no autorizado
                            </p>
                            <p className="text-xs text-amber-700">
                                {analysis.excludedCargos.map((item) => `${item.cargo} (${item.count})`).join(' · ')}
                            </p>
                        </div>
                    )}

                    {analysis.rutsNoEncontrados.length > 0 && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
                            <p className="mb-1 flex items-center gap-2 text-sm font-bold text-amber-800">
                                <Icon name="alert-circle" size={16} />
                                RUTs del Excel no encontrados en la dotacion activa
                            </p>
                            <p className="text-xs text-amber-700">{analysis.rutsNoEncontrados.join(' · ')}</p>
                        </div>
                    )}

                    <p className="text-xs text-slate-400">
                        Estados aplicados: OK bajo 30 hrs, Proximo entre 30 y 39,9 hrs,
                        Sobre limite desde 40 hrs y Critico desde 60 hrs.
                    </p>
                </>
            )}
        </div>
    );
};

const HHEE_TONES: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200',
    red: 'bg-red-50 text-red-700 border-red-200',
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    slate: 'bg-slate-50 text-slate-700 border-slate-200',
};

const HheeKpi = ({ label, value, tone, icon }: { label: string; value: string; tone: string; icon: any }) => (
    <div className={`flex items-center gap-3 rounded-xl border p-4 ${HHEE_TONES[tone]}`}>
        <Icon name={icon} size={26} />
        <div>
            <p className="text-xl font-bold leading-none">{value}</p>
            <p className="mt-1 text-xs font-medium opacity-80">{label}</p>
        </div>
    </div>
);

const estadoLabel = (estado: HHEEAnalysis['people'][number]['estado']) => {
    switch (estado) {
        case 'CRITICO':
            return 'Critico';
        case 'SOBRE_LIMITE':
            return 'Sobre limite';
        case 'PROXIMO':
            return 'Proximo';
        default:
            return 'OK';
    }
};

const estadoTone = (estado: HHEEAnalysis['people'][number]['estado']) => {
    switch (estado) {
        case 'CRITICO':
            return 'bg-red-100 text-red-700';
        case 'SOBRE_LIMITE':
            return 'bg-orange-100 text-orange-700';
        case 'PROXIMO':
            return 'bg-amber-100 text-amber-700';
        default:
            return 'bg-emerald-100 text-emerald-700';
    }
};
