import { useRef, useState } from 'react';
import { ImageIcon, Link, Upload, X } from 'lucide-react';
import { insertImageFromSource, readFileAsDataUrl } from './image-insert';

interface ImageInsertControlProps {
  resetInteraction: () => void;
}

export default function ImageInsertControl({ resetInteraction }: ImageInsertControlProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    resetInteraction();
    setOpen(true);
  }

  function closeDialog() {
    setOpen(false);
    setUrl('');
  }

  function insertFromUrl() {
    insertImageFromSource(url);
    closeDialog();
  }

  async function insertFromFile(file: File | undefined) {
    if (!file) return;
    const src = await readFileAsDataUrl(file);
    insertImageFromSource(src);
    closeDialog();
  }

  return (
    <>
      <button
        type="button"
        title="Image"
        aria-label="Insert image"
        onClick={openDialog}
        style={{
          width: 36,
          height: 36,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
          background: open ? '#2563eb' : 'transparent',
          color: open ? 'white' : '#374151',
          transition: 'background 0.1s',
        }}
        onMouseEnter={(event) => {
          if (!open) event.currentTarget.style.background = '#f3f4f6';
        }}
        onMouseLeave={(event) => {
          if (!open) event.currentTarget.style.background = 'transparent';
        }}
      >
        <ImageIcon size={18} />
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Insert image"
          style={{
            position: 'fixed',
            left: '50%',
            bottom: 72,
            transform: 'translateX(-50%)',
            zIndex: 1000,
            width: 360,
            maxWidth: 'calc(100vw - 24px)',
            padding: 10,
            borderRadius: 8,
            border: '1px solid #d1d5db',
            background: '#ffffff',
            boxShadow: '0 12px 32px rgba(17,24,39,0.18)',
          }}
        >
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              aria-label="Image URL"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://example.com/map.png"
              style={{
                minWidth: 0,
                flex: 1,
                height: 34,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                padding: '0 8px',
                fontSize: 13,
              }}
            />
            <button
              type="button"
              title="Insert URL"
              aria-label="Insert URL"
              onClick={insertFromUrl}
              disabled={url.trim().length === 0}
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: url.trim().length === 0 ? '#f3f4f6' : '#ffffff',
                color: url.trim().length === 0 ? '#9ca3af' : '#111827',
                cursor: url.trim().length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              <Link size={16} />
            </button>
            <button
              type="button"
              title="Upload image"
              aria-label="Upload image"
              onClick={() => fileInputRef.current?.click()}
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              <Upload size={16} />
            </button>
            <button
              type="button"
              title="Close"
              aria-label="Close"
              onClick={closeDialog}
              style={{
                width: 34,
                height: 34,
                borderRadius: 6,
                border: '1px solid #d1d5db',
                background: '#ffffff',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              <X size={16} />
            </button>
          </div>
          <input
            ref={fileInputRef}
            aria-label="Image file"
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => {
              void insertFromFile(event.currentTarget.files?.[0]);
              event.currentTarget.value = '';
            }}
          />
        </div>
      )}
    </>
  );
}
