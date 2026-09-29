'use client';

import { useState } from 'react';
import { GOAL_METRIC_PRESETS, slugify, uniqueKey } from '@/types/results';
import type { MetricPairDef } from '@/types/results';

interface Props {
  catalog: MetricPairDef[]; // alle metric-definities (presets + aangepaste) — per campagne kies je hieruit
  onChange: (next: MetricPairDef[]) => void;
}

// Beheert alleen de catalogus van metric-tYpes die je per campagne kunt aanzetten
// (zie de togglebare chips in ResultsPerChannelTable). Verkeer/Views/Leads staan
// altijd al in de catalogus; hier kun je alleen nieuwe aangepaste metrics toevoegen
// of weer verwijderen.
export default function MetricPairManager({ catalog, onChange }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customCost, setCustomCost] = useState('');
  const [customVolume, setCustomVolume] = useState('');

  const custom = catalog.filter((p) => !GOAL_METRIC_PRESETS.some((g) => g.key === p.key));

  function addCustom() {
    if (!customCost.trim() || !customVolume.trim()) return;
    const key = uniqueKey(slugify(customVolume), catalog);
    onChange([...catalog, { key, costLabel: customCost.trim(), volumeLabel: customVolume.trim() }]);
    setCustomCost('');
    setCustomVolume('');
    setCustomOpen(false);
  }

  function remove(key: string) {
    onChange(catalog.filter((p) => p.key !== key));
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mb-3">
      <span className="text-xs" style={{ color: '#8C9BAF' }}>Beschikbare metrics per campagne:</span>
      {GOAL_METRIC_PRESETS.map((p) => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1"
          style={{ background: '#F0F4F8', color: '#555E6C', borderRadius: '5px', border: '1px solid #DCE0E6' }}
        >
          {p.goalLabel}
        </span>
      ))}
      {custom.map((p) => (
        <span
          key={p.key}
          className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1"
          style={{ background: '#1E3A8A14', color: '#1E3A8A', borderRadius: '5px', border: '1px solid #1E3A8A33' }}
        >
          {p.costLabel} → {p.volumeLabel}
          <button
            onClick={() => remove(p.key)}
            title="Metric-type verwijderen uit de catalogus"
            style={{ color: '#1E3A8A99', background: 'none', border: 'none', cursor: 'pointer', padding: 0, lineHeight: 1 }}
          >
            ✕
          </button>
        </span>
      ))}

      {!customOpen ? (
        <button
          onClick={() => setCustomOpen(true)}
          className="text-xs font-semibold px-2.5 py-1.5"
          style={{ borderRadius: '5px', border: '1px solid #DCE0E6', color: '#555E6C', background: '#ffffff' }}
        >
          + Aangepaste metric
        </button>
      ) : (
        <div className="flex items-center gap-1.5">
          <input
            value={customCost}
            onChange={(e) => setCustomCost(e.target.value)}
            placeholder="Kosten (bv. CPE)"
            className="text-xs px-2 py-1.5"
            style={{ border: '1px solid #DCE0E6', borderRadius: '5px', width: '110px' }}
          />
          <span className="text-xs" style={{ color: '#8C9BAF' }}>→</span>
          <input
            value={customVolume}
            onChange={(e) => setCustomVolume(e.target.value)}
            placeholder="Volume (bv. Engagements)"
            className="text-xs px-2 py-1.5"
            style={{ border: '1px solid #DCE0E6', borderRadius: '5px', width: '140px' }}
          />
          <button
            onClick={addCustom}
            className="text-xs font-semibold px-2.5 py-1.5"
            style={{ borderRadius: '5px', background: '#1E3A8A', color: '#fff', border: 'none' }}
          >
            Toevoegen
          </button>
          <button
            onClick={() => setCustomOpen(false)}
            className="text-xs"
            style={{ color: '#8C9BAF', background: 'none', border: 'none' }}
          >
            Annuleren
          </button>
        </div>
      )}
    </div>
  );
}
