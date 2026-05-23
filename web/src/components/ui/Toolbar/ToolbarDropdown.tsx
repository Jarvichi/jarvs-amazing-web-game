import React, { ReactNode, useState, useRef, useEffect } from 'react';




export interface ToolbarDropdownProps {
  label?: ReactNode;
  disabled?: boolean;
  children: ReactNode;
  overflowItems?: ReactNode;
  align?: 'left' | 'right';
}

export function ToolbarDropdown({ label, disabled, children, overflowItems, align = 'right' }: ToolbarDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div className="toolbar-dropdown" ref={ref}>
      {overflowItems && (
        <div className="toolbar-overflow-inline">{overflowItems}</div>
      )}
      <button
        className={`filter-btn${open ? ' filter-btn--active' : ''} u-min-w-32`}
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
      >
        {label} ▾
      </button>
      {open && (
        <div className={`toolbar-dropdown-panel toolbar-dropdown-panel--${align}`} onClick={() => setOpen(false)}>
          {overflowItems && (
            <div className="toolbar-overflow-dropdown">{overflowItems}</div>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
