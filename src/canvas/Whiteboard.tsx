import { useElementsStore, useCameraStore } from '../store';
import SvgLayer from './layers/SvgLayer';

export default function Whiteboard() {
  const elements = useElementsStore((s) => s.elements);
  const camera = useCameraStore((s) => s.camera);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <SvgLayer elements={elements} camera={camera} />
    </div>
  );
}
