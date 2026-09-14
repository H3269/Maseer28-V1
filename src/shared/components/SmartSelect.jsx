import React, { useEffect, useRef, useState } from 'react';

const OPEN_EVENT = 'maseer28:smart-select-open';
let smartSelectCounter = 0;

export default function SmartSelect({ value = '', onChange, options = [], id, ariaLabel, name }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const instanceId = useRef(`smart-select-${++smartSelectCounter}`);

  useEffect(() => {
    const closeOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOther = (event) => {
      if (event.detail !== instanceId.current) setOpen(false);
    };
    document.addEventListener('click', closeOutside);
    window.addEventListener(OPEN_EVENT, closeOther);
    return () => {
      document.removeEventListener('click', closeOutside);
      window.removeEventListener(OPEN_EVENT, closeOther);
    };
  }, []);

  const selectedIndex = Math.max(0, options.findIndex((o) => String(o.value) === String(value)));
  const selected = options[selectedIndex] || options[0] || { label: 'انتخاب کنید', value: '' };

  function toggle(event) {
    event.stopPropagation();
    if (!open) window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: instanceId.current }));
    setOpen((current) => !current);
  }

  return (
    <div className="smartSelect" ref={rootRef}>
      <select id={id} name={name} value={value} onChange={(e) => onChange(e.target.value)} aria-label={ariaLabel}>
        {options.map((option) => (
          <option key={`${option.value}-${option.label}`} value={option.value}>{option.label}</option>
        ))}
      </select>
      <button type="button" className="smartSelectButton" onClick={toggle}>
        {selected.label || 'انتخاب کنید'}
      </button>
      <div className={`smartSelectMenu ${open ? 'open' : ''}`}>
        {options.map((option, index) => (
          <button
            type="button"
            key={`${option.value}-${option.label}-button`}
            className={`smartSelectOption ${index === selectedIndex ? 'selected' : ''}`}
            onClick={() => { onChange(option.value); setOpen(false); }}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
