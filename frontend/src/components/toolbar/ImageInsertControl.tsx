import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ImageIcon, Link, Upload, X } from 'lucide-react';
import { useInteractionStore } from '../../store/interaction.store';
import { insertImageFromSource, readFileAsDataUrl } from './image-insert';

interface ImageInsertControlProps {
  resetInteraction: () => void;
}

export default function ImageInsertControl({ resetInteraction }: ImageInsertControlProps) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState('');
  const setTool = useInteractionStore((state) => state.setTool);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function openDialog() {
    resetInteraction();
    setTool('select');
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
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-colors ${
          open ? 'bg-primary text-paper' : 'text-ink hover:bg-panel'
        }`}
      >
        <ImageIcon size={18} />
      </button>

      {open &&
        createPortal(
          <div
            role="dialog"
            aria-label="Insert image"
            className="fixed left-1/2 z-[1000] w-[360px] max-w-[calc(100vw-24px)] -translate-x-1/2 rounded-lg border border-field-border bg-paper p-2.5 shadow-lg"
            style={{ bottom: 72 }}
          >
            <div className="flex gap-2">
              <input
                aria-label="Image URL"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                placeholder="https://example.com/map.png"
                className="h-[34px] min-w-0 flex-1 rounded-md border border-field-border px-2 text-[13px] text-ink"
              />
              <button
                type="button"
                title="Insert URL"
                aria-label="Insert URL"
                onClick={insertFromUrl}
                disabled={url.trim().length === 0}
                className={`h-[34px] w-[34px] rounded-md border border-field-border ${
                  url.trim().length === 0
                    ? 'cursor-not-allowed bg-panel text-muted'
                    : 'cursor-pointer bg-paper text-ink hover:bg-panel'
                }`}
              >
                <Link size={16} />
              </button>
              <button
                type="button"
                title="Upload image"
                aria-label="Upload image"
                onClick={() => fileInputRef.current?.click()}
                className="h-[34px] w-[34px] cursor-pointer rounded-md border border-field-border bg-paper text-ink hover:bg-panel"
              >
                <Upload size={16} />
              </button>
              <button
                type="button"
                title="Close"
                aria-label="Close"
                onClick={closeDialog}
                className="h-[34px] w-[34px] cursor-pointer rounded-md border border-field-border bg-paper text-ink hover:bg-panel"
              >
                <X size={16} />
              </button>
            </div>
            <input
              ref={fileInputRef}
              aria-label="Image file"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                void insertFromFile(event.currentTarget.files?.[0]);
                event.currentTarget.value = '';
              }}
            />
          </div>,
          document.body,
        )}
    </>
  );
}
