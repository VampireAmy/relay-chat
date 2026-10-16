// Minimal ciphertext relay. This server never decrypts anything —
// it just forwards whatever bytes it receives to the other person
// in the same room. No accounts, no message storage, no logging
// of content.

const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8181;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  let filePath = url.pathname === '/' ? '/index.html' : url.pathname;
  const fullPath = path.join(PUBLIC_DIR, filePath);

  // don't serve anything outside the public folder, and don't treat
  // room-path requests to the socket as file requests
  if (!fullPath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  fs.readFile(fullPath, (err, data) => {
    if (err) {
      res.writeHead(200);
      res.end('ok'); // fall back to the old health-check response
      return;
    }
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server });

// room name -> Set of sockets in that room
const rooms = new Map();

const MAX_PEERS_PER_ROOM = 6; // e.g. up to 2 people with up to 3 devices each

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, 'http://x');
  const room = url.pathname.slice(1); // room name = path, e.g. /myroom123

  if (!room) {
    ws.close(4000, 'no room specified');
    return;
  }

  if (!rooms.has(room)) rooms.set(room, new Set());
  const peers = rooms.get(room);

  // Rooms allow more than 2 connections so the same person can have a
  // phone and a PC both open at once — the client distinguishes "your
  // other device" from "the other person" itself, since the server never
  // sees identities. This cap is just a sanity limit against runaway
  // connections, not a strict 1:1 rule anymore.
  if (peers.size >= MAX_PEERS_PER_ROOM) {
    ws.close(4001, 'room full');
    return;
  }

  peers.add(ws);
  console.log(`[+] joined room "${room}" (${peers.size}/${MAX_PEERS_PER_ROOM})`);

  ws.on('message', (data) => {
    // Forward the raw ciphertext blob to the other socket(s) in the room.
    // The server never inspects, decrypts, or stores this.
    // Important: explicitly relay as a UTF-8 string (text frame) — passing
    // the raw Buffer straight to .send() makes the 'ws' library default to
    // a binary frame, which the browser client doesn't expect and can't
    // read as base64, breaking every message regardless of passphrase.
    for (const peer of peers) {
      if (peer !== ws && peer.readyState === peer.OPEN) {
        peer.send(data.toString('utf8'));
      }
    }
  });

  ws.on('close', () => {
    peers.delete(ws);
    console.log(`[-] left room "${room}" (${peers.size}/${MAX_PEERS_PER_ROOM})`);
    if (peers.size === 0) rooms.delete(room);
  });
});

server.listen(PORT, () => {
  console.log(`relay listening on port ${PORT}`);
});
