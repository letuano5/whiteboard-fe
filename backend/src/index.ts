import 'dotenv/config';
import { createAppServer } from './app.js';
import { createAutosaveManager } from './persistence/autosave.js';
import { prisma } from './persistence/prisma.js';
import { saveRoomElements } from './persistence/room-repository.js';
import { createRoomState } from './realtime/room-state.js';
import { createWhiteboardServer } from './realtime/whiteboard-server.js';

const PORT = process.env.PORT ?? 3001;

const { httpServer, io } = createAppServer();
const roomState = createRoomState();

const autosave = createAutosaveManager({
  getRoomElements: (roomId) => {
    const elMap = roomState.roomElements.get(roomId);
    return elMap ? [...elMap.values()] : [];
  },
  getRoomClock: (roomId) => roomState.roomClocks.get(roomId) ?? 0,
  saveRoomElements: (roomId, elements, targetDocumentClock) =>
    saveRoomElements(prisma, roomId, elements, targetDocumentClock),
});

createWhiteboardServer(io, { ...roomState, autosave });

httpServer.listen(PORT, () => console.log(`Server running on :${PORT}`));
