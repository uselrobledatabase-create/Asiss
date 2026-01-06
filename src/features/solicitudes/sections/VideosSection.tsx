
import { Icon } from '../../../shared/components/common/Icon';

export const VideosSection = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid md:grid-cols-2 gap-6">
                <div className="card p-6 border-slate-200 shadow-lg shadow-slate-200/50 bg-gradient-to-br from-white to-slate-50">
                    <div className="flex items-start justify-between mb-4">
                        <div className="p-3 bg-purple-100 rounded-xl text-purple-600">
                            <Icon name="eye" size={24} />
                        </div>
                        <span className="badge bg-purple-50 text-purple-700 border-purple-100">Nuevo</span>
                    </div>
                    <h3 className="text-lg font-bold text-slate-900 mb-2">Solicitar Grabación</h3>
                    <p className="text-slate-500 text-sm mb-4">
                        Gestiona solicitudes de material audiovisual de seguridad.
                    </p>
                    <button className="btn w-full bg-purple-600 hover:bg-purple-700 text-white shadow-lg shadow-purple-200">
                        Nueva Solicitud
                    </button>
                </div>

                <div className="card p-6 border-slate-200 shadow-sm">
                    <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                        <Icon name="clock" size={18} /> Historial Reciente
                    </h3>
                    <div className="space-y-3">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                                <div className="w-10 h-10 rounded-full bg-slate-200 flex items-center justify-center text-slate-400">
                                    <Icon name="image" size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 truncate">Cámara Acceso Principal</p>
                                    <p className="text-xs text-slate-500">Hace 2 horas • Pendiente</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
