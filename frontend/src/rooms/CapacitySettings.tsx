import { useState } from 'react';
import { Users } from 'lucide-react';
import { ROOM_CAPACITY_LIMITS } from '../types/shared';
import { updateRoomCapacitySettings } from './room-access-api';
import { useRoomAccessStore } from './room-access.store';

interface CapacitySettingsProps {
  roomId: string;
}

type LimitKey = 'maxParticipants' | 'maxEditors';

export function CapacitySettings({ roomId }: CapacitySettingsProps) {
  const maxParticipants = useRoomAccessStore((state) => state.maxParticipants);
  const maxEditors = useRoomAccessStore((state) => state.maxEditors);
  const setRoomAccess = useRoomAccessStore((state) => state.setRoomAccess);
  const [participantLimit, setParticipantLimit] = useState(limitToText(maxParticipants));
  const [editorLimit, setEditorLimit] = useState(limitToText(maxEditors));
  const [error, setError] = useState<string | null>(null);

  async function apply(input: Parameters<typeof updateRoomCapacitySettings>[1]) {
    const nextParticipants =
      input.maxParticipants !== undefined ? input.maxParticipants : maxParticipants;
    const nextEditors = input.maxEditors !== undefined ? input.maxEditors : maxEditors;
    const validationError = validateCapacity(nextParticipants, nextEditors);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setError(null);
      setRoomAccess(await updateRoomCapacitySettings(roomId, input));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Room capacity update failed.');
    }
  }

  function handleLimitBlur(key: LimitKey, value: string) {
    const maxValue =
      key === 'maxParticipants'
        ? ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS
        : ROOM_CAPACITY_LIMITS.MAX_EDITORS;
    const parsed = parseLimit(value, maxValue);
    if (parsed === undefined) {
      setError(`Limits must be empty or whole numbers from 1 to ${maxValue}.`);
      return;
    }
    void apply({ [key]: parsed });
  }

  return (
    <section className="mt-[18px] grid gap-2.5 border-t border-rule pt-4" aria-label="Capacity">
      <div className="flex items-center gap-2 text-[13px] font-bold text-ink">
        <Users size={16} />
        Capacity
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1 text-xs font-bold text-muted">
          Participants
          <input
            aria-label="Max participants"
            inputMode="numeric"
            value={participantLimit}
            onChange={(event) => setParticipantLimit(event.target.value)}
            onBlur={() => handleLimitBlur('maxParticipants', participantLimit)}
            placeholder={`Up to ${ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS}`}
            className="h-[34px] min-w-0 rounded-md border border-field-border px-2.5 text-ink"
          />
        </label>
        <label className="grid min-w-0 gap-1 text-xs font-bold text-muted">
          Editors
          <input
            aria-label="Max editors"
            inputMode="numeric"
            value={editorLimit}
            onChange={(event) => setEditorLimit(event.target.value)}
            onBlur={() => handleLimitBlur('maxEditors', editorLimit)}
            placeholder={`Up to ${ROOM_CAPACITY_LIMITS.MAX_EDITORS}`}
            className="h-[34px] min-w-0 rounded-md border border-field-border px-2.5 text-ink"
          />
        </label>
      </div>
      <div className="min-h-[18px]">
        {error && <div className="text-[13px] text-danger">{error}</div>}
      </div>
    </section>
  );
}

function limitToText(value: number | null): string {
  return value === null ? '' : String(value);
}

function parseLimit(value: string, maxValue: number): number | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed);
  return Number.isSafeInteger(parsed) && parsed > 0 && parsed <= maxValue ? parsed : undefined;
}

function validateCapacity(
  maxParticipants: number | null,
  maxEditors: number | null,
): string | null {
  if (maxParticipants !== null && maxEditors !== null && maxEditors > maxParticipants) {
    return 'Editor limit cannot exceed participant limit.';
  }
  return null;
}
