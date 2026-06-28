import { useState, useEffect, useRef, FormEvent } from 'react';
import { X, Printer, Search } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { LoanFormValues, BackupCard, REASON_OPTIONS, INVENTORY_TERMINALS } from '../types';
import { fetchAvailableCards } from '../api/backupApi';
import { validateRut, formatRut, cleanRut } from '../utils/rut';
import { supabase } from '../../../shared/lib/supabaseClient';
import { terminalOptions } from '../../../shared/utils/terminal';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (values: LoanFormValues, printFn: () => void) => Promise<void>;
    isLoading?: boolean;
    supervisorName: string;
}

export const LoanFormModal = ({ isOpen, onClose, onSubmit, isLoading, supervisorName }: Props) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [form, setForm] = useState<LoanFormValues>({
        person_rut: '',
        person_name: '',
        person_cargo: '',
        person_terminal: 'EL_ROBLE',
        reason: 'PERDIDA',
        requested_at: new Date().toISOString().split('T')[0],
        issued_at: new Date().toISOString().split('T')[0],
        card_id: '',
        discount_applied: true,
        discount_amount: 5000,
        send_emails: true,
        created_by_supervisor: supervisorName,
    });
    const [selectedCardTerminal, setSelectedCardTerminal] = useState<string>('');
    const [rutError, setRutError] = useState('');

    // Fetch available cards
    const { data: availableCards = [] } = useQuery({
        queryKey: ['backup-cards-available', selectedCardTerminal],
        queryFn: () => fetchAvailableCards(selectedCardTerminal || undefined),
        enabled: isOpen,
    });

    // RUT lookup from staff table
    const handleRutBlur = async () => {
        const cleanedRut = cleanRut(form.person_rut);
        if (!cleanedRut) return;

        if (!validateRut(cleanedRut)) {
            setRutError('RUT invalido');
            return;
        }
        setRutError('');

        // Try to find in staff table
        const { data: staff } = await supabase
            .from('staff')
            .select('nombre, cargo, terminal_code')
            .eq('rut', cleanedRut)
            .single();

        if (staff) {
            setForm((prev) => ({
                ...prev,
                person_rut: formatRut(cleanedRut),
                person_name: staff.nombre,
                person_cargo: staff.cargo || '',
                person_terminal: staff.terminal_code || 'EL_ROBLE',
            }));
        } else {
            setForm((prev) => ({ ...prev, person_rut: formatRut(cleanedRut) }));
        }
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!validateRut(cleanRut(form.person_rut))) {
            setRutError('RUT invalido');
            return;
        }

        // Pass handlePrint to parent so it can print AFTER successful save
        await onSubmit(form, handlePrint);
    };

    const handlePrint = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            const fechaActual = new Date().toLocaleDateString('es-CL', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });

            printWindow.document.write(`
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Autorización de Descuento - ${form.person_name || 'RBU'}</title>
    <style>
        @page { size: letter; margin: 15mm 20mm; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: Arial, Helvetica, sans-serif;
            background-color: white;
            padding: 0;
            color: #000;
            font-size: 12px;
            line-height: 1.4;
        }

        .page {
            width: 100%;
            max-width: 210mm;
            margin: 0 auto;
        }

        /* Header Styles */
        .header-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-bottom: 5px;
            padding-bottom: 5px;
            border-bottom: 3px solid black;
        }

        /* Logo RBU con camion CSS */
        .logo-container {
            position: relative;
            width: 150px;
            height: 50px;
        }
        .truck-body {
            border: 4px solid #003399;
            border-radius: 8px;
            width: 120px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            position: absolute;
            top: 0;
            left: 0;
            background: white;
            z-index: 2;
        }
        .truck-cab {
            position: absolute;
            top: 5px;
            right: 15px;
            width: 25px;
            height: 35px;
            border-top: 4px solid #003399;
            border-right: 4px solid #003399;
            border-radius: 0 5px 0 0;
        }
        .logo-text {
            color: #cc0000;
            font-weight: 900;
            font-size: 32px;
            font-family: 'Arial Black', Arial, sans-serif;
            letter-spacing: -2px;
        }
        .wheel {
            width: 12px;
            height: 12px;
            border: 4px solid #003399;
            border-radius: 50%;
            position: absolute;
            bottom: -5px;
            background: white;
            z-index: 3;
        }
        .w1 { left: 20px; }
        .w2 { left: 90px; }

        .rbu-santiago {
            color: #cc0000;
            font-weight: bold;
            font-size: 14px;
        }

        .title-bar {
            background-color: black;
            color: white;
            text-align: center;
            padding: 8px 0;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 25px;
        }

        /* Form Fields */
        .field-row {
            display: flex;
            margin-bottom: 20px;
            align-items: flex-end;
        }
        
        .field-label {
            font-weight: bold;
            font-size: 11px;
            white-space: nowrap;
            margin-right: 10px;
        }

        .field-line {
            border-bottom: 2px solid black;
            flex-grow: 1;
            min-height: 18px;
            padding-left: 5px;
            font-size: 12px;
        }

        .rut-row {
            display: flex;
            justify-content: space-between;
        }
        
        .rut-container {
            display: flex;
            width: 38%;
            align-items: flex-end;
        }
        
        .cargo-container {
            display: flex;
            width: 55%;
            align-items: flex-end;
        }

        /* Authorization Text */
        .auth-text {
            text-align: center;
            font-weight: bold;
            margin: 25px 0;
            font-size: 13px;
            letter-spacing: 0.5px;
        }

        .amount-row {
            display: flex;
            justify-content: center;
            font-weight: bold;
            font-size: 16px;
            margin-bottom: 12px;
            gap: 20px;
        }

        .concept-row {
            margin-left: 30px;
            margin-bottom: 5px;
            font-size: 13px;
        }
        .desc-small {
            font-size: 10px;
            margin-left: 30px;
            margin-bottom: 18px;
            color: #555;
        }

        /* Right aligned details */
        .details-right {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            margin-right: 20px;
        }
        
        .detail-item {
            display: flex;
            align-items: flex-end;
            margin-bottom: 8px;
            width: 280px;
            justify-content: flex-end;
        }
        
        .detail-item label {
            font-size: 11px;
            margin-right: 10px;
        }
        
        .detail-value {
            border-bottom: 2px solid black;
            width: 110px;
            text-align: right;
            font-weight: bold;
            font-size: 14px;
            padding-bottom: 2px;
            padding-right: 5px;
        }

        /* Signature & Date */
        .sig-date-row {
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 30px;
            margin-bottom: 10px;
            font-style: italic;
            font-size: 11px;
            font-weight: bold;
        }
        .date-val {
            font-size: 12px;
            font-style: normal;
        }

        .signature-line {
            border-bottom: 2px solid black;
            width: 200px;
            margin-top: 40px;
        }

        .legal-text {
            font-size: 9px;
            text-align: justify;
            line-height: 1.3;
            margin: 15px 0;
            padding-top: 10px;
            border-top: 1px solid #ccc;
        }

        /* Observations Box */
        .obs-header {
            background-color: #333;
            color: white;
            font-weight: bold;
            text-align: center;
            font-size: 11px;
            padding: 4px;
            border: 2px solid black;
            border-bottom: none;
        }
        .obs-box {
            border: 2px solid black;
            height: 50px;
            margin-bottom: 30px;
        }

        /* Footer */
        .footer-line {
            border-top: 3px solid black;
            padding-top: 8px;
            text-align: center;
            font-size: 10px;
            font-weight: bold;
            margin-top: 20px;
        }
        .company-name {
            text-align: right;
            font-weight: bold;
            margin-top: 15px;
            font-size: 11px;
            border-bottom: 2px solid black;
            display: inline-block;
            float: right;
            padding-bottom: 2px;
            text-decoration: underline;
        }

        /* Bottom Detail Section */
        .bottom-detail-title {
            text-align: center;
            font-style: italic;
            font-weight: bold;
            font-size: 14px;
            margin-top: 30px;
            margin-bottom: 10px;
            clear: both;
        }
        
        .bottom-table {
            width: 100%;
            font-size: 11px;
            overflow: hidden;
        }
        .bt-left { 
            float: left; 
            font-weight: bold;
        }
        .bt-right { 
            float: right; 
            text-align: center;
        }
        .costo-header {
            font-weight: bold;
            font-size: 10px;
            margin-bottom: 3px;
            color: #555;
        }

        @media print {
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
    </style>
</head>
<body>

    <div class="page">
        <div class="header-top">
            <div class="logo-container">
                <div class="truck-cab"></div>
                <div class="truck-body">
                    <span class="logo-text">RBU</span>
                </div>
                <div class="wheel w1"></div>
                <div class="wheel w2"></div>
            </div>
            <div class="rbu-santiago">RBU Santiago.</div>
        </div>

        <div class="title-bar">
            Autorización de Descuento
        </div>

        <div class="field-row">
            <span class="field-label">NOMBRE DEL<br>TRABAJADOR:</span>
            <div class="field-line">${form.person_name || ''}</div>
        </div>

        <div class="field-row rut-row">
            <div class="rut-container">
                <span class="field-label">RUT :</span>
                <div class="field-line">${form.person_rut || ''}</div>
            </div>
            <div class="cargo-container">
                <span class="field-label">Cargo desempeñado:</span>
                <div class="field-line">${form.person_cargo || ''}</div>
            </div>
        </div>

        <div class="auth-text">
            EL TRABAJADOR INDIVIDUALIZADO AUTORIZA EN ESTE ACTO
        </div>

        <div class="amount-row">
            <span>EL DESCUENTO DE:</span>
            <span>$</span>
            <span>${form.discount_amount.toLocaleString('es-CL')}</span>
        </div>

        <div class="concept-row">
            <strong>POR CONCEPTO DE:</strong> &nbsp; ${form.reason === 'PERDIDA' ? 'Pérdida Credencial' : 'Deterioro Credencial'}
        </div>


        <div class="details-right">
            <div class="detail-item">
                <label>A descontar en:</label>
                <div class="detail-value">1 Cuota</div>
            </div>
            <div class="detail-item">
                <label>A contar de:</label>
                <div class="detail-value" style="font-style: italic; font-size: 12px;">Mes en curso</div>
            </div>
            <div class="detail-item">
                <label>Valor de cada cuota:</label>
                <div class="detail-value">$ ${form.discount_amount.toLocaleString('es-CL')}</div>
            </div>
        </div>

        <div class="sig-date-row">
            <div>
                <span>Firma y Rut del trabajador</span>
                <div class="signature-line"></div>
            </div>
            <span>Fecha : &nbsp; <span class="date-val"><strong>${fechaActual}</strong></span></span>
        </div>

        <div class="legal-text">
            El trabajador, mediante el presente instrumento, otorga mandato expreso a REDBUS URBANO S.A. para que descuente de sus remuneraciones en las cuotas y plazos indicados la suma indicada en este acto. Asimismo faculta expresamente a REDBUS URBANO S.A., para que en el evento de que por cualquier causa se pusiese término al contrato de trabajo, descuente el total del saldo adeudado de las indemnizaciones a que tenga derecho y/o otros emolumentos que pudiere tener derecho al término de la relación laboral.
        </div>

        <div class="obs-header">Observaciones</div>
        <div class="obs-box"></div>

        <div class="footer-line">
            Av. El Salto 4651, Huechuraba, Santiago.<br>
            Fono: (56 2) 4881800 &nbsp;&nbsp; Fax: (56 2) 4881818
        </div>

        <div style="overflow: hidden; margin-top: 15px;">
            <div class="company-name">REDBUS URBANO S.A.</div>
        </div>

        <div class="bottom-detail-title">Detalle Descuento</div>
        
        <div class="bottom-table">
            <span class="bt-left">${form.reason === 'PERDIDA' ? 'Pérdida Credencial' : 'Deterioro Credencial'}</span>
            <div class="bt-right">
                <div class="costo-header">COSTO</div>
                <div><strong>$${form.discount_amount.toLocaleString('es-CL')}</strong></div>
            </div>
        </div>

    </div>

</body>
</html>
            `);
            printWindow.document.close();
            setTimeout(() => printWindow.print(), 300);
        }
    };

    useEffect(() => {
        if (isOpen) {
            setForm({
                person_rut: '',
                person_name: '',
                person_cargo: '',
                person_terminal: 'EL_ROBLE',
                reason: 'PERDIDA',
                requested_at: new Date().toISOString().split('T')[0],
                issued_at: new Date().toISOString().split('T')[0],
                card_id: '',
                discount_applied: true,
                discount_amount: 5000,
                send_emails: true,
                created_by_supervisor: supervisorName,
            });
            setRutError('');
            setSelectedCardTerminal('');
        }
    }, [isOpen, supervisorName]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            <div className="fixed inset-0 bg-black/50" onClick={onClose} />
            <div className="relative min-h-screen flex items-center justify-center p-4">
                <div className="relative bg-white rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
                    <div className="sticky top-0 bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between z-10">
                        <h2 className="text-lg font-semibold text-slate-900">Nuevo Prestamo de Respaldo</h2>
                        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
                            <X className="w-5 h-5 text-slate-500" />
                        </button>
                    </div>

                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        {/* Person Data */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Datos del Trabajador</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">RUT</label>
                                    <div className="relative">
                                        <input
                                            type="text"
                                            className={`input pr-10 ${rutError ? 'border-red-500' : ''}`}
                                            value={form.person_rut}
                                            onChange={(e) => setForm((prev) => ({ ...prev, person_rut: e.target.value }))}
                                            onBlur={handleRutBlur}
                                            placeholder="12.345.678-9"
                                            required
                                        />
                                        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    </div>
                                    {rutError && <p className="text-xs text-red-500 mt-1">{rutError}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Nombre</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={form.person_name}
                                        onChange={(e) => setForm((prev) => ({ ...prev, person_name: e.target.value }))}
                                        required
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Cargo</label>
                                    <input
                                        type="text"
                                        className="input"
                                        value={form.person_cargo}
                                        onChange={(e) => setForm((prev) => ({ ...prev, person_cargo: e.target.value }))}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Terminal</label>
                                    <select
                                        className="input"
                                        value={form.person_terminal}
                                        onChange={(e) => setForm((prev) => ({ ...prev, person_terminal: e.target.value }))}
                                        required
                                    >
                                        {terminalOptions.map((t) => (
                                            <option key={t.value} value={t.value}>{t.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Request */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Solicitud</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Motivo</label>
                                    <select
                                        className="input"
                                        value={form.reason}
                                        onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value as typeof form.reason }))}
                                        required
                                    >
                                        {REASON_OPTIONS.map((r) => (
                                            <option key={r.value} value={r.value}>{r.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Fecha de Asignación</label>
                                    <input
                                        type="date"
                                        className="input"
                                        value={form.issued_at}
                                        onChange={(e) => setForm((prev) => ({ ...prev, issued_at: e.target.value, requested_at: e.target.value }))}
                                        required
                                    />
                                    <p className="text-xs text-slate-400 mt-1">Por defecto hoy. Puede modificarla.</p>
                                </div>
                            </div>
                        </div>

                        {/* Card Selection */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Tarjeta de Respaldo</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Terminal de Inventario</label>
                                    <select
                                        className="input"
                                        value={selectedCardTerminal}
                                        onChange={(e) => {
                                            setSelectedCardTerminal(e.target.value);
                                            setForm((prev) => ({ ...prev, card_id: '' }));
                                        }}
                                    >
                                        <option value="">Todos</option>
                                        {INVENTORY_TERMINALS.map((t) => (
                                            <option key={t} value={t}>{t}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-600 mb-1">Tarjeta Disponible</label>
                                    <select
                                        className="input"
                                        value={form.card_id}
                                        onChange={(e) => setForm((prev) => ({ ...prev, card_id: e.target.value }))}
                                        required
                                    >
                                        <option value="">Seleccionar tarjeta...</option>
                                        {availableCards.map((card) => (
                                            <option key={card.id} value={card.id}>
                                                {card.card_number} ({card.inventory_terminal})
                                            </option>
                                        ))}
                                    </select>
                                    {availableCards.length === 0 && (
                                        <p className="text-xs text-amber-600 mt-1">No hay tarjetas disponibles</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Discount */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Descuento</h3>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={form.discount_applied}
                                        onChange={(e) => setForm((prev) => ({ ...prev, discount_applied: e.target.checked }))}
                                        className="w-4 h-4 rounded border-slate-300"
                                    />
                                    <span className="text-sm text-slate-700">
                                        Aplicar descuento de ${form.discount_amount.toLocaleString('es-CL')} (1 cuota)
                                    </span>
                                </label>
                                {form.discount_applied && (
                                    <span className="text-xs text-slate-500 italic flex items-center gap-1">
                                        <Printer className="w-3 h-3" />
                                        Se imprimirá automáticamente al crear
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Emails */}
                        <div>
                            <h3 className="text-sm font-semibold text-slate-700 mb-3">Notificaciones</h3>
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.send_emails}
                                    onChange={(e) => setForm((prev) => ({ ...prev, send_emails: e.target.checked }))}
                                    className="w-4 h-4 rounded border-slate-300"
                                />
                                <span className="text-sm text-slate-700">Enviar correos al crear</span>
                            </label>
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                            <button type="button" onClick={onClose} className="btn btn-secondary" disabled={isLoading}>
                                Cancelar
                            </button>
                            <button type="submit" className="btn btn-primary" disabled={isLoading || !form.card_id}>
                                {isLoading ? 'Guardando...' : 'Crear Prestamo'}
                            </button>
                        </div>
                    </form>

                    {/* Hidden print template */}
                    <div ref={printRef} className="hidden" />
                </div>
            </div>
        </div>
    );
};
