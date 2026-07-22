'use client';

import type { CampaignRow, Platform } from '@/types/campaign';

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
  rows: CampaignRow[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
}

export default function CampaignSelector({ rows, selected, onChange }: Props) {
  // Unique campaigns in order of first appearance, grouped by platform
  const campaigns: { name: string; platform: Platform }[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    if (!seen.has(r.campaign_name)) {
      seen.add(r.campaign_name);
      campaigns.push({ name: r.campaign_name, platform: r.platform });
    }
  }

  const platforms: Platform[] = ['linkedin', 'meta', 'google'];

  function toggle(name: string) {
    const next = new Set(selected);
    if (next.has(name)) next.delete(name); else next.add(name);
    onChange(next);
  }

  function selectAll()   { onChange(new Set(campaigns.map((c) => c.name))); }
  function deselectAll() { onChange(new Set()); }

  function selectGroup(platform: Platform) {
    const next = new Set(selected);
    campaigns.filter((c) => c.platform === platform).forEach((c) => next.add(c.name));
    onChange(next);
  }
  function deselectGroup(platform: Platform) {
    const next = new Set(selected);
    campaigns.filter((c) => c.platform === platform).forEach((c) => next.delete(c.name));
    onChange(next);
  }
  function isGroupChecked(platform: Platform) {
    const group = campaigns.filter((c) => c.platform === platform);
    return group.length > 0 && group.every((c) => selected.has(c.name));
  }
  function isGroupIndeterminate(platform: Platform) {
    const group = campaigns.filter((c) => c.platform === platform);
    const checked = group.filter((c) => selected.has(c.name)).length;
    return checked > 0 && checked < group.length;
  }

  const selectedCount = campaigns.filter((c) => selected.has(c.name)).length;
  const allSelected   = selectedCount === campaigns.length;

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>

      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid #DCE0E6' }}>
        <span className="gf-eyebrow">Campagnes</span>
        <div className="flex gap-3">
          <button
            onClick={selectAll}
            className="text-xs font-semibold transition-colors"
            style={{ color: allSelected ? '#BCC4CF' : '#1E3A8A' }}
          >
            Alles
          </button>
          <span style={{ color: '#DCE0E6' }}>|</span>
          <button
            onClick={deselectAll}
            className="text-xs font-semibold transition-colors"
            style={{ color: selectedCount === 0 ? '#BCC4CF' : '#555E6C' }}
          >
            Geen
          </button>
        </div>
      </div>

      {/* Groups */}
      <div className="overflow-y-auto" style={{ maxHeight: '65vh' }}>
        {platforms.map((platform) => {
          const list = campaigns.filter((c) => c.platform === platform);
          if (list.length === 0) return null;
          const color     = PLATFORM_COLOR[platform];
          const allCheck  = isGroupChecked(platform);
          const indCheck  = isGroupIndeterminate(platform);
          return (
            <div key={platform} style={{ borderBottom: '1px solid #F0F4F8' }}>
              {/* Platform header */}
              <label className="flex items-center gap-2.5 px-4 py-2.5 cursor-pointer select-none" style={{ background: '#FAFBFC' }}>
                <input
                  type="checkbox"
                  checked={allCheck}
                  ref={(el) => { if (el) el.indeterminate = indCheck; }}
                  onChange={() => allCheck || indCheck ? deselectGroup(platform) : selectGroup(platform)}
                  className="w-3.5 h-3.5 shrink-0"
                  style={{ accentColor: color }}
                />
                <span className="text-xs font-bold uppercase tracking-widest" style={{ color }}>
                  {PLATFORM_LABEL[platform]}
                </span>
                <span className="ml-auto text-xs" style={{ color: '#BCC4CF' }}>
                  {list.filter((c) => selected.has(c.name)).length}/{list.length}
                </span>
              </label>

              {/* Campaign rows */}
              {list.map((c) => (
                <label
                  key={c.name}
                  className="flex items-center gap-2.5 px-4 py-1.5 cursor-pointer select-none transition-colors"
                  style={{ background: selected.has(c.name) ? 'transparent' : undefined }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = '#F0F4F8')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <input
                    type="checkbox"
                    checked={selected.has(c.name)}
                    onChange={() => toggle(c.name)}
                    className="w-3.5 h-3.5 shrink-0"
                    style={{ accentColor: color }}
                  />
                  <span className="text-xs leading-snug truncate" style={{ color: selected.has(c.name) ? '#0B1020' : '#8C9BAF' }}>
                    {c.name}
                  </span>
                </label>
              ))}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 flex items-center justify-between" style={{ borderTop: '1px solid #DCE0E6' }}>
        <span className="text-xs" style={{ color: '#8C9BAF' }}>
          <span className="font-semibold" style={{ color: '#0B1020' }}>{selectedCount}</span>
          {' '}/ {campaigns.length} geselecteerd
        </span>
        {selectedCount < campaigns.length && selectedCount > 0 && (
          <span className="text-xs font-semibold" style={{ color: '#1E3A8A' }}>
            gefilterd
          </span>
        )}
      </div>
    </div>
  );
}
