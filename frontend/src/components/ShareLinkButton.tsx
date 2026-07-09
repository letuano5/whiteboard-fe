import { useState } from 'react';
import { Share2 } from 'lucide-react';
import { ManageAccessModal } from '../rooms/ManageAccessModal';
import { useRoomAccessStore } from '../rooms/room-access.store';

interface ShareLinkButtonProps {
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export default function ShareLinkButton({ isOpen, onOpenChange }: ShareLinkButtonProps = {}) {
  const [modalOpen, setModalOpen] = useState(false);
  const roomId = useRoomAccessStore((state) => state.roomId);
  const role = useRoomAccessStore((state) => state.effectiveRole);
  const open = isOpen ?? modalOpen;

  function setOpen(nextOpen: boolean) {
    if (onOpenChange) {
      onOpenChange(nextOpen);
      return;
    }

    setModalOpen(nextOpen);
  }

  if (role !== 'owner' || !roomId) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex h-10 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-sm font-semibold text-paper shadow-md transition-opacity hover:opacity-90"
      >
        <Share2 size={16} />
        Share
      </button>
      {open && <ManageAccessModal roomId={roomId} onClose={() => setOpen(false)} />}
    </>
  );
}
