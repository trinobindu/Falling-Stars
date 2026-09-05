# ⭐ Catch the Stars - Full-Stack Browser Arcade Game

A fast-paced, cosmic arcade game where players catch falling stars in an **Endless Cosmic Survival** mode with real-time user accounts, secure authentication, customizable In-Game Names (IGNs), and a global real-player leaderboard.

🌐 **Live Vercel Demo**: [https://falling-stars-mu.vercel.app/](https://falling-stars-mu.vercel.app/)  
📦 **GitHub Repository**: [https://github.com/trinobindu/Falling-Stars](https://github.com/trinobindu/Falling-Stars)

---

## 🎮 Game Concept & Mechanics

- **Endless Survival Mode**: No time limit! Catch as many falling stars as you can.
- **Heart & Miss System**: You have **5 misses**. If 5 stars slip past the bottom boundary, the game ends.
- **Live Stopwatch**: Real-time timer tracking your survival endurance in minutes and seconds.
- **Dynamic Difficulty**: As your score increases, star fall speed accelerates and spawn intervals shorten.
- **Star Types & Points**:
  - ⭐ **Normal Star** (+1 pt) - Standard speed, warm golden glow (70% spawn chance)
  - 🌟 **Golden Star** (+3 pts) - Faster speed, brilliant amber sparkle (20% spawn chance)
  - 💫 **Supernova Star** (+5 pts) - Ultra-fast, spinning iridescent cosmic gradient (10% spawn chance)

---

## 🔐 Real-Player Authentication & Features

1. **Email & Password Authentication**:
   - Clean signup with Gmail / email and secure password.
   - Credentials securely stored and validated with SHA-256 password hashing.
   - Returning players can sign in anytime and resume their high score tracking.
2. **In-Game Name (IGN) System**:
   - Every registered player sets an in-game name upon registration.
   - **Change Name Option**: Players can update their in-game name anytime from their profile with live uniqueness checking.
3. **Real-Player Global Leaderboard**:
   - Shows top players ranked by verified high score and time survived.
   - **Zero Bot Players**: Only real registered players appear on the leaderboard.
   - Displays real In-Game Names (IGNs), ranks, scores, and survival times.
4. **Clean Gated Interface**:
   - Game HUD, scores, best score, and play controls are cleanly hidden until authenticated, providing an uncluttered login experience.
5. **Real-Time Web Audio Synthesizer**:
   - Audio effects (star chimes, supernova chords, miss thud, game over fanfare) synthesized on-the-fly with the browser's Web Audio API—no external audio files or latency!

---

## 🕹️ Controls

- **Mouse / Touch**: Click or tap falling stars before they reach the bottom.
- **Keyboard Shortcuts**:
  - <kbd>Space</kbd> : Start game / Play again / Resume
  - <kbd>P</kbd> or <kbd>Escape</kbd> : Pause / Resume
  - <kbd>M</kbd> : Toggle sound (Mute / Unmute)

---

## 📁 Project Structure

```
Falling Stars/
├── api/
│   └── index.js            # Vercel Serverless entrypoint (Express API handlers)
├── public/
│   ├── index.html          # Clean HTML5 layout, HUD, overlays & modal dialogs
│   ├── style.css           # Responsive space theme, glassmorphic UI, animations
│   ├── script.js           # Vanilla JavaScript game engine & API client
│   └── assets/
│       └── star.svg        # Scalable vector star icon & favicon
├── data/
│   └── users.json          # Persistent player database (email, IGN, hash, scores)
├── server.js               # Local development Node.js / Express server
├── vercel.json             # Vercel serverless deployment routing configuration
├── package.json            # Dependencies and npm start scripts
└── README.md               # Documentation and project overview
```

---

## 🚀 Running Locally

### Prerequisites
- [Node.js](https://nodejs.org/) (v16 or newer) installed.

### Steps
1. **Clone the repository**:
   ```bash
   git clone https://github.com/trinobindu/Falling-Stars.git
   cd Falling-Stars
   ```
2. **Install dependencies**:
   ```bash
   npm install
   ```
3. **Start the local server**:
   ```bash
   npm start
   ```
4. **Open in browser**:
   Visit [http://localhost:8080](http://localhost:8080) to play and sign in.

---

## ☁️ Deployment

- **Production URL**: [https://falling-stars-mu.vercel.app/](https://falling-stars-mu.vercel.app/)
- Configured with `vercel.json` to route `/api/*` calls to Vercel Serverless Functions while serving frontend assets statically from `public/`.
