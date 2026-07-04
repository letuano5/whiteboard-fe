import { Crosshair, Plus } from 'lucide-react';
import { AuthPanel } from '../auth/AuthPanel';
import { roomPath } from './routing';

export default function HomePage() {
  function handleCreateRoom() {
    const id = crypto.randomUUID();
    window.history.pushState({}, '', roomPath(id));
    window.location.reload();
  }

  return (
    <div
      className="min-h-screen w-screen bg-[#f4f8f5] text-[#18231d]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(23,63,53,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(23,63,53,0.08) 1px, transparent 1px)',
        backgroundSize: '36px 36px',
      }}
    >
      <main className="mx-auto grid min-h-screen max-w-6xl items-center gap-8 px-6 py-8 md:grid-cols-[1.15fr_0.85fr]">
        <section className="rounded-lg border border-[#b7c7b7] bg-[#fbfdf9]/95 p-6 shadow-[0_20px_60px_rgba(28,41,33,0.12)] md:p-8">
          <div className="mb-8 flex h-12 w-12 items-center justify-center rounded-lg bg-[#d99022] text-[#17201c]">
            <Crosshair className="h-6 w-6" />
          </div>
          <h1 className="max-w-xl text-4xl font-bold text-[#17201c]">Tactical Whiteboard</h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-[#4c5d52]">
            Cộng tác realtime trên canvas vô hạn, sẵn sàng cho phòng chiến thuật và bản đồ điều
            phối.
          </p>
          <button
            onClick={handleCreateRoom}
            className="mt-8 flex h-12 items-center gap-2 rounded-lg bg-[#173f35] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#0f2d26] focus:outline-none focus:ring-2 focus:ring-[#2457c5] focus:ring-offset-2"
          >
            <Plus className="h-4 w-4" />
            Create new room
          </button>
        </section>

        <AuthPanel />
      </main>
    </div>
  );
}
