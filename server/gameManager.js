import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load words
const wordsData = JSON.parse(readFileSync(join(__dirname, 'data', 'words.json'), 'utf-8'));

export class GameManager {
  constructor() {
    this.rooms = new Map();
  }

  createRoom(roomCode, hostId) {
    const room = {
      roomCode,
      hostId,
      players: [],
      phase: 'LOBBY',
      settings: {
        maxPlayers: 8,
        strokesPerTurn: 2,
        allowExtraColor: true
      },
      word: null,
      imposterId: null,
      currentTurnIndex: 0,
      round: 1,
      maxRounds: 3,
      drawings: [],
      guesses: [],
      chatMessages: [],
      votes: {},
      winner: null,
      winReason: null,
      wordSubmissions: []
    };
    this.rooms.set(roomCode, room);
    return room;
  }

  getRoom(roomCode) {
    return this.rooms.get(roomCode);
  }

  addPlayer(roomCode, player) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    // Assign unique color
    const usedColors = room.players.map(p => p.color);
    const availableColors = [
      '#ef4444', '#3b82f6', '#22c55e', '#eab308',
      '#a855f7', '#ec4899', '#14b8a6', '#f97316'
    ];
    const color = availableColors.find(c => !usedColors.includes(c)) || availableColors[0];

    const newPlayer = {
      ...player,
      color,
      hasGuessed: false,
      isLocked: false,
      actionsTaken: 0,
      votedOut: false,
      hasSubmittedWord: false
    };

