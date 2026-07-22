'use client';

import { useState, useEffect, useRef } from 'react';
import type { Platform } from '@/types/campaign';

const PLATFORM_COLOR: Record<Platform, string> = {
  linkedin: '#0077B5',
  meta:     '#1877F2',
  google:   '#F59E0B',
};
const PLATFORM_LABEL: Record<Platform, string> = {
  linkedin: 'LinkedIn',
  meta:     'Meta',
  google:   'Google Ads',
};

interface Props {
  platform:  Platform;
  campaigns: string[];
  selected:  Set<string>;
  onChange:  (next: Set<string>) => void;
}

export default function PlatformCampaignDropdown({ platform, campaigns, selected, onChange }: Props) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref       = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const color = PLATFORM_COLOR[platform];
  const label = PLATFORM_LABEL[platform];

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Focus search on open; clear on close
  useEffect(() => {
    if (open) setTimeout(() => searchRef.current?.focus(), 50);
    else setSearch('');
  }, [open]);

  const filtered = campaigns.filter((c) =>
    search.trim() === '' || c.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = campaigns.filter((c) => selected.has(c)).length;
  const allSelected   = selectedCount === campaigns.length;
  const noneSelected  = selectedCount === 0;

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(next);
  }

  function selectAll() {
    const next = new Set(selected);
    campaigns.forEach((c) => next.add(c));
    onChange(next);
  }

  function deselectAll() {
    const next = new Set(selected);
    campaigns.forEach((c) => next.delete(c));
    onChange(next);
  }

  if (campaigns.length === 0) return null;

  const isFiltered = !allSelected;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 transition-all whitespace-nowrap"
        style={{
          borderRadius: '6px',
          background: isFiltered ? `${color}14` : '#ffffff',
          border: `1.5px solid ${open ? color : isFiltered ? color : '#DCE0E6'}`,
          color: isFiltered ? color : '#555E6C',
        }}
      >
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: color }} />
        {label}
        <span
          className="px-1.5 py-0.5 rounded text-xs font-bold"
          style={{
            background: isFiltered ? color : '#F0F4F8',
            color:      isFiltered ? (platform === 'google' ? '#0B1020' : '#ffffff') : '#8C9BAF',
          }}
        >
          {allSelected ? 'Alle' : noneSelected ? 'Geen' : `${selectedCount}/${campaigns.length}`}
        </span>
        <svg
          width="10" height="10" viewBox="0 0 10 10" fill="none"
          style={{ transform: open ? 'rotate(180deg)' : undefined, transition: 'transform 0.15s', color: '#BCC4CF' }}
        >
          <path d="M1.5 3.5l3.5 3.5 3.5-3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      {open && (
        <div
          className="absolute left-0 z-30 mt-1.5 bg-white"
          style={{
            border: '1px solid #DCE0E6',
            borderRadius: '8px',
            boxShadow: '0 8px 24px rgba(18,16,34,0.12)',
            minWidth: '260px',
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2.5" style={{ borderBottom: '1px solid #DCE0E6' }}>
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>{label}</span>
            <div className="flex gap-3">
              <button onClick={selectAll}   className="text-xs font-semibold" style={{ color: allSelected  ? '#BCC4CF' : '#1E3A8A' }}>Alles</button>
              <span style={{ color: '#DCE0E6' }}>|</span>
              <button onClick={deselectAll} className="text-xs font-semibold" style={{ color: noneSelected ? '#BCC4CF' : '#555E6C' }}>Geen</button>
            </div>
          </div>

          {/* Search */}
          <div className="px-3 py-2" style={{ borderBottom: '1px solid #F0F4F8' }}>
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Zoek op naam…"
              className="w-full text-xs px-2.5 py-1.5 focus:outline-none"
              style={{
                border: '1px solid #DCE0E6', borderRadius: '5px',
                color: '#0B1020', background: '#F8FAFC',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = '#1E3A8A')}
              onBlur={(e)  => (e.currentTarget.style.borderColor = '#DCE0E6')}
            />
          </div>

          {/* Campaign list */}
          <div className="overflow-y-auto py-1" style={{ maxHeight: '220px' }}>
            {filtered.length === 0 ? (
              <p className="px-3 py-3 text-xs" style={{ color: '#8C9BAF' }}>Geen resultaten voor &ldquo;{search}&rdquo;</p>
            ) : (
              filtered.map((name) => {
                const checked = selected.has(name);
                return (
                  <label
                    key={name}
                    className="flex items-start gap-2.5 px-3 py-2 cursor-pointer select-none transition-colors"
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F8')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(name)}
                      className="mt-0.5 w-3.5 h-3.5 shrink-0"
                      style={{ accentColor: color }}
                    />
                    <span className="text-xs leading-snug" style={{ color: checked ? '#0B1020' : '#8C9BAF' }}>
                      {name}
                    </span>
                  </label>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-3 py-2.5" style={{ borderTop: '1px solid #DCE0E6' }}>
            <span className="text-xs" style={{ color: '#8C9BAF' }}>
              <span className="font-semibold" style={{ color: '#0B1020' }}>{selectedCount}</span>
              {' '}/ {campaigns.length} geselecteerd
              {search.trim() && ` · ${filtered.length} gevonden`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
