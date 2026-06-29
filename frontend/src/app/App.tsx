import { useEffect } from 'react';
import Whiteboard from '../canvas/Whiteboard';
import HomePage from './HomePage';
import { registerMutationHook } from '../store/mutation-pipeline';
import { createArrowBindingHook } from '../sync/arrow-binding-hook';

export default function App() {
  // T020: Register arrow-binding mutation hook once on mount
  useEffect(() => {
    const unregister = registerMutationHook(createArrowBindingHook());
    return unregister;
  }, []);

  const roomId = new URLSearchParams(window.location.search).get('room');

  if (roomId) {
    return (
      <div style={{ width: '100vw', height: '100vh' }}>
        <Whiteboard />
      </div>
    );
  }

  return <HomePage />;
}
