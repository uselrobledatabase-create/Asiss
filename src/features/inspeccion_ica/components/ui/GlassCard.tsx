import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    title?: string;
}

export const GlassCard: React.FC<GlassCardProps> = ({ children, className = '', title }) => {
    return (
        <div className={`
      relative overflow-hidden
      bg-white/80 dark:bg-slate-900/80 
      backdrop-blur-xl 
      border border-white/20 dark:border-slate-700/50
      shadow-xl 
      rounded-2xl 
      transition-all duration-300
      hover:shadow-2xl hover:bg-white/90 dark:hover:bg-slate-900/90
      ${className}
    `}>
            {title && (
                <div className="px-6 py-4 border-b border-gray-100 dark:border-slate-800/50">
                    <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        {title}
                    </h3>
                </div>
            )}
            <div className="p-6">
                {children}
            </div>
        </div>
    );
};
