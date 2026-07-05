import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ManageAccessModal } from '../rooms/ManageAccessModal';
import { useRoomAccessStore } from '../rooms/room-access.store';

export default function ShareLinkButton() {
  const [modalOpen, setModalOpen] = useState(false);
  const roomId = useRoomAccessStore((state) => state.roomId);
  const role = useRoomAccessStore((state) => state.effectiveRole);

  if (role !== 'owner' || !roomId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-paper shadow-md transition-opacity hover:opacity-90"
      >
        <Share2 size={16} />
        Share
      </button>
      {modalOpen && <ManageAccessModal roomId={roomId} onClose={() => setModalOpen(false)} />}
    </>
  );
}
