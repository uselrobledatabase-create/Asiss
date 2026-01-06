
import { Icon } from '../../../shared/components/common/Icon';

export const PatentesSection = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="card max-w-2xl mx-auto p-8 shadow-xl shadow-blue-900/5 border-blue-100">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 text-blue-600">
                        <Icon name="search" size={32} />
                    </div>
                    <h2 className="text-2xl font-bold text-slate-900">Verificador de Patentes</h2>
                    <p className="text-slate-500 mt-2">Consulta el historial y estado de vehículos en recinto.</p>
                </div>

                <div className="relative">
                    <input
                        type="text"
                        placeholder="Ingresa patente (ej: ABCD-12)"
                        className="w-full h-14 pl-5 pr-14 rounded-xl border-slate-200 text-lg font-mono uppercase focus:ring-4 focus:ring-blue-100 transition-all"
                    />
                    <button className="absolute right-2 top-2 h-10 w-10 bg-blue-600 rounded-lg flex items-center justify-center text-white hover:bg-blue-700 transition-colors">
                        <Icon name="search" size={20} />
                    </button>
                </div>

                <div className="mt-8 pt-8 border-t border-slate-100">
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-4">Búsquedas recientes</p>
                    <div className="flex flex-wrap gap-2">
                        {['HG-FD-23', 'XX-YY-99', 'AB-CD-12'].map(p => (
                            <span key={p} className="px-3 py-1.5 bg-slate-50 rounded-lg text-sm font-mono text-slate-600 border border-slate-200">
                                {p}
                            </span>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};
