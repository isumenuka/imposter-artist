<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🎨 Imposter Artist - Multiplayer Drawing Game

A real-time multiplayer drawing game where one player is secretly the "Imposter" who doesn't know the word everyone else is drawing!

## Game Flow

1. **Lobby Phase** - Create/join a room with a unique code. Players get assigned unique colors.
2. **Word Selection** - System randomly picks a secret word. All Artists receive it, but the Imposter only sees "You are the Imposter".
3. **Drawing Rounds (3 Total)** - Turn-based drawing. Each player draws 1-2 strokes per turn.
4. **Live Guessing** - Players can guess the word anytime during drawing. Correct guesses lock you in!
5. **Voting Phase** - Among Us-style voting to find the Imposter.
6. **Results** - Reveal the Imposter, show the word, and declare winners!

### Win Conditions
- **Artists Win**: Imposter is voted out
- **Imposter Wins**: Guesses the word correctly OR survives the vote

## Run Locally

**Prerequisites:** Node.js (v16+)

### Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set API key** (optional - AI features removed):
   Skip this step, Gemini is no longer used.

3. **Run the app:**
   ```bash
   npm run dev
   ```
   
   This command starts both:
   - Backend server on `http://localhost:3001`
   - Frontend dev server on `http://localhost:5173`

4. **Open the game:**
   Navigate to `http://localhost:5173` in multiple browser windows/tabs to test multiplayer!

### Manual Setup (if concurrent doesn't work)

**Terminal 1 - Backend:**
```bash
cd server
npm install
npm start
```

**Terminal 2 - Frontend:**
```bash
npm run dev:client
```

## Multiplayer Testing

1. Open `http://localhost:5173` in multiple browser windows/tabs (or different devices on same network)
2. Create a room in one window
3. Copy the room code
4. Join with that code from other windows
5. Host starts the game when ready!

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Lucide Icons, Socket.IO Client
- **Backend**: Node.js, Express, Socket.IO
- **Styling**: Tailwind-like utility classes (Paint.exe theme)

---

## Deployment

### Quick Deploy

The app is designed to deploy to:
- **Backend**: Render.com (free tier available)
- **Frontend**: Vercel (free tier)

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for complete step-by-step instructions.

### Architecture
```
GitHub Repo
    ├── Frontend (/) → Deploy to Vercel
    └── Backend (/server) → Deploy to Render.com
```

---

View the original app in AI Studio: https://ai.studio/apps/drive/1Xl1RI4QUdoYFPJPuM5cxY1B6VwhkjIcY

