import io from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

class SocketService {
    constructor() {
        this.socket = null;
        this.connected = false;
    }

    connect() {
        if (this.socket?.connected) return;

        this.socket = io(SOCKET_URL, {
            transports: ['websocket', 'polling']
        });

        this.socket.on('connect', () => {
            console.log('✅ Connected to server');
            this.connected = true;
        });

        this.socket.on('disconnect', () => {
            console.log('❌ Disconnected from server');
            this.connected = false;
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
        });
    }

    disconnect() {
        if (this.socket) {
            this.socket.disconnect();
            this.socket = null;
            this.connected = false;
        }
    }

    // Room management
    createRoom(playerName, callback) {
        this.socket.emit('create_room', playerName, callback);
    }

    joinRoom(roomCode, playerName, callback) {
        this.socket.emit('join_room', { roomCode, playerName }, callback);
    }

    startGame(roomCode, callback) {
        this.socket.emit('start_game', roomCode, callback);
    }

    submitWord(roomCode, word, callback) {
        this.socket.emit('submit_word', { roomCode, word }, callback);
    }

    resetGame(roomCode, callback) {
        this.socket.emit('reset_game', roomCode, callback);
    }

    // Game actions
    submitDrawing(roomCode, drawingData, callback) {
        this.socket.emit('submit_drawing', { roomCode, drawingData }, callback);
    }

    emitDrawStroke(roomCode, data) {
        if (this.socket) {
            this.socket.emit('draw_stroke', { roomCode, ...data });
        }
    }

    submitGuess(roomCode, guess, callback) {
        this.socket.emit('submit_guess', { roomCode, guess }, callback);
    }

    submitMessage(roomCode, message, callback) {
        this.socket.emit('submit_message', { roomCode, message }, callback);
    }

    submitVote(roomCode, candidateId, callback) {
        this.socket.emit('submit_vote', { roomCode, candidateId }, callback);
    }

    forceVote(roomCode, callback) {
        this.socket.emit('force_vote', roomCode, callback);
    }

    // Event listeners
    onRoomUpdate(callback) {
        this.socket.on('room_update', callback);
    }

    onWordReveal(callback) {
        this.socket.on('word_reveal', callback);
    }

    onNewDrawing(callback) {
        this.socket.on('new_drawing', callback);
    }

    onDrawStroke(callback) {
        this.socket.on('draw_stroke', callback);
    }

    onNewMessage(callback) {
        this.socket.on('new_message', callback);
    }

    onPlayerGuessed(callback) {
        this.socket.on('player_guessed', callback);
    }

    onVoteCast(callback) {
        this.socket.on('vote_cast', callback);
    }

    onPlayerLeft(callback) {
        this.socket.on('player_left', callback);
    }

    onConnect(callback) {
        if (this.socket) {
            this.socket.on('connect', callback);
        }
    }

    onDisconnect(callback) {
        if (this.socket) {
            this.socket.on('disconnect', callback);
        }
    }

    // Remove listeners
    removeAllListeners() {
        if (this.socket) {
            this.socket.removeAllListeners();
        }
    }
}

export default new SocketService();
