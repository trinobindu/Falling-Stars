# ⭐ Catch the Stars - Browser Arcade Game

A complete, polished, modern responsive web game where players catch falling stars in an **Endless Cosmic Survival** mode with **Gmail / Google Account Login** support.

![Catch the Stars](assets/star.svg)

---

## 🎮 Game Concept & Rules

- **Endless Survival Mode**: **No time limit!** Play and rack up points for as long as you can stay alive.
- **Goal**: Click or tap falling stars before they reach the bottom of the game board.
- **Misses Allowed**: You have **5 misses**. If 5 stars escape past the bottom, the game ends.
- **Time Survived**: A live stopwatch tracks how many minutes and seconds you survive.
- **Dynamic Difficulty**: As your score climbs, stars fall progressively faster and spawn more frequently!

---

## 👤 Gmail / Google Sign-In

- **Personalized High Scores**: Sign in with your Gmail to record and track your individual personal best score.
- **Instant Profile**: Shows your Google initial avatar, display name, and email in the top header.
- **One-Click Sign-In**: Enter your Gmail address or click one of the quick test accounts for instant instant local sign-in.
- **Official Google OAuth Ready**: Integrated with the official Google Identity Services (GIS) SDK (`@accounts.google.com/gsi/client`). Add your Google Cloud Client ID to `CONFIG.GOOGLE_CLIENT_ID` anytime for full OAuth verification.
- **Sign Out Anytime**: Easily log out to play in Guest mode or switch between accounts.

---

## 🌟 Star Types & Points

| Star Type | Icon | Points | Spawn Chance | Characteristics |
| :--- | :---: | :---: | :---: | :--- |
| **Normal Star** | ⭐ | **+1 pt** | 70% | Standard speed, warm golden glow |
| **Golden Star** | 🌟 | **+3 pts** | 20% | Faster speed, brilliant amber sparkle |
| **Supernova Star** | 💫 | **+5 pts** | 10% | Very fast, spinning iridescent cosmic gradient |

---

## 🕹️ Controls

- **Mouse / Touch**: Click or tap stars to catch them.
- **Keyboard Shortcuts**:
  - <kbd>Space</kbd> : Start game / Play again / Resume when paused
  - <kbd>P</kbd> or <kbd>Escape</kbd> : Pause / Resume
  - <kbd>M</kbd> : Toggle sound (Mute / Unmute)

---

## 📁 Project Structure

```
Falling Stars/
├── index.html          # Semantic HTML5 layout, HUD, overlays, and modal dialogs
├── style.css           # Space theme styling, glassmorphism, responsive queries & keyframe animations
├── script.js           # Clean, modular, well-commented vanilla JavaScript game engine
├── README.md           # Documentation, rules, and run instructions
└── assets/
    └── star.svg        # Reusable vector star icon & favicon
```

---

## 🚀 How to Run Locally

Because this project is built entirely with standard vanilla web technologies (HTML5, CSS3, and JavaScript), **no build step, installation, or backend is required!**

### Option 1: Direct Browser Open (Double Click)
1. Navigate to the `Falling Stars` folder on your computer.
2. Double-click **`index.html`** to open it directly in Chrome, Edge, Firefox, or Safari.

### Option 2: Live Server (VS Code / Local HTTP)
If you use VS Code:
1. Open the folder in VS Code.
2. Right-click `index.html` and choose **"Open with Live Server"**.

Or using Python in terminal:
```bash
python -m http.server 8000
```
Then visit `http://localhost:8000` in your web browser.

---

## 🔊 Sound Synthesis (Web Audio API)

All sound effects (normal star chime, golden chime, supernova chord, miss thud, game over fanfare) are **synthesized in real-time** via the browser's built-in **Web Audio API**.
- Zero external MP3/WAV files required.
- Zero network latency.
- Completely offline capable.
- Audio preference (Sound On / Off) is saved automatically in `localStorage`.
