/**
 * DayActionPanel - Slide-over panel for day actions
 */

import { useState } from 'react';
import { Icon } from '../../../shared/components/common/Icon';
import { StaffWithShift, AttendanceMarkType, IncidenceCode } from '../types';
import { DAY_COLORS, BUTTON_VARIANTS } from '../utils/colors';
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
    onRegisterPermission,
    onRequestOffboarding,
    isManager = false,
}: DayActionPanelProps) => {
    const [activeForm, setActiveForm] = useState<'none' | 'license'>('none');
    const [licenseStart, setLicenseStart] = useState(date);
    const [licenseEnd, setLicenseEnd] = useState(date);
    const [licenseNote, setLicenseNote] = useState('');

    if (!isOpen || !staff) return null;

    const dayOfWeek = formatDayOfWeek(date);
    const dayNumber = new Date(date + 'T12:00:00').getDate();
    const isDesvinculado = staff.status === 'DESVINCULADO';

    const handleRegisterLicense = () => {
        onRegisterLicense(licenseStart, licenseEnd, licenseNote || undefined);
        setLicenseNote('');
        setActiveForm('none');
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed right-0 top-0 h-full w-full max-w-md bg-white shadow-xl z-50 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b bg-slate-50">
                    <div>
                        <h3 className="font-semibold text-slate-900">{staff.nombre}</h3>
                        <p className="text-sm text-slate-500">
                            {staff.rut} | {staff.cargo} | {dayOfWeek} {dayNumber}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-200 rounded-lg transition-colors"
                    >
                        <Icon name="x" size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* Status info */}
                    {isDesvinculado && (
                        <div className="p-3 bg-slate-100 rounded-lg text-slate-600 text-sm">
                            <Icon name="alert-triangle" size={16} className="inline mr-2" />
                            Este trabajador está desvinculado. No se permiten nuevas marcaciones.
                        </div>
                    )}

                    {/* Current mark */}
                    {currentMark && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 ${currentMark === 'P' ? DAY_COLORS.PRESENTE.bg : DAY_COLORS.AUSENTE.bg
                            }`}>
                            <Icon name={currentMark === 'P' ? 'check-circle' : 'x-circle'} size={20} />
                            <span className="font-medium">
                                {currentMark === 'P' ? 'Presente' : 'Ausente'}
                            </span>
                            {currentNote && <span className="text-sm opacity-75">- {currentNote}</span>}
                        </div>
                    )}

                    {/* Quick marks */}
                    {!isDesvinculado && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-slate-700">Marcar asistencia</h4>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => onMarkPresent()}
                                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${BUTTON_VARIANTS.success}`}
                                >
                                    <Icon name="check" size={16} className="inline mr-1" />
                                    Presente (P)
                                </button>
                                <button
                                    onClick={() => onMarkAbsent('')}
                                    className={`flex-1 py-2 rounded-lg font-medium transition-colors ${BUTTON_VARIANTS.danger}`}
                                >
                                    <Icon name="x" size={16} className="inline mr-1" />
                                    Ausente (A)
                                </button>
                            </div>
                        </div>
                    )}



                    {/* Register license */}
                    {!isDesvinculado && activeForm === 'none' && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-slate-700">Registrar</h4>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setActiveForm('license')}
                                    className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium ${DAY_COLORS.LIC.bg} ${DAY_COLORS.LIC.text} border ${DAY_COLORS.LIC.border}`}
                                >
                                    Licencia
                                </button>
                            </div>
                        </div>
                    )}

                    {/* License form */}
                    {activeForm === 'license' && (
                        <div className="space-y-3 p-3 bg-purple-50 rounded-lg border border-purple-100">
                            <h4 className="text-sm font-medium text-purple-800">Registrar Licencia</h4>
                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-xs text-slate-600">Desde</label>
                                    <input
                                        type="date"
                                        value={licenseStart}
                                        onChange={(e) => setLicenseStart(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-600">Hasta</label>
                                    <input
                                        type="date"
                                        value={licenseEnd}
                                        onChange={(e) => setLicenseEnd(e.target.value)}
                                        className="w-full p-2 border rounded-lg text-sm"
                                    />
                                </div>
                            </div>
                            <textarea
                                value={licenseNote}
                                onChange={(e) => setLicenseNote(e.target.value)}
                                placeholder="Notas (opcional)"
                                className="w-full p-2 border rounded-lg text-sm resize-none"
                                rows={2}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={handleRegisterLicense}
                                    className="flex-1 py-2 rounded-lg font-medium bg-purple-600 text-white"
                                >
                                    Guardar
                                </button>
                                <button
                                    onClick={() => setActiveForm('none')}
                                    className="px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-600"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    )}



                    {/* Incidences */}
                    {incidencies.length > 0 && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-medium text-slate-700">Incidencias relacionadas</h4>
                            <div className="flex flex-wrap gap-2">
                                {incidencies.includes('NM') && (
                                    <span className="px-2 py-1 text-sm bg-yellow-100 text-yellow-800 rounded">
                                        No Marcación
                                    </span>
                                )}
                                {incidencies.includes('NC') && (
                                    <span className="px-2 py-1 text-sm bg-orange-100 text-orange-800 rounded">
                                        Sin Credencial
                                    </span>
                                )}
                                {incidencies.includes('CD') && (
                                    <span className="px-2 py-1 text-sm bg-blue-100 text-blue-800 rounded">
                                        Cambio de Día
                                    </span>
                                )}
                                {incidencies.includes('AUT') && (
                                    <span className="px-2 py-1 text-sm bg-green-100 text-green-800 rounded">
                                        Autorización
                                    </span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Offboarding request (managers only) */}
                    {isManager && !isDesvinculado && onRequestOffboarding && (
                        <div className="pt-4 border-t">
                            <button
                                onClick={onRequestOffboarding}
                                className="w-full py-2 rounded-lg text-sm font-medium text-red-600 border border-red-200 hover:bg-red-50 transition-colors"
                            >
                                <Icon name="user-x" size={16} className="inline mr-1" />
                                Solicitar Desvinculación
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-slate-50">
                    <button
                        onClick={onClose}
                        className={`w-full py-2 rounded-lg font-medium ${BUTTON_VARIANTS.secondary}`}
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </>
    );
};
