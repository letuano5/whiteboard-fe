import { useState } from 'react';
import type { RoomAccessMode } from '../types/shared';
import { revokeRoomShareLink, setRoomShareMode } from '../rooms/room-access-api';
import { ManageAccessModal } from '../rooms/ManageAccessModal';
import { useRoomAccessStore } from '../rooms/room-access.store';

export default function ShareLinkButton() {
  const [copied, setCopied] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const roomId = useRoomAccessStore((state) => state.roomId);
  const role = useRoomAccessStore((state) => state.effectiveRole);
  const visibility = useRoomAccessStore((state) => state.visibility);
  const setRoomAccess = useRoomAccessStore((state) => state.setRoomAccess);

  if (role !== 'owner' || !roomId) return null;

  function handleCopy() {
    navigator.clipboard.writeText(window.location.href).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      },
      () => {
        window.prompt('Copy this link:', window.location.href);
      },
    );
  }

  function handleModeChange(value: string) {
    if (!isRoomAccessMode(value) || !roomId) return;
    void setRoomShareMode(roomId, value).then(setRoomAccess);
  }

  function handleRevoke() {
    if (!roomId) return;
    void revokeRoomShareLink(roomId).then(setRoomAccess);
  }

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
      }}
    >
      <select
        aria-label="Share link mode"
        value={visibility}
        onChange={(event) => handleModeChange(event.target.value)}
        style={{ height: 32, border: '1px solid #c8d2ca', borderRadius: 6, background: '#fff' }}
      >
        <option value="private">Private</option>
        <option value="link_view">Link view</option>
        <option value="link_edit">Link edit</option>
        <option value="public_view">Public view</option>
      </select>
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
        title="Copy share link"
      >
        {copied ? 'Copied!' : 'Copy link'}
      </button>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        Manage access
      </button>
      <button
        type="button"
        onClick={handleRevoke}
        className="flex items-center gap-1.5 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
      >
        Revoke link
      </button>
      {modalOpen && <ManageAccessModal roomId={roomId} onClose={() => setModalOpen(false)} />}
    </div>
  );
}

function isRoomAccessMode(value: string): value is RoomAccessMode {
  return (
    value === 'private' || value === 'link_view' || value === 'link_edit' || value === 'public_view'
  );
}
