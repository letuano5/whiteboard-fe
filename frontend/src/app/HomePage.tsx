export default function HomePage() {
  function handleCreateRoom() {
    const id = crypto.randomUUID();
    window.history.pushState({}, '', '/?room=' + id);
    window.location.reload();
  }

  return (
    <div className="flex h-screen w-screen flex-col items-center justify-center gap-6 bg-gray-50">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900">Tactical Whiteboard</h1>
        <p className="mt-2 text-gray-500">Cộng tác realtime trên canvas vô hạn</p>
      </div>
      <button
        onClick={handleCreateRoom}
        className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
      >
        Create new room
      </button>
    </div>
  );
}
