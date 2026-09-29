'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  value: number;
  onCommit: (value: number) => void;
  format: (n: number) => string; // bv. fmtEur — bepaalt hoe de waarde toont als je 'm niet bewerkt
  align?: 'left' | 'right';
  bold?: boolean;
}

// Klik-om-te-bewerken cel: toont de mooi geformatteerde waarde (met € en .),
// en wordt pas een kaal invoerveld zodra je erop klikt. Zo kun je typen zonder
// dat het valutasymbool/duizendscheidingsteken in de weg zit.
export default function EditableNumber({ value, onCommit, format, align = 'right', bold }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(String(value));
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing, value]);

  function commit() {
    setEditing(false);
    const num = Number(draft);
    if (!Number.isNaN(num) && num !== value) onCommit(num);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        type="number"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') setEditing(false);
        }}
        style={{
          width: '100%',
          minWidth: '70px',
          textAlign: align,
          fontSize: '12px',
          fontWeight: bold ? 600 : 400,
          border: '1px solid #1E3A8A',
          borderRadius: '4px',
          padding: '4px 6px',
          outline: 'none',
          boxShadow: '0 0 0 2px rgba(30,58,138,0.12)',
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      title="Klik om te bewerken"
      style={{
        width: '100%',
        minWidth: '70px',
        textAlign: align,
        fontSize: '12px',
        fontWeight: bold ? 600 : 400,
        color: '#22222D',
        background: 'transparent',
        border: '1px solid transparent',
        borderRadius: '4px',
        padding: '4px 6px',
        cursor: 'text',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.border = '1px solid #DCE0E6')}
      onMouseLeave={(e) => (e.currentTarget.style.border = '1px solid transparent')}
    >
      {format(value)}
    </button>
  );
}
