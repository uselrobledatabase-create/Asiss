/**
 * DayActionPanel - Modal central para marcar asistencia de un día
 * (presente/ausente, licencia e incidencias relacionadas)
 */

import { useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { useSessionStore } from '../../../shared/state/sessionStore';
import { useAutoAdmonition } from '../hooks/useAutoAdmonition';
import { StaffWithShift, AttendanceMarkType, IncidenceCode } from '../types';
import { formatDayOfWeek } from '../utils/shiftEngine';

interface DayActionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    staff: StaffWithShift | null;
    date: string;
    currentMark?: AttendanceMarkType | null;
    currentNote?: string;
    incidencies?: IncidenceCode[];
    onMarkPresent: () => void;
    onMarkAbsent: (note: string) => void;
    onRegisterLicense: (startDate: string, endDate: string, note?: string) => void;
    onRegisterPermission: (startDate: string, endDate: string, type: string, note?: string) => void;
    onRegisterVacation: () => void;
    onRequestOffboarding?: () => void;
    isManager?: boolean;
}

const INCIDENCE_LABELS: Record<IncidenceCode, { label: string; cls: string }> = {
    NM: { label: 'No Marcación', cls: 'bg-yellow-100 text-yellow-800 border-yellow-200' },
    NC: { label: 'Sin Credencial', cls: 'bg-orange-100 text-orange-800 border-orange-200' },
    CD: { label: 'Cambio de Día', cls: 'bg-blue-100 text-blue-800 border-blue-200' },
    AUT: { label: 'Autorización', cls: 'bg-green-100 text-green-800 border-green-200' },
};

