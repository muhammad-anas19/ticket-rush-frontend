import { io, Socket } from 'socket.io-client';

import { getSocketAuthToken } from '@/shared/api/axiosClient';

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;

if (!apiBaseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env.local.');
}

const socketOrigin = apiBaseUrl.replace(/\/api\/?$/, '');

let socket: Socket | null = null;

function getSocket(): Socket {
  socket ??= io(socketOrigin, {
    autoConnect: false,
    transports: ['websocket'],
    auth: (callback) => {
      void getSocketAuthToken().then((token) => callback({ token }));
    },
  });

  return socket;
}

export function ensureConnected(): Socket {
  const client = getSocket();
  if (!client.connected) {
    client.connect();
  }
  return client;
}
