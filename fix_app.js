const fs = require('fs');
const path = 'c:/Users/Isum Enuka/Downloads/imposter-artist/App.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');

// We want to replace lines 324 to 374 with the correct JSX.
// Line 324 is index 323.
// Line 374 is index 373.
const startIdx = 323;
const endIdx = 373;

const newContent = `            <div className="min-h-screen w-full flex items-center justify-center p-4 relative overflow-hidden">
                <Squares direction="diagonal" speed={0.4} borderColor="rgba(139, 92, 246, 0.3)" squareSize={55} hoverFillColor="rgba(168, 85, 247, 0.4)" />
                
                <div className="bg-white rounded-2xl shadow-2xl p-6 sm:p-8 w-full max-w-md relative z-10">
                    <h2 className="text-2xl sm:text-3xl font-bold mb-4 text-center text-gray-800">Submit Your Word</h2>
                    
                    <p className="text-center text-gray-600 mb-6">Everyone submits a word. One will be chosen as the secret word!</p>
                    
                    <div className="mb-6">
                        <input
                            type="text"
                            value={wordInput}
                            onChange={(e) => setWordInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && submitWord()}
                            placeholder="Enter a word..."
                            disabled={room.players.find(p => p.id === myPlayerId)?.hasSubmittedWord}
                            className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:outline-none focus:border-purple-500 text-lg text-center disabled:bg-gray-100"
                        />
                    </div>

                    {!room.players.find(p => p.id === myPlayerId)?.hasSubmittedWord ? (
                        <button
                            onClick={submitWord}
                            disabled={!wordInput.trim()}
                            className="w-full bg-purple-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition active:scale-95"
                        >
                            Submit Word
                        </button>
                    ) : (
                        <div className="text-center text-green-600 font-semibold mb-4">
                            ✅ Word submitted! Waiting for others...
                        </div>
                    )}

                    <div className="mt-6 p-4 bg-gray-100 rounded-lg">
                        <div className="text-center text-gray-700 font-semibold mb-2">
                            Words Submitted: {room.wordSubmissions?.length || 0}/{room.players.length}
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            {room.players.map((player) => (
                                <div key={player.id} className={\`text-sm p-2 rounded \${player.hasSubmittedWord ? 'bg-green-200 text-green-800' : 'bg-gray-200 text-gray-600'}\`}>
                                    {player.name} {player.hasSubmittedWord ? '✓' : '⏳'}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>`;

lines.splice(startIdx, endIdx - startIdx + 1, newContent);

fs.writeFileSync(path, lines.join('\n'));
console.log('Fixed App.tsx successfully');
