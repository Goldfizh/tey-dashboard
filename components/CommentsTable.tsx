'use client';

import { useState } from 'react';
import type { ChannelResultRow } from '@/types/results';
import { addComment } from '@/types/results';

interface Props {
  rows: ChannelResultRow[];
  selectedRowIds: string[];
  onChange: (rows: ChannelResultRow[]) => void;
}

function fmtDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('nl-NL', { day: 'numeric', month: 'short', year: 'numeric' });
}

// Optimalisaties & opvallendheden — een simpel logboek per campagne. Nieuwe
// reacties krijgen automatisch de datum van vandaag, zodat je kunt bijhouden
// wanneer een aanpassing is gedaan.
export default function CommentsTable({ rows, selectedRowIds, onChange }: Props) {
  const selectedRows = rows.filter((r) => selectedRowIds.includes(r.id));
  const [targetRowId, setTargetRowId] = useState(selectedRowIds[0] ?? '');
  const [draft, setDraft] = useState('');

  const activeTarget = selectedRowIds.includes(targetRowId) ? targetRowId : (selectedRowIds[0] ?? '');

  const allComments = selectedRows
    .flatMap((r) => r.comments.map((c) => ({ ...c, campagne: r.campagne })))
    .sort((a, b) => a.date.localeCompare(b.date));

  function submit() {
    if (!draft.trim() || !activeTarget) return;
    onChange(addComment(rows, activeTarget, draft.trim(), new Date()));
    setDraft('');
  }

  return (
    <div className="bg-white overflow-hidden" style={{ border: '1px solid #DCE0E6', borderRadius: '8px', boxShadow: '0 8px 24px rgba(18,16,34,0.08)' }}>
      <div className="px-4 py-3" style={{ background: '#1E3A8A' }}>
        <span className="text-xs font-bold uppercase tracking-wider text-white">Optimalisaties &amp; opvallendheden</span>
      </div>
      <table className="w-full">
        <thead style={{ background: '#F0F4F8', borderBottom: '1px solid #DCE0E6' }}>
          <tr>
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider w-32" style={{ color: '#8C9BAF' }}>Datum</th>
            {selectedRows.length > 1 && (
              <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider w-40" style={{ color: '#8C9BAF' }}>Campagne</th>
            )}
            <th className="py-2.5 px-4 text-left text-xs font-bold uppercase tracking-wider" style={{ color: '#8C9BAF' }}>Opmerking</th>
          </tr>
        </thead>
        <tbody>
          {allComments.map((c, i) => (
            <tr key={i} style={{ borderBottom: '1px solid #F0F4F8' }} className="last:border-0">
              <td className="py-2 px-4 text-xs whitespace-nowrap" style={{ color: '#8C9BAF' }}>{fmtDate(c.date)}</td>
              {selectedRows.length > 1 && (
                <td className="py-2 px-4 text-xs whitespace-nowrap" style={{ color: '#555E6C' }}>{c.campagne}</td>
              )}
              <td className="py-2 px-4 text-xs" style={{ color: '#22222D' }}>{c.text}</td>
            </tr>
          ))}
          {allComments.length === 0 && (
            <tr><td colSpan={3} className="px-4 py-4 text-center text-xs" style={{ color: '#8C9BAF' }}>Nog geen opmerkingen</td></tr>
          )}
        </tbody>
      </table>

      <div className="flex items-center gap-2 px-4 py-3" style={{ borderTop: '1px solid #DCE0E6' }}>
        {selectedRows.length > 1 && (
          <select
            value={activeTarget}
            onChange={(e) => setTargetRowId(e.target.value)}
            className="text-xs px-2 py-1.5"
            style={{ border: '1px solid #DCE0E6', borderRadius: '5px', color: '#555E6C' }}
          >
            {selectedRows.map((r) => <option key={r.id} value={r.id}>{r.campagne}</option>)}
          </select>
        )}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
          placeholder="Nieuwe opmerking…"
          className="flex-1 text-xs px-2.5 py-1.5"
          style={{ border: '1px solid #DCE0E6', borderRadius: '5px' }}
        />
        <button
          onClick={submit}
          className="text-xs font-semibold px-3 py-1.5"
          style={{ borderRadius: '5px', background: '#1E3A8A', color: '#fff', border: 'none' }}
        >
          Toevoegen
        </button>
      </div>
    </div>
  );
}
