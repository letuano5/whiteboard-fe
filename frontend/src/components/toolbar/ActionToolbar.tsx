import { Keyboard } from 'lucide-react';
import ActionButton from './ActionButton';
import ToolbarActions from './ToolbarActions';
import ZoomControl from './ZoomControl';
import ShortcutsHelpModal from './shortcuts-help/ShortcutsHelpModal';
import { useShortcutsHelp } from './shortcuts-help/use-shortcuts-help';

function Divider() {
  return <div className="mx-0.5 h-[18px] w-px self-center bg-rule" />;
}

export default function ActionToolbar() {
  const { isOpen, open, close } = useShortcutsHelp();

  return (
    <>
      <div
        className="toolbar-scroll absolute left-1/2 z-10 flex max-w-[calc(100vw-16px)] -translate-x-1/2 items-center gap-0.5 overflow-x-auto rounded-[10px] border border-rule bg-paper p-1 shadow-md"
        style={{
          bottom: 'calc(72px + env(safe-area-inset-bottom))',
          scrollbarWidth: 'none',
          WebkitOverflowScrolling: 'touch',
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
