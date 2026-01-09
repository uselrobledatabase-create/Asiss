import React from 'react';
import { User, Building2, Bus } from 'lucide-react';
import { GlassCard } from './ui/GlassCard';
import { TerminalSelector } from '../../../shared/components/common/TerminalSelector';
// Assuming we might have a PPU input component, or just use a standard input for now
// import { PpuInput } from '...'; 

interface HeaderSectionProps {
    formData: any;
    setFormData: (data: any) => void;
    currentUser?: { name: string; role: string };
}

export const HeaderSection: React.FC<HeaderSectionProps> = ({ formData, setFormData, currentUser }) => {
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: any) => ({ ...prev, [name]: value }));
    };

    return (
        <GlassCard title="Información General" className="mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* PPU Input - Critical */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Bus className="w-4 h-4 text-blue-600" />
                        PPU / Patente
                    </label>
                    <input
                        type="text"
                        name="ppu"
                        value={formData.ppu}
                        onChange={handleInputChange}
                        placeholder="ABCD-12"
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none font-mono uppercase tracking-wider text-lg"
                    />
                </div>

                {/* Terminal Selector */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <Building2 className="w-4 h-4 text-blue-600" />
                        Terminal
                    </label>
                    <div className="h-11">
                        <TerminalSelector
                            label=""
                            value={{ mode: 'TERMINAL', value: formData.terminal_id }}
                            onChange={(ctx) => setFormData((prev: any) => ({ ...prev, terminal_id: ctx.value }))}
                        />
                    </div>
                </div>

                {/* Fiscalizador Auto-filled */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <User className="w-4 h-4 text-blue-600" />
                        Fiscalizador
                    </label>
                    <input
                        type="text"
                        name="fiscalizador"
                        value={formData.fiscalizador}
                        onChange={handleInputChange}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    />
                </div>

                {/* Registrador Auto-filled */}
                <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                        <User className="w-4 h-4 text-gray-400" />
                        Registrador (Opcional)
                    </label>
                    <input
                        type="text"
                        name="registrador"
                        value={formData.registrador}
                        onChange={handleInputChange}
                        className="w-full h-11 px-4 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 transition-all outline-none"
                    />
                </div>

            </div>
        </GlassCard>
    );
};
