'use client';

import { useState } from 'react';
import type { Platform } from '@/types/campaign';
import type { Objective } from '@/types/objective';
import { OBJECTIVE_LABELS } from '@/types/objective';

// ── Config ────────────────────────────────────────────────────────────────────

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

const OBJECTIVES: { key: Objective; label: string; icon: string }[] = [
  { key: 'impressies', label: 'Impressies / bereik', icon: '📡' },
  { key: 'verkeer',    label: 'Verkeer',              icon: '🖱️' },
  { key: 'video',      label: 'Videoviews',           icon: '▶️' },
  { key: 'conversies', label: 'Conversies',           icon: '🎯' },
  { key: 'leads',      label: 'Leads',                icon: '📋' },
];

// ── Platform campaign block ───────────────────────────────────────────────────

interface PlatformBlockProps {
  platform:  Platform;
  campaigns: string[];
  selected:  Set<string>;
  onChange:  (next: Set<string>) => void;
}

function PlatformBlock({ platform, campaigns, selected, onChange }: PlatformBlockProps) {
  const [search, setSearch] = useState('');
  const color = PLATFORM_COLOR[platform];
  const label = PLATFORM_LABEL[platform];

  if (campaigns.length === 0) return null;

  const filtered = campaigns.filter((c) =>
    search.trim() === '' || c.toLowerCase().includes(search.toLowerCase())
  );

  const selectedCount = campaigns.filter((c) => selected.has(c)).length;
  const allSelected   = selectedCount === campaigns.length;

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

  return (
    <div style={{ marginBottom: '16px' }}>
      {/* Platform header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
          <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color }}>{label}</span>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={selectAll}
            style={{ fontSize: '11px', fontWeight: 600, color: allSelected ? '#BCC4CF' : '#6331F4', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >Alles</button>
          <span style={{ color: '#DCE0E6', fontSize: '11px' }}>|</span>
          <button
            onClick={deselectAll}
            style={{ fontSize: '11px', fontWeight: 600, color: selectedCount === 0 ? '#BCC4CF' : '#555E6C', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >Geen</button>
        </div>
      </div>

      {/* Search */}
      {campaigns.length > 4 && (
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Zoek…"
          style={{
            width: '100%',
            fontSize: '11px',
            padding: '5px 8px',
            border: '1px solid #DCE0E6',
            borderRadius: '5px',
            color: '#12101F',
            background: '#F8FAFC',
            marginBottom: '6px',
            boxSizing: 'border-box',
            outline: 'none',
          }}
          onFocus={(e) => (e.currentTarget.style.borderColor = '#6331F4')}
          onBlur={(e)  => (e.currentTarget.style.borderColor = '#DCE0E6')}
        />
      )}

      {/* Campaign checkboxes */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {filtered.map((name) => {
          const checked = selected.has(name);
          return (
            <label
              key={name}
              style={{ display: 'flex', alignItems: 'flex-start', gap: '7px', cursor: 'pointer', padding: '3px 4px', borderRadius: '4px' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F8')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => toggle(name)}
                style={{ marginTop: '2px', width: '13px', height: '13px', flexShrink: 0, accentColor: color, cursor: 'pointer' }}
              />
              <span style={{ fontSize: '11px', lineHeight: 1.4, color: checked ? '#12101F' : '#8C9BAF', wordBreak: 'break-word' }}>
                {name}
              </span>
            </label>
          );
        })}
        {filtered.length === 0 && (
          <p style={{ fontSize: '11px', color: '#8C9BAF', padding: '4px' }}>Geen resultaten</p>
        )}
      </div>

      {/* Count */}
      <p style={{ fontSize: '10px', color: '#BCC4CF', marginTop: '4px' }}>
        {selectedCount} / {campaigns.length} geselecteerd
      </p>
    </div>
  );
}

// ── Main sidebar ──────────────────────────────────────────────────────────────

interface Props {
  open:       boolean;
  onToggle:   () => void;

  liCampaigns: string[];
  meCampaigns: string[];
  goCampaigns: string[];
  selected:    Set<string>;
  onSelect:    (next: Set<string>) => void;

  autoObjective:   Objective;
  manualObjective: Objective | null;
  onObjective:     (obj: Objective | null) => void;
}

export default function CampaignSidebar({
  open, onToggle,
  liCampaigns, meCampaigns, goCampaigns,
  selected, onSelect,
  autoObjective, manualObjective, onObjective,
}: Props) {
  const effectiveObjective = manualObjective ?? autoObjective;

  return (
    <aside
      style={{
        width: open ? '248px' : '40px',
        flexShrink: 0,
        transition: 'width 0.2s ease',
        position: 'sticky',
        top: '120px',   /* header (64px) + filter bar (~56px) */
        height: 'calc(100vh - 120px)',
        overflowY: open ? 'auto' : 'hidden',
        overflowX: 'hidden',
      }}
    >
      {/* Toggle button */}
      <button
        onClick={onToggle}
        title={open ? 'Sidebar verbergen' : 'Sidebar tonen'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '32px',
          height: '32px',
          marginBottom: '12px',
          borderRadius: '8px',
          border: '1px solid #DCE0E6',
          background: '#ffffff',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'background 0.15s',
          color: '#555E6C',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F8')}
        onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {open
            ? <path d="M11 19l-7-7 7-7M18 19l-7-7 7-7"/>   /* chevrons left */
            : <path d="M13 5l7 7-7 7M6 5l7 7-7 7"/>          /* chevrons right */
          }
        </svg>
      </button>

      {/* Sidebar content */}
      {open && (
        <div style={{ paddingRight: '4px', paddingBottom: '24px' }}>

          {/* ── Doelstelling ── */}
          <div style={{ marginBottom: '20px' }}>
            <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8C9BAF', marginBottom: '8px' }}>
              Doelstelling
            </p>

            {/* Auto-detected badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 8px', background: '#F0F4F8', borderRadius: '6px' }}>
              <span style={{ fontSize: '10px', color: '#8C9BAF' }}>Auto:</span>
              <span style={{ fontSize: '11px', fontWeight: 600, color: '#6331F4' }}>
                {OBJECTIVE_LABELS[autoObjective]}
              </span>
              {manualObjective && (
                <button
                  onClick={() => onObjective(null)}
                  style={{ marginLeft: 'auto', fontSize: '10px', color: '#8C9BAF', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  title="Terug naar automatisch"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Manual override options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {OBJECTIVES.map(({ key, label, icon }) => {
                const active = effectiveObjective === key;
                const isManual = manualObjective === key;
                return (
                  <button
                    key={key}
                    onClick={() => onObjective(isManual ? null : key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '5px 8px',
                      borderRadius: '6px',
                      border: `1px solid ${active ? '#6331F4' : 'transparent'}`,
                      background: active ? '#6331F414' : 'transparent',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!active) e.currentTarget.style.background = '#F0F4F8'; }}
                    onMouseLeave={(e) => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >
                    <span style={{ fontSize: '12px' }}>{icon}</span>
                    <span style={{ fontSize: '11px', fontWeight: active ? 700 : 500, color: active ? '#6331F4' : '#555E6C' }}>
                      {label}
                    </span>
                    {isManual && (
                      <span style={{ marginLeft: 'auto', fontSize: '10px', background: '#6331F4', color: '#fff', borderRadius: '3px', padding: '1px 4px' }}>
                        handmatig
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Divider */}
          <div style={{ borderTop: '1px solid #DCE0E6', marginBottom: '16px' }} />

          {/* ── Campagnes ── */}
          <p style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#8C9BAF', marginBottom: '12px' }}>
            Campagnes
          </p>

          <PlatformBlock platform="linkedin" campaigns={liCampaigns} selected={selected} onChange={onSelect} />
          <PlatformBlock platform="meta"     campaigns={meCampaigns} selected={selected} onChange={onSelect} />
          <PlatformBlock platform="google"   campaigns={goCampaigns} selected={selected} onChange={onSelect} />

        </div>
      )}
    </aside>
  );
}
