import { useState } from 'react';
import { Copy } from 'lucide-react';
import type { RoomAccessMode } from '../types/shared';

interface LinkAccessPanelProps {
  visibility: RoomAccessMode;
  onChange: (mode: RoomAccessMode) => void;
}

const ACCESS_MODES: Array<{ value: RoomAccessMode; label: string }> = [
  { value: 'private', label: 'Private' },
  { value: 'link_view', label: 'Can view' },
  { value: 'link_edit', label: 'Can edit' },
];

export function LinkAccessPanel({ visibility, onChange }: LinkAccessPanelProps) {
  const [copied, setCopied] = useState(false);
  const shareUrl = window.location.href;
  const displayUrl = formatShareUrl(shareUrl);

  function handleCopy() {
    navigator.clipboard.writeText(shareUrl).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        window.prompt('Copy this link:', shareUrl);
      },
    );
  }

  return (
    <div className="rounded-[10px] bg-panel p-3" aria-label="Link access">
      <p className="m-0 mb-2 text-[11px] font-bold uppercase tracking-wide text-muted">
        Link access
      </p>
      <div className="grid grid-cols-3 gap-0.5 rounded-lg bg-rule p-0.5">
        {ACCESS_MODES.map((mode) => (
          <button
            key={mode.value}
            type="button"
            aria-pressed={visibility === mode.value}
            onClick={() => onChange(mode.value)}
            className={`flex h-[30px] items-center justify-center rounded-md text-center text-xs font-semibold ${
              visibility === mode.value
                ? 'bg-primary text-paper'
                : 'text-muted hover:bg-paper hover:text-ink'
            }`}
          >
            {mode.label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex h-9 items-stretch overflow-hidden rounded-lg border border-field-border bg-paper">
        <span
          className="flex min-w-0 flex-1 items-center truncate px-2.5 text-[13px] text-muted [font-variant-numeric:tabular-nums]"
          title={shareUrl}
        >
          {displayUrl}
        </span>
        <button
          type="button"
          onClick={handleCopy}
          className="flex shrink-0 items-center gap-1.5 border-l border-primary bg-primary px-3 text-[13px] font-semibold text-paper hover:opacity-90"
        >
          <Copy size={14} />
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function formatShareUrl(value: string): string {
  try {
    const url = new URL(value);
    const roomId = url.searchParams.get('room');
    if (!roomId) return `${url.host}${url.pathname}`;

    return `/?room=${compactRoomId(roomId)}`;
  } catch {
    return value;
  }
}

function compactRoomId(roomId: string): string {
  if (roomId.length <= 16) return roomId;
  return `${roomId.slice(0, 8)}...${roomId.slice(-4)}`;
}
