const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname)));

// هيكل الغرف
const rooms = new Map();

wss.on('connection', (ws) => {
    let currentRoom = 'global';
    ws.room = currentRoom;
    if (!rooms.has(currentRoom)) rooms.set(currentRoom, new Set());
    rooms.get(currentRoom).add(ws);

    ws.on('message', (msg) => {
        try {
            const data = JSON.parse(msg);
            
            // الانضمام إلى غرفة
            if (data.type === 'join-room') {
                if (ws.room) rooms.get(ws.room)?.delete(ws);
                ws.room = data.room;
                if (!rooms.has(data.room)) rooms.set(data.room, new Set());
                rooms.get(data.room).add(ws);
                ws.send(JSON.stringify({ type: 'room-joined', room: data.room }));
                return;
            }
            
            // بث إلى جميع أعضاء الغرفة
            const roomSet = rooms.get(ws.room);
            if (roomSet) {
                roomSet.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(JSON.stringify(data));
                    }
                });
            }
        } catch (e) {}
    });

    ws.on('close', () => {
        rooms.get(ws.room)?.delete(ws);
    });
});

server.listen(3000, () => {
    console.log('☢️ Beto Nuclear Bomb Server running on http://localhost:3000');
});
