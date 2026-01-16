import React, { useState, useEffect, useRef } from 'react';
import {
    Users, Copy, CheckCircle, Crown, Play, Eye, ZoomIn, ZoomOut, Send, MessageCircle
} from 'lucide-react';
import { GamePhase, Role, Room, WordReveal, ChatMessage } from './types';
import socketService from './services/socketService';
import Canvas from './components/Canvas';

const App: React.FC = () => {
    // Connection state
    const [connected, setConnected] = useState(false);
    const [myPlayerId, setMyPlayerId] = useState<string | null>(null);

    // UI state
    const [screen, setScreen] = useState<'menu' | 'lobby'>('menu');
    const [playerName, setPlayerName] = useState('');
    const [roomCodeInput, setRoomCodeInput] = useState('');
    const [copied, setCopied] = useState(false);
    const [zoom, setZoom] = useState(1);

    // Game state
    const [room, setRoom] = useState<Room | null>(null);
    const [myRole, setMyRole] = useState<Role | null>(null);
    const [guessMessage, setGuessMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

    const [secretWord, setSecretWord] = useState<string | null>(null);
    const [chatInput, setChatInput] = useState('');
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [wordInput, setWordInput] = useState('');
    const [isMobileChatOpen, setIsMobileChatOpen] = useState(false);
    const [selectedVoteId, setSelectedVoteId] = useState<string | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    // Clear selection when phase changes
    useEffect(() => {
        if (room?.phase !== GamePhase.VOTING) {
            setSelectedVoteId(null);
        }
    }, [room?.phase]);

    // Socket.IO connection
    useEffect(() => {
        socketService.connect();

        // On connect
        const handleConnect = () => {
            setConnected(true);
            setMyPlayerId(socketService.socket?.id || null);
        };

        // On disconnect
        const handleDisconnect = () => {
            setConnected(false);
        };

        // Attach listeners
        socketService.onConnect(handleConnect);
        socketService.onDisconnect(handleDisconnect);

        // Check if already connected (e.g. fast re-render)
        if (socketService.socket?.connected) {
            handleConnect();
        }

        // Room updates
        socketService.onRoomUpdate((updatedRoom: Room) => {
            setRoom(updatedRoom);
        });

        // Word reveal
        socketService.onWordReveal((data: WordReveal) => {
            console.log('📬 Received word_reveal:', data);
            console.log(`  → My role: ${data.role}`);
            console.log(`  → Word shown: ${data.word || '(hidden - I am imposter)'}`);
            setMyRole(data.role);
            setSecretWord(data.word);
        });

        // New message
        socketService.onNewMessage((msg: ChatMessage) => {
            setChatMessages(prev => [...prev, msg]);
        });

        // Player guessed (keeping for legacy server events if any)
        socketService.onPlayerGuessed((data: { playerId: string; isCorrect: boolean }) => {
            if (data.playerId === myPlayerId && data.isCorrect) {
                setGuessMessage({ text: '✅ Correct! You got it!', type: 'success' });
                setTimeout(() => setGuessMessage(null), 3000);
            }
        });

        socketService.socket?.on('connect', handleConnect);
        socketService.socket?.on('disconnect', handleDisconnect);

        return () => {
            socketService.socket?.off('connect', handleConnect);
            socketService.socket?.off('disconnect', handleDisconnect);
            socketService.removeAllListeners();
        };
    }, []);

    // Auto-scroll chat
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Sync room messages on join/update
    useEffect(() => {
        if (room && myPlayerId) {
            // Sync Role & Word from room state (Fallback if word_reveal event is missed)
            const me = room.players.find(p => p.id === myPlayerId);
            if (me && me.role && !myRole) {
                console.log('🔄 Syncing role from room state:', me.role);
                setMyRole(me.role);

                if (me.role === Role.ARTIST && room.word) {
                    setSecretWord(room.word);
                }
            }
        }

        if (room?.chatMessages) {
            // Basic sync (replace if new room state has more, or just rely on events)
            if (room.chatMessages.length > chatMessages.length) {
                setChatMessages(room.chatMessages);
            }
        }
    }, [room, myPlayerId]);

    // Helper functions
    const createRoom = () => {
        if (!playerName.trim()) return;

        socketService.createRoom(playerName, (response: any) => {
            if (response.success) {
                setRoom(response.room);
                setScreen('lobby');
            }
        });
    };

    const joinRoom = () => {
        if (!playerName.trim() || !roomCodeInput.trim()) return;

        socketService.joinRoom(roomCodeInput.toUpperCase(), playerName, (response: any) => {
            if (response.success) {
                setRoom(response.room);
                setScreen('lobby');
            } else {
                alert(response.error);
            }
        });
    };

    const startGame = () => {
        if (!room) return;

        socketService.startGame(room.roomCode, (response: any) => {
            if (!response.success) {
                alert(response.error);
            }
        });
    };

    const submitWord = () => {
        if (!room || !wordInput.trim()) return;

        socketService.submitWord(room.roomCode, wordInput, (response: any) => {
            if (response.success) {
                setWordInput('');
            } else {
                console.error(response.error);
            }
        });
    };

    const submitDrawing = (imageData: string) => {
        if (!room) return;

        socketService.submitDrawing(room.roomCode, imageData, (response: any) => {
            if (!response.success) {
                console.error(response.error);
            }
        });
    };

    const submitMessage = () => {
        if (!room || !chatInput.trim()) return;

        socketService.submitMessage(room.roomCode, chatInput, (response: any) => {
            if (response.success) {
                setChatInput('');
            } else {
                console.error("Failed to send message");
            }
        });
    };

    const submitVote = (candidateId: string) => {
        if (!room) return;

        socketService.submitVote(room.roomCode, candidateId, (response: any) => {
            if (!response.success) {
                console.error(response.error);
            }
        });
    };

    const handleForceVote = () => {
        if (!room) return;
        // Immediate action for debugging responsiveness
        console.log('🛑 Stop button triggered');
        socketService.forceVote(room.roomCode, (response: any) => {
            if (!response.success) {
                alert("Error: " + (response.error || "Unknown"));
            }
        });
    };

    const copyRoomCode = () => {
        if (room) {
            navigator.clipboard.writeText(room.roomCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const resetGame = () => {
        if (!room) return;

        socketService.resetGame(room.roomCode, (response: any) => {
            if (response.success) {
                setMyRole(null);
                setSecretWord(null);
                setChatMessages([]);
            }
        });
    };

    // Helper variables
    const myPlayer = room?.players.find(p => p.id === myPlayerId);
    const isHost = room?.hostId === myPlayerId;
    const isMyTurn = room?.players[room.currentTurnIndex]?.id === myPlayerId;
    const currentPlayer = room?.players[room.currentTurnIndex];

    // MENU SCREEN
    if (screen === 'menu') {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 md:p-8 bg-black">
                {/* Content */}
                <div className="relative z-10 w-full max-w-md px-2 sm:px-0">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-black p-6 sm:p-8 md:p-10 w-full">
                        <div className="text-center mb-8">
                            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-black mb-3">Imposter Artist</h1>
                            {!connected && <p className="text-gray-600 text-sm mt-2">Connecting...</p>}
                        </div>

                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Your name"
                                value={playerName}
                                onChange={(e) => setPlayerName(e.target.value)}
                                className="w-full px-5 py-4 text-base bg-white border-2 border-gray-900 rounded-lg focus:border-black focus:ring-2 focus:ring-gray-200 focus:outline-none transition-all"
                                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                            />

                            <button
                                onClick={createRoom}
                                disabled={!connected || !playerName.trim()}
                                className="w-full bg-black text-white py-4 text-lg rounded-lg font-semibold hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[50px]"
                            >
                                Create Room
                            </button>

                            <div className="flex items-center gap-3 my-5">
                                <div className="flex-1 h-px bg-gray-300"></div>
                                <span className="text-gray-500 text-sm">or</span>
                                <div className="flex-1 h-px bg-gray-300"></div>
                            </div>

                            <input
                                type="text"
                                placeholder="Room code"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value.toUpperCase())}
                                className="w-full px-5 py-4 text-lg bg-white border-2 border-gray-900 rounded-lg focus:border-black focus:ring-2 focus:ring-gray-200 focus:outline-none uppercase text-center tracking-widest font-mono transition-all"
                                maxLength={6}
                                inputMode="numeric"
                            />

                            <button
                                onClick={joinRoom}
                                disabled={!connected || !playerName.trim() || !roomCodeInput.trim()}
                                className="w-full bg-gray-900 text-white py-4 text-lg rounded-lg font-semibold hover:bg-gray-800 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[50px]"
                            >
                                Join Room
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // LOBBY SCREEN
    if (!room || room.phase === GamePhase.LOBBY) {
        return (
            <div className="min-h-screen relative flex items-center justify-center p-4 sm:p-6 md:p-8 bg-gray-100">
                {/* Content */}
                <div className="relative z-10 w-full max-w-3xl px-2 sm:px-0">
                    <div className="bg-white rounded-2xl shadow-2xl border-2 border-black p-5 sm:p-6 md:p-8 w-full">
                        {/* Header */}
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
                            <h2 className="text-2xl sm:text-3xl font-bold text-black text-center sm:text-left">Lobby</h2>
                            <button
                                onClick={copyRoomCode}
                                className="flex items-center gap-2 bg-black text-white px-5 sm:px-6 py-3.5 sm:py-3 rounded-lg hover:bg-gray-900 transition-all active:scale-95 w-full sm:w-auto justify-center min-h-[50px]"
                            >
                                {copied ? <CheckCircle size={18} /> : <Copy size={18} />}
                                <span className="font-mono font-bold text-lg">{room?.roomCode}</span>
                            </button>
                        </div>

                        {/* Players */}
                        <div className="bg-gray-100 rounded-xl p-4 sm:p-5 mb-6 border border-gray-300">
                            <h3 className="font-semibold text-lg mb-4 text-gray-900">{room?.players.length || 0} Players</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {room?.players.map((player) => (
                                    <div
                                        key={player.id}
                                        className="bg-white rounded-xl p-4 flex items-center gap-3 shadow-sm border-2 border-gray-900 hover:shadow-md transition-all"
                                    >
                                        <div className="w-12 h-12 rounded-full flex items-center justify-center text-2xl bg-gray-100">
                                            {player.avatar}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-gray-900 truncate">{player.name}</p>
                                            <p className="text-xs text-gray-600 flex items-center gap-1">
                                                {player.id === room.hostId && <Crown size={12} className="text-gray-900" />}
                                                {player.id === myPlayerId && <span>You</span>}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Actions */}
                        {isHost && (
                            <button
                                onClick={startGame}
                                disabled={(room?.players.length || 0) < 2}
                                className="w-full bg-black text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center justify-center gap-2 min-h-[52px]"
                            >
                                <Play size={20} />
                                Start Game
                            </button>
                        )}

                        {!isHost && (
                            <div className="text-center text-gray-600 py-3">
                                Waiting for host to start...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Word Submission Screen
    if (screen === 'lobby' && room?.phase === GamePhase.WORD_SUBMISSION) {
        return (
            <div className="min-h-screen w-full flex items-center justify-center p-4 sm:p-6 bg-gray-100">
                <div className="bg-white rounded-2xl shadow-2xl border-2 border-black p-6 sm:p-8 md:p-10 w-full max-w-md">
                    <h2 className="text-2xl sm:text-3xl font-bold text-black text-center mb-6">Submit Word</h2>

                    <div className="mb-6">
                        <input
                            type="text"
                            value={wordInput}
                            onChange={(e) => setWordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitWord()}
                            placeholder="Enter a word..."
                            disabled={room.players.find(p => p.id === myPlayerId)?.hasSubmittedWord}
                            className="w-full px-5 py-4 bg-white border-2 border-gray-900 rounded-lg focus:border-black focus:ring-2 focus:ring-gray-200 focus:outline-none text-lg text-center disabled:opacity-50 transition-all"
                        />
                    </div>

                    {!room.players.find(p => p.id === myPlayerId)?.hasSubmittedWord ? (
                        <button
                            onClick={submitWord}
                            disabled={!wordInput.trim()}
                            className="w-full bg-black text-white py-4 rounded-lg font-semibold text-lg hover:bg-gray-900 disabled:bg-gray-400 disabled:cursor-not-allowed transition-all active:scale-95 min-h-[50px]"
                        >
                            Submit
                        </button>
                    ) : (
                        <div className="text-center text-gray-900 font-semibold mb-4">
                            ✓ Submitted
                        </div>
                    )}

                    <div className="mt-6 space-y-3">
                        <div className="text-center text-gray-600 text-sm">
                            {room.wordSubmissions?.length || 0}/{room.players.length} submitted
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {room.players.map((player) => (
                                <div key={player.id} className={`text-xs p-2.5 rounded-lg text-center border-2 ${player.hasSubmittedWord
                                    ? 'bg-black text-white border-black'
                                    : 'bg-white text-gray-600 border-gray-300'
                                    }`}>
                                    {player.name}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    // MAIN GAME UI
    return (
        <div className="h-screen bg-gray-100 flex flex-col font-sans select-none overflow-hidden">
            {guessMessage && (
                <div className={`absolute top-10 left-1/2 transform -translate-x-1/2 z-[100] px-6 py-3 rounded-lg shadow-xl font-semibold ${guessMessage.type === 'success' ? 'bg-black text-white' : 'bg-gray-900 text-white'
                    }`}>
                    {guessMessage.text}
                </div>
            )}

            {/* Clean Toolbar - Hidden in mobile landscape to save space, visible on desktop */}
            <div className="bg-white border-b-2 border-black px-4 py-3 flex items-center justify-between flex-shrink-0 landscape:hidden lg:landscape:flex">
                <div className="flex items-center gap-4">
                    {/* Role & Word Badge - Always Visible */}
                    <div className="flex items-center gap-3">
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold shadow-sm flex items-center gap-2 ${myRole === Role.IMPOSTER ? 'bg-red-600 text-white' : 'bg-green-600 text-white'
                            }`}>
                            <Eye size={18} />
                            <span>{myRole === Role.IMPOSTER ? 'IMPOSTER' : 'ARTIST'}</span>
                        </div>

                        {/* Secret Word Display */}
                        <div className={`px-4 py-2 rounded-lg text-sm font-bold border-2 ${myRole === Role.IMPOSTER
                            ? 'bg-red-50 border-red-200 text-red-800'
                            : 'bg-green-50 border-green-200 text-green-900'
                            }`}>
                            {myRole === Role.IMPOSTER
                                ? '🤫 Find the word!'
                                : `🔑 Word: ${secretWord || 'Loading...'}`}
                        </div>
                    </div>

                    {/* Zoom */}
                    <div className="hidden md:flex items-center gap-2">
                        <button onClick={() => setZoom(z => Math.max(z - 0.1, 0.5))} className="p-1.5 hover:bg-gray-100 rounded transition border border-gray-300">
                            <ZoomOut size={16} />
                        </button>
                        <span className="text-xs text-gray-700 w-12 text-center font-medium">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.min(z + 0.1, 3))} className="p-1.5 hover:bg-gray-100 rounded transition border border-gray-300">
                            <ZoomIn size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* Host Controls */}
                {isHost && room.phase === GamePhase.DRAWING && (
                    <button
                        onClick={handleForceVote}
                        className="flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-700 border border-red-200 rounded-lg hover:bg-red-200 transition text-sm font-bold active:scale-95"
                        title="End drawing phase and start voting immediately"
                    >
                        <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse"></span>
                        Stop & Vote
                    </button>
                )}

                <div className="flex items-center gap-4">
                    <div className="text-sm text-gray-900 font-medium">
                        Round {room.round}/{room.maxRounds}
                    </div>
                    <div className="hidden sm:block px-3 py-1 bg-gray-900 text-white rounded-lg text-sm font-medium">
                        {room.phase.replace('_', ' ')}
                    </div>
                    <div className="text-xs text-gray-600 font-mono">
                        {room.roomCode}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden relative">

                {/* Players Sidebar - Hidden in landscape on mobile, visible on desktop */}
                <div className="w-full lg:w-56 bg-white border-b-2 lg:border-b-0 lg:border-r-2 border-black flex-shrink-0 landscape:hidden lg:landscape:block">
                    <div className="p-3 lg:h-full lg:overflow-y-auto">
                        <h3 className="font-semibold mb-3 text-gray-900 text-sm">Players</h3>
                        <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0">
                            {room.players.map((p, idx) => (
                                <div
                                    key={p.id}
                                    className={`flex items-center p-2.5 rounded-lg min-w-[130px] lg:min-w-0 transition-all border-2 ${idx === room.currentTurnIndex
                                        ? 'bg-black text-white border-black'
                                        : 'bg-white border-gray-300 hover:border-gray-900'
                                        }`}
                                >
                                    <div className="w-3 h-3 rounded-full flex-shrink-0 mr-2 border border-black/10 shadow-sm" style={{ backgroundColor: p.color }}></div>
                                    <span className={`font-medium truncate flex-1 text-sm ${idx === room.currentTurnIndex ? 'text-white' : 'text-gray-900'}`}>{p.name}</span>
                                    {p.isLocked && <CheckCircle size={14} className="flex-shrink-0" />}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Landscape Player List Toggle - Mobile Only */}
                <div className="hidden landscape:flex lg:landscape:hidden absolute top-4 left-4 z-50 bg-black/50 backdrop-blur-sm p-1 rounded-lg gap-2 items-center">
                    <div className="px-3 py-1 bg-black text-white rounded text-xs font-bold">
                        {myRole}
                    </div>
                    <div className="px-3 py-1 bg-white text-black rounded text-xs font-bold">
                        R{room.round}
                    </div>
                    {/* Mobile Force Vote */}
                    {isHost && room.phase === GamePhase.DRAWING && (
                        <button
                            onClick={(e) => { e.stopPropagation(); handleForceVote(); }}
                            onTouchEnd={(e) => { e.stopPropagation(); e.preventDefault(); handleForceVote(); }}
                            className="flex items-center gap-1 px-3 py-2 bg-red-600 text-white rounded shadow-lg text-xs font-bold ml-1 active:bg-red-700"
                        >
                            <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                            STOP
                        </button>
                    )}
                </div>

                {/* Canvas Area */}
                <div className="flex-1 flex flex-col overflow-hidden">
                    {/* Canvas Container */}
                    <div className="flex-1 bg-white relative p-4 lg:p-8 landscape:p-0 lg:landscape:p-8 flex flex-col overflow-auto">
                        {/* CANVAS */}
                        {room.phase === GamePhase.DRAWING && (
                            <div className="flex-1 flex items-center justify-center">
                                <Canvas
                                    roomCode={room.roomCode}
                                    onConfirm={submitDrawing}
                                    disabled={!isMyTurn || (myPlayer?.isLocked || false)}
                                    strokeColor={myPlayer?.color || '#000'}
                                    previousLayers={(room.drawings || []).map(d => ({
                                        playerId: d.playerId,
                                        imageUrl: d.data,
                                        round: d.round
                                    }))}
                                    zoom={zoom}
                                />
                            </div>
                        )}
                    </div>

                    {/* Floating Chat Button - Top Right for ALL devices */}
                    <button
                        onClick={() => setIsMobileChatOpen(!isMobileChatOpen)}
                        className="fixed top-20 right-4 landscape:top-4 landscape:right-4 lg:landscape:top-20 lg:landscape:right-4 z-40 bg-black text-white p-4 rounded-full shadow-lg hover:bg-gray-900 transition active:scale-95 min-w-[56px] min-h-[56px] flex items-center justify-center"
                    >
                        <MessageCircle size={24} />
                        {chatMessages.length > 0 && (
                            <span className="absolute -top-1 -right-1 bg-gray-900 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center border-2 border-white">
                                {chatMessages.length}
                            </span>
                        )}
                    </button>

                    {/* Chat Overlay - Smaller Floating Panel */}
                    {isMobileChatOpen && (
                        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setIsMobileChatOpen(false)}>
                            <div
                                className="bg-white rounded-2xl shadow-2xl w-full max-w-sm max-h-[70vh] flex flex-col border-4 border-black"
                                onClick={(e) => e.stopPropagation()}
                            >
                                {/* Header */}
                                <div className="p-4 border-b-2 border-black flex justify-between items-center bg-gray-100 rounded-t-2xl">
                                    <h3 className="font-bold text-gray-900 flex items-center gap-2">
                                        <MessageCircle size={18} />
                                        Chat
                                    </h3>
                                    <button onClick={() => setIsMobileChatOpen(false)} className="text-gray-900 hover:bg-gray-200 p-2 rounded">
                                        ✕
                                    </button>
                                </div>

                                {/* Messages */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                                    {chatMessages.map((msg, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <span className="font-bold text-sm text-gray-900">{msg.senderName}:</span>
                                            <span className="text-gray-700 text-sm">{msg.text}</span>
                                        </div>
                                    ))}
                                    <div ref={chatEndRef} />
                                </div>

                                {/* Input */}
                                <div className="p-4 border-t-2 border-black flex gap-2 bg-gray-100 rounded-b-2xl">
                                    <input
                                        type="text"
                                        value={chatInput}
                                        onChange={(e) => setChatInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && submitMessage()}
                                        placeholder="Type message..."
                                        className="flex-1 px-3 py-3 border-2 border-gray-900 rounded-lg text-sm focus:outline-none focus:border-black focus:ring-2 focus:ring-gray-200"
                                    />
                                    <button
                                        onClick={submitMessage}
                                        className="bg-black text-white px-4 py-3 rounded-lg hover:bg-gray-900 min-w-[48px] flex items-center justify-center"
                                    >
                                        <Send size={18} />
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>     {/* VOTING OVERLAY */}
                {room.phase === GamePhase.VOTING && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
                        <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-2xl w-full max-w-3xl max-h-[85vh] sm:max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 sm:p-6 rounded-t-2xl sm:rounded-t-lg">
                                <h2 className="text-xl sm:text-2xl font-bold text-center text-red-600">⚠️ WHO IS THE IMPOSTER?</h2>
                                <p className="text-center text-gray-600 text-sm sm:text-base mt-2">Vote to eject a player</p>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 sm:gap-4 p-4 sm:p-6">
                                {room.players.map((player) => {
                                    const hasVoted = !!room.votes[myPlayerId || ''];
                                    const isMe = player.id === myPlayerId;
                                    const votedForThis = room.votes[myPlayerId || ''] === player.id;
                                    const isSelected = selectedVoteId === player.id;

                                    // Calculate votes for this player
                                    const voteCount = Object.values(room.votes).filter(id => id === player.id).length;

                                    return (
                                        <button
                                            key={player.id}
                                            onClick={() => !hasVoted && !isMe && setSelectedVoteId(player.id)}
                                            disabled={hasVoted || isMe}
                                            className={`relative p-3 sm:p-4 rounded-lg border-2 transition active:scale-95 ${votedForThis ? 'bg-red-100 border-red-500 shadow-lg' :
                                                isSelected ? 'bg-black/5 border-black shadow-md ring-2 ring-black/10' :
                                                    !isMe && !hasVoted ? 'bg-white border-gray-300 hover:border-red-400 hover:bg-red-50 active:bg-red-100' :
                                                        'bg-gray-100 border-gray-300 opacity-60 cursor-not-allowed'
                                                }`}
                                        >
                                            <div className="text-3xl sm:text-4xl mb-1 sm:mb-2">{player.avatar}</div>
                                            <div className="font-bold text-xs sm:text-sm truncate w-full text-center" style={{ color: player.color }}>
                                                {player.name}
                                            </div>
                                            {isMe && <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5">(You)</div>}

                                            {/* Vote Indicators */}
                                            {(votedForThis || isSelected) && (
                                                <div className={`absolute top-1 right-1 text-white rounded-full p-1 sm:p-1.5 shadow-md ${votedForThis ? 'bg-red-500' : 'bg-black'}`}>
                                                    <CheckCircle size={14} className="sm:w-4 sm:h-4" />
                                                </div>
                                            )}

                                            {/* Vote Count Badge */}
                                            {voteCount > 0 && (
                                                <div className="absolute top-1 left-1 bg-red-600 text-white text-[10px] sm:text-xs font-bold px-1.5 py-0.5 rounded-full shadow-sm border border-white">
                                                    {voteCount} vote{voteCount !== 1 ? 's' : ''}
                                                </div>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>

                            <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 sm:p-6 flex flex-col gap-2 items-center">
                                {!room.votes[myPlayerId || ''] ? (
                                    <button
                                        onClick={() => selectedVoteId && submitVote(selectedVoteId)}
                                        disabled={!selectedVoteId}
                                        className="w-full max-w-sm bg-black text-white py-3 rounded-lg font-bold text-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-900 transition active:scale-95 shadow-lg flex items-center justify-center gap-2"
                                    >
                                        <span>LOCK VOTE</span>
                                        <span>🔒</span>
                                    </button>
                                ) : (
                                    <div className="flex flex-col items-center gap-2 w-full">
                                        <div className="flex items-center gap-2 text-black font-bold bg-yellow-300 border-2 border-black px-6 py-3 rounded-full shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] animate-bounce">
                                            <span>⏳</span>
                                            <span>Waiting for others...</span>
                                        </div>
                                        <div className="text-xs text-gray-600 font-bold text-center bg-gray-100 px-3 py-1 rounded-lg">
                                            Pending: <span className="text-red-600">{room.players.filter(p => !room.votes[p.id]).map(p => p.name).join(', ') || 'Nobody!'}</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* GAME OVER OVERLAY */}
                {room.phase === GamePhase.GAME_OVER && (
                    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
                        <div className="bg-white rounded-t-2xl sm:rounded-lg shadow-2xl p-6 sm:p-8 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                            <h1 className="text-2xl sm:text-4xl font-bold text-center mb-3 sm:mb-4">
                                {room.winner === 'IMPOSTER' ? '😈 IMPOSTER WINS!' : '🎨 ARTISTS WIN!'}
                            </h1>
                            <p className="text-center text-sm sm:text-lg mb-4 sm:mb-6 px-2">{room.winReason}</p>

                            <div className="bg-gray-100 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6">
                                <h3 className="font-bold mb-2 text-sm sm:text-base">Role Reveal:</h3>
                                {room.players.map((p) => (
                                    <div key={p.id} className="flex justify-between items-center py-2 text-xs sm:text-sm border-b border-gray-200 last:border-0">
                                        <span className="font-bold flex items-center gap-2" style={{ color: p.color }}>
                                            {p.name}
                                            {room.votes && Object.values(room.votes).filter(id => id === p.id).length > 0 && (
                                                <span className="bg-gray-200 text-gray-700 px-1.5 py-0.5 rounded text-[10px]">
                                                    {Object.values(room.votes).filter(id => id === p.id).length} votes
                                                </span>
                                            )}
                                        </span>
                                        <span className={p.role === Role.IMPOSTER ? 'text-red-600 font-bold' : 'text-green-600'}>
                                            {p.role}
                                        </span>
                                    </div>
                                ))}
                                <div className="mt-3 text-center font-bold text-base sm:text-lg border-t pt-2">
                                    Word: <span className="text-blue-600">{room.word}</span>
                                </div>
                            </div>

                            {isHost && (
                                <button
                                    onClick={resetGame}
                                    className="w-full bg-blue-600 text-white py-3 sm:py-4 rounded-lg font-bold text-base sm:text-lg hover:bg-blue-700 transition active:scale-95"
                                >
                                    Play Again
                                </button>
                            )}

                            {!isHost && (
                                <p className="text-center text-gray-600 text-sm sm:text-base py-2">Waiting for host to start new game...</p>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Footer - Hidden in mobile landscape, visible on desktop */}
            <div className="bg-white border-t-2 border-black px-4 py-2 flex items-center text-xs text-gray-900 gap-4 flex-shrink-0 landscape:hidden lg:landscape:flex">
                <div className="flex items-center gap-2">
                    <Users size={12} />
                    <span>{room.players.length} players</span>
                </div>
                <div className="w-px h-4 bg-gray-900"></div>
                <div>{connected ? '● Connected' : '○ Disconnected'}</div>
            </div>
        </div >
    );
};

export default App;
