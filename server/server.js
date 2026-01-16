import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { customAlphabet } from 'nanoid';
import { GameManager } from './gameManager.js';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
    cors: {
        origin: process.env.NODE_ENV === 'production'
            ? [
                "https://imposter-artist.vercel.app",
                "https://*.vercel.app"
            ]
            : [
                "http://localhost:5173",
                "http://localhost:3000"
            ],
        methods: ["GET", "POST"]
    }
});

app.use(cors());
app.use(express.json());

const gameManager = new GameManager();
const nanoid = customAlphabet('0123456789', 6);

// Store socket to player mappings
const socketToPlayer = new Map();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    // Create or join room
    socket.on('create_room', (playerName, callback) => {
        const roomCode = nanoid();
        const playerId = socket.id;

        const room = gameManager.createRoom(roomCode, playerId);
        const player = gameManager.addPlayer(roomCode, {
            id: playerId,
            name: playerName,
            avatar: '👤'
        });

        socket.join(roomCode);
        socketToPlayer.set(socket.id, { roomCode, playerId });

        callback({ success: true, roomCode, player, room });
        io.to(roomCode).emit('room_update', room);
    });

    socket.on('join_room', ({ roomCode, playerName }, callback) => {
        const room = gameManager.getRoom(roomCode);

        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        if (room.phase !== 'LOBBY') {
            callback({ success: false, error: 'Game already in progress' });
            return;
        }

        if (room.players.length >= room.settings.maxPlayers) {
            callback({ success: false, error: 'Room is full' });
            return;
        }

        const playerId = socket.id;
        const player = gameManager.addPlayer(roomCode, {
            id: playerId,
            name: playerName,
            avatar: '👤'
        });

        socket.join(roomCode);
        socketToPlayer.set(socket.id, { roomCode, playerId });

        callback({ success: true, player, room });
        io.to(roomCode).emit('room_update', room);
    });

    socket.on('start_game', (roomCode, callback) => {
        const room = gameManager.getRoom(roomCode);

        if (!room) {
            callback({ success: false, error: 'Room not found' });
            return;
        }

        if (room.hostId !== socket.id) {
            callback({ success: false, error: 'Only host can start game' });
            return;
        }

        const updatedRoom = gameManager.startGame(roomCode);

        if (!updatedRoom) {
            callback({ success: false, error: 'Not enough players' });
            return;
        }

        callback({ success: true });


        // Broadcast phase change immediately
        io.to(roomCode).emit('room_update', updatedRoom);
    });

    socket.on('submit_word', ({ roomCode, word }, callback) => {
        const updatedRoom = gameManager.submitWord(roomCode, socket.id, word);

        if (!updatedRoom) {
            callback({ success: false, error: 'Invalid submission' });
            return;
        }

        callback({ success: true });
        io.to(roomCode).emit('room_update', updatedRoom);

        // If all words submitted, send word/role to each player
        if (updatedRoom.phase === 'DRAWING') {
            console.log('📢 Emitting word_reveal to all players...');
            updatedRoom.players.forEach(player => {
                const playerSocket = io.sockets.sockets.get(player.id);
                if (playerSocket) {
                    const revealData = {
                        role: player.role,
                        word: player.role === 'IMPOSTER' ? null : updatedRoom.word,
                        isImposter: player.role === 'IMPOSTER'
                    };
                    console.log(`  → ${player.name}: role=${revealData.role}, word=${revealData.word}`);
                    playerSocket.emit('word_reveal', revealData);
                } else {
                    console.log(`  ⚠️ Socket not found for ${player.name}`);
                }
            });
        }
    });

    socket.on('submit_drawing', ({ roomCode, drawingData }, callback) => {
        const updatedRoom = gameManager.submitDrawing(roomCode, socket.id, drawingData);

        if (!updatedRoom) {
            callback({ success: false, error: 'Not your turn or invalid action' });
            return;
        }

        callback({ success: true });
        io.to(roomCode).emit('room_update', updatedRoom);
        io.to(roomCode).emit('new_drawing', {
            playerId: socket.id,
            round: updatedRoom.round - (updatedRoom.currentTurnIndex === 0 ? 1 : 0),
            data: drawingData
        });
    });



    socket.on('submit_guess', ({ roomCode, guess }, callback) => {
        const result = gameManager.submitGuess(roomCode, socket.id, guess);

        if (!result) {
            callback({ success: false, error: 'Invalid guess' });
            return;
        }

        callback({
            success: true,
            isCorrect: result.isCorrect,
            word: result.isCorrect ? result.room.word : null
        });

        // Broadcast guess result
        io.to(roomCode).emit('player_guessed', {
            playerId: socket.id,
            isCorrect: result.isCorrect,
            isLocked: result.isCorrect
        });

        // Check for imposter instant win
        if (result.room.phase === 'GAME_OVER') {
            io.to(roomCode).emit('room_update', result.room);
        }
    });

    socket.on('submit_message', ({ roomCode, message }, callback) => {
        const result = gameManager.submitMessage(roomCode, socket.id, message);

        if (!result) {
            callback({ success: false, error: 'Failed to send message' });
            return;
        }

        callback({ success: true });
        io.to(roomCode).emit('new_message', result.message);
    });

    socket.on('submit_vote', ({ roomCode, candidateId }, callback) => {
        const updatedRoom = gameManager.submitVote(roomCode, socket.id, candidateId);

        if (!updatedRoom) {
            callback({ success: false, error: 'Invalid vote' });
            return;
        }

        callback({ success: true });
        // Broadcast the updated room so everyone sees the new vote
        io.to(roomCode).emit('room_update', updatedRoom);
        io.to(roomCode).emit('vote_cast', { voterId: socket.id });

        // Check if voting complete
        if (updatedRoom.phase === 'GAME_OVER') {
            setTimeout(() => {
                io.to(roomCode).emit('room_update', updatedRoom);
            }, 2000);
        }
    });

    socket.on('force_vote', (roomCode, callback) => {
        const updatedRoom = gameManager.forceVote(roomCode, socket.id);

        if (!updatedRoom) {
            callback({ success: false, error: 'Failed to force vote (only host can do this)' });
            return;
        }

        callback({ success: true });
        io.to(roomCode).emit('room_update', updatedRoom);
    });

    socket.on('reset_game', (roomCode, callback) => {
        const room = gameManager.getRoom(roomCode);

        if (!room || room.hostId !== socket.id) {
            callback({ success: false, error: 'Only host can reset game' });
            return;
        }

        const resetRoom = gameManager.resetGame(roomCode);
        callback({ success: true });
        io.to(roomCode).emit('room_update', resetRoom);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);

        const playerData = socketToPlayer.get(socket.id);
        if (playerData) {
            const { roomCode, playerId } = playerData;
            gameManager.removePlayer(roomCode, playerId);

            const room = gameManager.getRoom(roomCode);
            if (room) {
                io.to(roomCode).emit('room_update', room);
                io.to(roomCode).emit('player_left', { playerId });
            }

            socketToPlayer.delete(socket.id);
        }
    });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
    console.log(`🎨 Imposter Artist server running on port ${PORT}`);
});
