import Whiteboard from '../canvas/Whiteboard';
import HomePage from './HomePage';

export default function App() {
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