    room.players.push(newPlayer);
    return newPlayer;
  }

  removePlayer(roomCode, playerId) {
    const room = this.getRoom(roomCode);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== playerId);

    // If host leaves, assign new host
    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
    }

    // Delete room if empty
    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
    }
  }

  startGame(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room || room.players.length < 2) return null;

    // Move to word submission phase
    room.phase = 'WORD_SUBMISSION';
    room.wordSubmissions = [];

    // Reset player flags
    room.players = room.players.map(p => ({
      ...p,
      hasSubmittedWord: false
    }));

    return room;
  }

  submitWord(roomCode, playerId, word) {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'WORD_SUBMISSION') return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.hasSubmittedWord) return null;

    // Store word submission
    room.wordSubmissions.push({ playerId, word: word.trim() });
    player.hasSubmittedWord = true;

    console.log(`📝 Word submitted by ${player.name}: "${word.trim()}"`);
    console.log(`📊 Total submissions: ${room.wordSubmissions.length}/${room.players.length}`);

    // Check if all players have submitted
    if (room.wordSubmissions.length === room.players.length) {
      console.log('✅ All words submitted! Selecting imposter and word...');

      // Randomly select imposter first
      const randomIndex = Math.floor(Math.random() * room.players.length);
      room.imposterId = room.players[randomIndex].id;
      const imposterName = room.players[randomIndex].name;

      console.log(`🎭 Imposter selected: ${imposterName} (index ${randomIndex})`);

      // Filter out imposter's word from submissions
      const nonImposterWords = room.wordSubmissions.filter(
        submission => submission.playerId !== room.imposterId
      );

      console.log(`📚 Available words (excluding imposter): ${nonImposterWords.map(s => `"${s.word}"`).join(', ')}`);

      // Select random word from remaining words
      if (nonImposterWords.length > 0) {
        const randomWordIndex = Math.floor(Math.random() * nonImposterWords.length);
        room.word = nonImposterWords[randomWordIndex].word;
        console.log(`🎯 Selected word: "${room.word}" (index ${randomWordIndex})`);
      } else {
        // Edge case: only imposter submitted (should not happen with 2+ players)
        room.word = room.wordSubmissions[0].word;
        console.log(`⚠️ Edge case: Using first word "${room.word}"`);
      }

      // Assign roles to all players
      room.players = room.players.map(p => ({
        ...p,
        role: p.id === room.imposterId ? 'IMPOSTER' : 'ARTIST'
      }));

      console.log('👥 Roles assigned:');
      room.players.forEach(p => {
        console.log(`  - ${p.name}: ${p.role}`);
      });

      // Move to drawing phase
      room.phase = 'DRAWING';
      room.currentTurnIndex = 0;
      room.round = 1;

      console.log('🎨 Moving to DRAWING phase');
    }

    return room;
  }

  submitDrawing(roomCode, playerId, drawingData) {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'DRAWING') return null;

    const currentPlayer = room.players[room.currentTurnIndex];
    if (currentPlayer.id !== playerId) return null;

    // Add drawing
    room.drawings.push({
      playerId,
      round: room.round,
      data: drawingData,
      timestamp: Date.now()
    });

    // Reset actions for current player
    currentPlayer.actionsTaken = 0;

    // Move to next turn
    room.currentTurnIndex++;

    // Check if round is complete
    if (room.currentTurnIndex >= room.players.length) {
      room.currentTurnIndex = 0;
      room.round++;

      // Check if all rounds complete
      if (room.round > room.maxRounds) {
        room.phase = 'VOTING';
      }
    }

    return room;
  }

  submitMessage(roomCode, playerId, text) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player) return null;

    const message = {
      id: Date.now().toString(36) + Math.random().toString(36).substr(2),
      senderId: playerId,
      senderName: player.name,
      text: text.trim(),
      timestamp: Date.now(),
      color: player.color
    };

    room.chatMessages.push(message);

    // Keep only last 50 messages
    if (room.chatMessages.length > 50) {
      room.chatMessages.shift();
    }

    return { room, message };
  }

  submitGuess(roomCode, playerId, guess) {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'DRAWING') return null;

    const player = room.players.find(p => p.id === playerId);
    if (!player || player.hasGuessed) return null;

    const isCorrect = guess.toLowerCase().trim() === room.word.toLowerCase();

    player.hasGuessed = true;

    room.guesses.push({
      playerId,
      guess,
      isCorrect,
      timestamp: Date.now()
    });

    if (isCorrect) {
      player.isLocked = true;

      // Check if imposter guessed correctly - instant win
      if (player.id === room.imposterId) {
        room.phase = 'GAME_OVER';
        room.winner = 'IMPOSTER';
        room.winReason = `${player.name} (Imposter) guessed the word correctly!`;
      }
    }

    return { room, isCorrect, isImposter: player.id === room.imposterId };
  }

  submitVote(roomCode, voterId, candidateId) {
    const room = this.getRoom(roomCode);
    if (!room || room.phase !== 'VOTING') return null;

    // Prevent self-voting
    if (voterId === candidateId) return null;

    room.votes[voterId] = candidateId;

    // Check if all players voted
    if (Object.keys(room.votes).length === room.players.length) {
      this.calculateVoteResults(roomCode);
    }

    return room;
  }

  forceVote(roomCode, playerId) {
    const room = this.getRoom(roomCode);
    if (!room || room.hostId !== playerId) return null;

    // Transition directly to voting
    room.phase = 'VOTING';

    // Reset any turn-specific states if needed
    room.currentTurnIndex = 0;

    console.log(`🛑 Force vote triggered by host ${room.players.find(p => p.id === playerId)?.name}`);
    return room;
  }

  calculateVoteResults(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return;

    const voteCounts = {};
    room.players.forEach(p => voteCounts[p.id] = 0);

    // Count votes
    Object.values(room.votes).forEach(candidateId => {
      voteCounts[candidateId] = (voteCounts[candidateId] || 0) + 1;
    });

    // Find player with most votes
    let maxVotes = 0;
    let votedOutId = null;
    let isTie = false;

    Object.entries(voteCounts).forEach(([playerId, count]) => {
      if (count > maxVotes) {
        maxVotes = count;
        votedOutId = playerId;
        isTie = false;
      } else if (count === maxVotes && count > 0) {
        isTie = true;
      }
    });

    room.phase = 'GAME_OVER';

    // Determine winner
    if (isTie || !votedOutId) {
      room.winner = 'IMPOSTER';
      room.winReason = 'Vote ended in a tie. Imposter survives!';
    } else if (votedOutId === room.imposterId) {
      room.winner = 'ARTISTS';
      room.winReason = 'The Imposter was voted out!';
    } else {
      const votedOutPlayer = room.players.find(p => p.id === votedOutId);
      room.winner = 'IMPOSTER';
      room.winReason = `Wrong player voted out! ${votedOutPlayer.name} was innocent.`;
    }

    return room;
  }

  resetGame(roomCode) {
    const room = this.getRoom(roomCode);
    if (!room) return null;

    room.phase = 'LOBBY';
    room.word = null;
    room.imposterId = null;
    room.currentTurnIndex = 0;
    room.round = 1;
    room.drawings = [];
    room.guesses = [];
    room.chatMessages = [];
    room.votes = {};
    room.winner = null;
    room.winReason = null;
    room.wordSubmissions = [];

    room.players = room.players.map(p => ({
      ...p,
      role: null,
      hasGuessed: false,
      isLocked: false,
      actionsTaken: 0,
      votedOut: false,
      hasSubmittedWord: false
    }));

    return room;
  }
}
