import { Keyboard } from 'lucide-react';
import ActionButton from './ActionButton';
import ToolbarActions from './ToolbarActions';
import ZoomControl from './ZoomControl';
import ShortcutsHelpModal from './shortcuts-help/ShortcutsHelpModal';
import { useShortcutsHelp } from './shortcuts-help/use-shortcuts-help';

function Divider() {
  return (
    <div
      style={{ width: 1, height: 18, background: '#e5e7eb', margin: '0 2px', alignSelf: 'center' }}
    />
  );
}

export default function ActionToolbar() {
  const { isOpen, open, close } = useShortcutsHelp();

  return (
    <>
      <div
        className="toolbar-scroll"
        style={{
          position: 'absolute',
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          left: '50%',
          transform: 'translateX(-50%)',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          padding: '4px',
          maxWidth: 'calc(100vw - 16px)',
          overflowX: 'auto',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
          background: 'white',
          borderRadius: 10,
          boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
          border: '1px solid #e5e7eb',
          zIndex: 10,
        }}
      >
        <ToolbarActions />
        <Divider />
        <ZoomControl />
        <Divider />
        <ActionButton title="Keyboard shortcuts" disabled={false} onClick={open} Icon={Keyboard} />
      </div>
      {isOpen && <ShortcutsHelpModal onClose={close} />}
    </>
  );
}