export const DayActionPanel = ({
    isOpen,
    onClose,
    staff,
    date,
    currentMark,
    currentNote,
    incidencies = [],
    onMarkPresent,
    onMarkAbsent,
    onRegisterLicense,
}: DayActionPanelProps) => {
    const session = useSessionStore((s) => s.session);
    const autoAdmonition = useAutoAdmonition();
    const [activeForm, setActiveForm] = useState<'none' | 'license' | 'absent_confirm'>('none');
    const [licenseStart, setLicenseStart] = useState(date);
    const [licenseEnd, setLicenseEnd] = useState(date);
    const [licenseNote, setLicenseNote] = useState('');

    if (!isOpen || !staff) return null;

    const dayOfWeek = formatDayOfWeek(date);
    const dateLabel = `${dayOfWeek} ${date.split('-').reverse().join('-')}`;
    const isDesvinculado = staff.status === 'DESVINCULADO';
    const initials = staff.nombre
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();

    const handleClose = () => {
        setActiveForm('none');
        onClose();
    };

    const handleRegisterLicense = () => {
        onRegisterLicense(licenseStart, licenseEnd, licenseNote || undefined);
        setLicenseNote('');
        setActiveForm('none');
    };

    const handleConfirmAbsent = async (isJustified: boolean) => {
        if (isJustified) {
            onMarkAbsent('Justificado');
            setActiveForm('none');
        } else {
            if (!session) return;
            try {
                // Generar y subir la amonestación automática (Código 24)
                const pdfUrl = await autoAdmonition.mutateAsync({
                    staff,
                    supervisorName: session.supervisorName,
                    date,
                    timeRange: staff.horario
                });

                onMarkAbsent('Ausencia Injustificada');
                setActiveForm('none');

                window.open(pdfUrl, '_blank');
            } catch (error) {
                console.error(error);
                alert('Hubo un error al generar la amonestación. Intente nuevamente.');
            }
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
            onClick={handleClose}
        >
            <div
                className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                {/* ===== Header ===== */}
                <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4">
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-sm font-bold text-white">
                                {initials}
                            </div>
                            <div className="min-w-0">
                                <h3 className="truncate font-bold text-white">{staff.nombre}</h3>
                                <p className="truncate text-xs text-slate-300">
                                    {staff.rut} · {staff.cargo}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleClose}
                            className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-white/10 hover:text-white"
                        >
                            <Icon name="x" size={18} />
                        </button>
                    </div>
                    {/* Fecha */}
                    <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-1.5">
                        <Icon name="calendar" size={14} className="text-brand-300" />
                        <span className="text-xs font-bold capitalize text-white">{dateLabel}</span>
                        {staff.horario && (
                            <span className="text-xs text-slate-300">· {staff.horario}</span>
                        )}
                    </div>
                </div>

                {/* ===== Contenido ===== */}
                <div className="max-h-[60vh] space-y-5 overflow-y-auto p-5">
                    {isDesvinculado && (
                        <div className="flex items-center gap-2.5 rounded-xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-600">
                            <Icon name="alert-triangle" size={16} className="shrink-0" />
                            Este trabajador está desvinculado. No se permiten nuevas marcaciones.
                        </div>
                    )}

                    {/* Marca actual */}
                    {currentMark && (
                        <div className={`flex items-center gap-2.5 rounded-xl border px-4 py-3 ${currentMark === 'P'
                            ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                            }`}>
                            <Icon name={currentMark === 'P' ? 'check-circle' : 'x-circle'} size={20} className="shrink-0" />
                            <div>
                                <p className="text-sm font-bold">
                                    Ya registrado: {currentMark === 'P' ? 'Presente' : 'Ausente'}
                                </p>
                                {currentNote && <p className="text-xs opacity-75">{currentNote}</p>}
                            </div>
                        </div>
                    )}

                    {/* Acciones rápidas */}
                    {!isDesvinculado && activeForm === 'none' && (
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Marcar asistencia
                            </p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => onMarkPresent()}
                                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-emerald-200 bg-emerald-50 py-4 transition-all hover:border-emerald-400 hover:bg-emerald-100"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500">
                                        <Icon name="check" size={18} className="text-white" />
                                    </span>
                                    <span className="text-sm font-bold text-emerald-800">Presente</span>
                                </button>
                                <button
                                    onClick={() => setActiveForm('absent_confirm')}
                                    className="flex flex-col items-center gap-1.5 rounded-xl border-2 border-red-200 bg-red-50 py-4 transition-all hover:border-red-400 hover:bg-red-100"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-red-500">
                                        <Icon name="x" size={18} className="text-white" />
                                    </span>
                                    <span className="text-sm font-bold text-red-800">Ausente</span>
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Confirmación de ausencia */}
                    {activeForm === 'absent_confirm' && (
                        <div className="space-y-3 rounded-xl border border-rose-200 bg-rose-50 p-4">
                            <div className="flex items-center gap-2 text-rose-800">
                                <Icon name="alert-circle" size={20} />
                                <h4 className="font-bold">Confirmar Ausencia</h4>
                            </div>
                            <p className="text-sm font-medium text-rose-700">
                                ¿La ausencia de este trabajador está justificada?
                            </p>
                            <p className="text-xs leading-snug text-rose-600/80">
                                Si indica "No", se generará e imprimirá automáticamente una
                                amonestación por falta grave (Código 24).
                            </p>

                            <div className="mt-2 flex flex-col gap-2">
                                <button
                                    onClick={() => handleConfirmAbsent(true)}
                                    className="w-full rounded-xl border-2 border-rose-200 bg-white py-2.5 font-bold text-rose-700 transition-colors hover:bg-rose-100"
                                >
                                    Sí, está justificada
                                </button>
                                <button
                                    onClick={() => handleConfirmAbsent(false)}
                                    disabled={autoAdmonition.isPending}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 py-2.5 font-bold text-white transition-colors hover:bg-rose-700 disabled:opacity-50"
                                >
                                    <Icon
                                        name={autoAdmonition.isPending ? 'loader' : 'file-text'}
                                        size={16}
                                        className={autoAdmonition.isPending ? 'animate-spin' : ''}
                                    />
                                    No, generar amonestación
                                </button>
                                <button
                                    onClick={() => setActiveForm('none')}
                                    disabled={autoAdmonition.isPending}
                                    className="w-full rounded-xl py-2 text-sm font-medium text-slate-500 transition-colors hover:bg-slate-100"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Registrar licencia */}
                    {!isDesvinculado && activeForm === 'none' && (
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Registrar
                            </p>
                            <button
                                onClick={() => setActiveForm('license')}
                                className="flex w-full items-center justify-between rounded-xl border-2 border-purple-200 bg-purple-50 px-4 py-3 transition-all hover:border-purple-400 hover:bg-purple-100"
                            >
                                <span className="flex items-center gap-2.5">
                                    <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-purple-500">
                                        <Icon name="file-text" size={15} className="text-white" />
                                    </span>
                                    <span className="text-sm font-bold text-purple-800">Licencia Médica</span>
                                </span>
                                <Icon name="chevron-right" size={16} className="text-purple-400" />
                            </button>
                        </div>
                    )}

                    {/* Formulario de licencia */}
                    {activeForm === 'license' && (
                        <div className="space-y-3 rounded-xl border border-purple-200 bg-purple-50 p-4">
                            <div className="flex items-center gap-2 text-purple-800">
                                <Icon name="file-text" size={18} />
                                <h4 className="font-bold">Registrar Licencia</h4>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Desde</label>
                                    <input
                                        type="date"
                                        value={licenseStart}
                                        onChange={(e) => setLicenseStart(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                                <div>
                                    <label className="mb-1 block text-xs font-medium text-slate-600">Hasta</label>
                                    <input
                                        type="date"
                                        value={licenseEnd}
                                        onChange={(e) => setLicenseEnd(e.target.value)}
                                        className="w-full rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-purple-500"
                                    />
                                </div>
                            </div>
                            <textarea
                                value={licenseNote}
                                onChange={(e) => setLicenseNote(e.target.value)}
                                placeholder="Notas (opcional)"
                                className="w-full resize-none rounded-lg border border-slate-300 p-2 text-sm focus:ring-2 focus:ring-purple-500"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRegisterLicense}
                                    className="flex-1 rounded-xl bg-purple-600 py-2.5 font-bold text-white transition-colors hover:bg-purple-700"
                                >
                                    Guardar
                                </button>
                                <button
                                    onClick={() => setActiveForm('none')}
                                    className="rounded-xl bg-white border border-slate-200 px-4 py-2.5 font-medium text-slate-600 transition-colors hover:bg-slate-100"
                                >
                                    Volver
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Incidencias relacionadas */}
                    {incidencies.length > 0 && (
                        <div>
                            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
                                Incidencias del día
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {incidencies.map((code) => (
                                    <span
                                        key={code}
                                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${INCIDENCE_LABELS[code]?.cls || 'bg-slate-100 text-slate-600'}`}
                                    >
                                        {INCIDENCE_LABELS[code]?.label || code}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* ===== Footer ===== */}
                <div className="border-t bg-slate-50 px-5 py-3.5">
                    <button
                        onClick={handleClose}
                        className="w-full rounded-xl bg-slate-200 py-2.5 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-300"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
