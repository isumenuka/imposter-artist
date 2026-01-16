export enum Role {
  ARTIST = 'ARTIST',
  IMPOSTER = 'IMPOSTER',
}

export enum GamePhase {
  LOBBY = 'LOBBY',
  WORD_SUBMISSION = 'WORD_SUBMISSION',
  DRAWING = 'DRAWING',
  VOTING = 'VOTING',
  GAME_OVER = 'GAME_OVER',
}

export interface LobbySettings {
  maxPlayers: number;
  strokesPerTurn: number;
  allowExtraColor: boolean;
}

export interface Player {
  id: string;
  name: string;
  role: Role | null;
  avatar: string;
  color: string;
  hasGuessed: boolean;
  isLocked: boolean;
  actionsTaken: number;
  votedOut: boolean;
  hasSubmittedWord: boolean;
}

export interface Drawing {
  playerId: string;
  round: number;
  data: string; // Base64 image
  timestamp: number;
}

export interface Guess {
  playerId: string;
  guess: string;
  isCorrect: boolean;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  color: string;
}

export interface Room {
  roomCode: string;
  hostId: string;
  players: Player[];
  phase: GamePhase;
  settings: LobbySettings;
  word: string | null;
  imposterId: string | null;
  currentTurnIndex: number;
  round: number;
  maxRounds: number;
  drawings: Drawing[];
  guesses: Guess[];
  chatMessages: ChatMessage[];
  votes: Record<string, string>; // voterId -> candidateId
  winner: 'ARTISTS' | 'IMPOSTER' | null;
  winReason: string | null;
  wordSubmissions: Array<{ playerId: string; word: string }>;
}

export interface WordReveal {
  role: Role;
  word: string | null;
  isImposter: boolean;
}
