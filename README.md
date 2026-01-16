<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# 🎨 Imposter Artist - Multiplayer Drawing Game

A real-time multiplayer drawing game where one player is secretly the "Imposter" who doesn't know the word everyone else is drawing!

## ✨ New Features
*   **Persistent Role Display**: Role and secret word are always visible in the header (no more hovering!).
*   **Mobile Landscape Support**: Optimized UI for playing on phones and tablets.
*   **Force Vote**: Host can end the drawing phase early if everyone is ready.
*   **Real-time Voting**: See live vote counts and "waiting for players" status.
*   **Vote Results**: Clear breakdown of who voted for whom at game end.

## 🎮 Game Flow
1. **Lobby Phase** - Create/join a room. Players get unique avatars and colors.
2. **Word Selection** - System picks a word. Artists see it; Imposter sees "Find the word!".
3. **Drawing Phase** - Players take turns drawing strokes.
    -   *Host can use "Stop & Vote" button to end early.*
4. **Voting Phase** - Discuss and vote to eject the Imposter.
5. **Results** - Reveal roles, winner, and full vote storage.

### Win Conditions
- **Artists Win**: Imposter is voted out.
- **Imposter Wins**: Survives the vote OR guesses the secret word correctly.

## 🚀 Deployment (Go Live!)

We have a complete step-by-step guide to put your game on the internet for free.
👉 **[Read the DEPLOYMENT GUIDE](./DEPLOYMENT_GUIDE.md)** 👈

**Architecture:**
- **Frontend**: Hosted on Vercel.
- **Backend**: Hosted on Render.com.

## 🛠️ Run Locally

**Prerequisites:** Node.js (v16+)

1. **Install Dependencies**
   ```bash
   npm install
   cd server && npm install && cd ..
   ```

2. **Start Dev Server**
   ```bash
   npm run dev
   ```
   *This starts both the frontend (localhost:5173) and backend (localhost:3000).*

3. **Play!**
   Open `http://localhost:5173` in multiple tabs.

## 💻 Tech Stack
- **Frontend**: React, TypeScript, Vite, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO
- **Real-time**: Socket.IO (Events: `draw_stroke`, `submit_vote`, `room_update`)
- **Icons**: Lucide React

---
*Created with ❤️ for Isum Enuka*
