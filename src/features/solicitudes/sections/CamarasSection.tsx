
import { Icon } from '../../../shared/components/common/Icon';

export const CamarasSection = () => {
    return (
        <div className="space-y-6 animate-fade-in-up">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {['Camara Acceso', 'Patio Carga', 'Casino', 'Perímetro N', 'Perímetro S'].map((cam, i) => (
                    <div key={i} className="group relative overflow-hidden rounded-xl bg-slate-900 aspect-video shadow-lg">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-10" />

                        {/* Mock feed */}
                        <div className="absolute inset-0 flex items-center justify-center opacity-20 group-hover:opacity-30 transition-opacity">
                            <Icon name="activity" size={48} className="text-white" />
                        </div>

                        <div className="absolute bottom-0 left-0 right-0 p-4 z-20">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h4 className="font-semibold text-white">{cam}</h4>
                                    <p className="text-xs text-white/70">Online • 1080p</p>
                                </div>
                                <div className="w-2 h-2 rounded-full bg-green-500 shadow-lg shadow-green-500/50 animate-pulse" />
                            </div>
                        </div>
                    </div>
                ))}
                <div className="rounded-xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center gap-2 aspect-video text-slate-400 hover:border-brand-300 hover:text-brand-500 hover:bg-brand-50/50 transition-all cursor-pointer">
                    <Icon name="plus" size={24} />
                    <span className="text-sm font-medium">Añadir Cámara</span>
                </div>
            </div>
        </div>
    );
};
