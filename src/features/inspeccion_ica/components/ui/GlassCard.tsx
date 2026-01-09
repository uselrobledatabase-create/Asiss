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
      bg-white dark:bg-slate-800 
      border border-slate-200 dark:border-slate-700
      shadow-md dark:shadow-xl
      rounded-2xl 
      transition-all duration-300
      ${className}
    `}>
            {title && (
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-700/50 bg-slate-50/50 dark:bg-slate-800/50">
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
