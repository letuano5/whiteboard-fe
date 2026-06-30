import { useEffect } from 'react';
import Whiteboard from '../canvas/Whiteboard';
import { DocumentDashboard } from '../documents/DocumentDashboard';
import { registerMutationHook } from '../store/mutation-pipeline';
import { createArrowBindingHook } from '../sync/arrow-binding-hook';

export default function App() {
  // T020: Register arrow-binding mutation hook once on mount
  useEffect(() => {
    const unregister = registerMutationHook(createArrowBindingHook());
    return unregister;
  }, []);

  const roomId = new URLSearchParams(window.location.search).get('room');
  const boardMode = roomId ? 'saved' : 'local';

  if (window.location.pathname === '/dashboard') {
    return <DocumentDashboard />;
  }

  return (
    <div style={{ width: '100vw', height: '100vh' }}>
      <Whiteboard mode={boardMode} />
    </div>
  );
}
