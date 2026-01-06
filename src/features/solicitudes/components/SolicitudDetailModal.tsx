
import { SolicitudViewModel } from '../types';
import { Icon } from '../../../shared/components/common/Icon';

interface SolicitudDetailModalProps {
    solicitud: SolicitudViewModel;
    onClose: () => void;
    onMarkAsReviewed?: () => void;
}

export const SolicitudDetailModal = ({ solicitud, onClose, onMarkAsReviewed }: SolicitudDetailModalProps) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={onClose} />

            <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 animate-scale-in">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
                >
                    <Icon name="x" size={20} />
                </button>

                <h3 className="text-xl font-bold text-slate-900 mb-1">Detalle de Solicitud</h3>
                <p className="text-sm text-slate-500 mb-6">Caso #{solicitud.id}</p>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-600">Estado Actual</span>
                    <span className={`badge uppercase tracking-wide font-bold px-3 py-1 bg-indigo-100 text-indigo-600`}>
                        {solicitud.estado === 'listo' ? 'LISTO PARA ENVIAR' : solicitud.estado}
                    </span>
                </div>

                <div className="space-y-4 mb-8">
                    <div className="flex gap-4">
                        <div className="w-8 flex justify-center text-slate-400 mt-0.5">
                            <Icon name="clock" size={20} />
                        </div>
                        <div>
                            <p className="font-semibold text-slate-700">Fecha de Solicitud</p>
                            <p className="text-slate-500">{new Date(solicitud.fecha).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                        </div>
                    </div>

                    {solicitud.ppu && (
                        <div className="flex gap-4">
                            <div className="w-8 flex justify-center text-slate-400 mt-0.5">
                                <Icon name="check-circle" size={20} />
                            </div>
                            <div>
                                <p className="font-semibold text-slate-700">PPU Solicitada</p>
                                <p className="text-slate-500 font-mono">{solicitud.ppu}</p>
                            </div>
                        </div>
                    )}

                    {solicitud.video_url && (
                        <div className="flex gap-4">
                            <div className="w-8 flex justify-center text-slate-400 mt-0.5">
                                <Icon name="file-text" size={20} />
                            </div>
                            <div className="flex-1">
                                <p className="font-semibold text-slate-700">Enlace de video</p>
                                <a
                                    href={solicitud.video_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-blue-600 hover:underline break-all block mt-1"
                                >
                                    {solicitud.video_url}
                                </a>
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex flex-col gap-3">
                    {onMarkAsReviewed && !solicitud.reviewed && (
                        <button
                            onClick={onMarkAsReviewed}
                            className="btn bg-brand-600 hover:bg-brand-700 text-white w-full rounded-xl py-3 shadow-lg shadow-brand-200"
                        >
                            Marcar como Revisado
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="btn btn-ghost w-full text-indigo-600 hover:bg-indigo-50"
                    >
                        Cerrar Consulta
                    </button>
                </div>
            </div>
        </div>
    );
};
