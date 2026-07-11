interface Props {
  isCollapsed: boolean;
}

export const SidebarCredit = ({ isCollapsed }: Props) => (
  <div className="border-t border-white/5 px-4 py-3">
    <a
      href="https://www.zyteron.cl"
      target="_blank"
      rel="noopener noreferrer"
      className="block text-center transition-colors hover:text-brand-400"
      title="Web desarrollada por ZYTERON"
    >
      {isCollapsed ? (
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Z</span>
      ) : (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Web desarrollada por{' '}
          <span className="font-semibold uppercase tracking-wide text-slate-400">ZYTERON</span>
        </p>
      )}
    </a>
  </div>
);
