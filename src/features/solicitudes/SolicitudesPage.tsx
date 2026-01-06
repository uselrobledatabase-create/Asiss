
import { useState } from 'react';
import { PortalTabs } from './components/PortalTabs';
import { SolicitudesView } from './sections/SolicitudesView';
import { VideosSection } from './sections/VideosSection';
import { PatentesSection } from './sections/PatentesSection';
import { CamarasSection } from './sections/CamarasSection';

export const SolicitudesPage = () => {
  const [activeTab, setActiveTab] = useState<'solicitudes' | 'videos' | 'patentes' | 'camaras'>('videos'); // Default to videos based on "Portal" context or user pref? Let's stick to solicitudes or videos. User screenshot showed "Portal de Solicitudes y Videos". I'll default to 'solicitudes' or 'videos'. Let's default to 'solicitudes' for consistency, but if they want "Potencia", maybe the 'videos' tab is flashy. I'll default to 'solicitudes'.

  return (
    <div className="min-h-screen bg-slate-50/50 pb-20">
      {/* Premium Header */}
      <div className="relative overflow-hidden bg-white mb-8 border-b border-slate-200/60 pb-8 pt-6">
        <div className="absolute top-0 right-0 p-12 -mr-12 -mt-12 bg-purple-100/50 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-0 left-0 p-16 -ml-16 -mt-16 bg-blue-100/30 rounded-full blur-3xl pointer-events-none" />

        <div className="container mx-auto px-4 relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600 mb-4 animate-fade-in">
              Portal de Solicitudes y Videos
            </h1>
            <p className="text-slate-500 text-lg md:text-xl font-medium animate-fade-in delay-100">
              Gestiona tus solicitudes de grabaciones de forma rápida y moderna.
              Verifica patentes y estado de cámaras en tiempo real.
            </p>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 max-w-6xl">
        <PortalTabs activeTab={activeTab} onChange={setActiveTab as any} />

        <div className="min-h-[400px]">
          {activeTab === 'solicitudes' && <SolicitudesView />}
          {activeTab === 'videos' && <VideosSection />}
          {activeTab === 'patentes' && <PatentesSection />}
          {activeTab === 'camaras' && <CamarasSection />}
        </div>
      </div>
    </div>
  );
};
