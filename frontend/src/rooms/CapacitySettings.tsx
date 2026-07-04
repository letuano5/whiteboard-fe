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
    <section style={sectionStyle} aria-label="Capacity">
      <div style={sectionHeaderStyle}>
        <Users size={16} />
        Capacity
      </div>
      <div style={limitGridStyle}>
        <label style={labelStyle}>
          Participants
          <input
            aria-label="Max participants"
            inputMode="numeric"
            value={participantLimit}
            onChange={(event) => setParticipantLimit(event.target.value)}
            onBlur={() => handleLimitBlur('maxParticipants', participantLimit)}
            placeholder={`Up to ${ROOM_CAPACITY_LIMITS.MAX_PARTICIPANTS}`}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Editors
          <input
            aria-label="Max editors"
            inputMode="numeric"
            value={editorLimit}
            onChange={(event) => setEditorLimit(event.target.value)}
            onBlur={() => handleLimitBlur('maxEditors', editorLimit)}
            placeholder={`Up to ${ROOM_CAPACITY_LIMITS.MAX_EDITORS}`}
            style={inputStyle}
          />
        </label>
      </div>
      <div style={errorSlotStyle}>
        {error && <div style={{ color: '#b91c1c', fontSize: 13 }}>{error}</div>}
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

const sectionStyle = {
  display: 'grid',
  gap: 10,
  marginTop: 18,
  paddingTop: 16,
  borderTop: '1px solid #e4ebe5',
} satisfies React.CSSProperties;

const sectionHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 13,
  fontWeight: 700,
} satisfies React.CSSProperties;

const limitGridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
  gap: 8,
} satisfies React.CSSProperties;

const labelStyle = {
  display: 'grid',
  gap: 5,
  minWidth: 0,
  fontSize: 12,
  fontWeight: 700,
  color: '#34443a',
} satisfies React.CSSProperties;

const inputStyle = {
  minWidth: 0,
  height: 34,
  border: '1px solid #c8d2ca',
  borderRadius: 6,
  padding: '0 10px',
} satisfies React.CSSProperties;

const errorSlotStyle = {
  minHeight: 18,
} satisfies React.CSSProperties;
