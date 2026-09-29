'use client';

import { useEffect, useState } from 'react';

interface Props {
  value: string;
  onCommit: (value: string) => void;
  placeholder?: string;
  bold?: boolean;
}

// Excel-achtige inline-bewerkbare tekstcel: onopvallend tot je erin klikt, dan een
// duidelijke focusring. Commit gebeurt on-blur/Enter, niet on-change.
export default function EditableField({ value, onCommit, placeholder, bold }: Props) {
  const [draft, setDraft] = useState(value);
  const [focused, setFocused] = useState(false);

  useEffect(() => { if (!focused) setDraft(value); }, [value, focused]);

  function commit() {
    setFocused(false);
    if (draft !== value) onCommit(draft);
  }

  return (
    <input
      type="text"
      value={draft}
      placeholder={placeholder}
      onFocus={() => setFocused(true)}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
      style={{
        width: '100%',
        minWidth: '110px',
        border: `1px solid ${focused ? '#1E3A8A' : 'transparent'}`,
        borderRadius: '4px',
        background: focused ? '#ffffff' : 'transparent',
        padding: '4px 6px',
        fontSize: '12px',
        color: '#22222D',
        fontWeight: bold ? 600 : 400,
        outline: 'none',
        boxShadow: focused ? '0 0 0 2px rgba(30,58,138,0.12)' : 'none',
      }}
    />
  );
}
