/**
 * ============================================================================
 * CATCH THE STARS - GAME ENGINE
 * ============================================================================
 * A complete, modular, responsive browser arcade game.
 * Written with beginner-friendly, clean vanilla JavaScript.
 *
 * TABLE OF CONTENTS:
 * 1. Configuration & Constants
 * 2. Game State
 * 3. DOM Elements Cache
 * 4. Web Audio API Sound Engine (Zero external files)
 * 5. Star Spawning & Movement System
 * 6. Particle & Visual Effects
 * 7. Score & Miss Management
 * 8. Timer & Difficulty Scaling
 * 9. High Score (localStorage)
 * 10. Screen & UI Flow (Start, Pause, Resume, Game Over)
 * 11. Event Listeners & Keyboard Controls
 * 12. Ambient Background Starfield Canvas
 * 13. Initialization
 * ============================================================================
 */

(function () {
  'use strict';

  /* ==========================================================================
     1. CONFIGURATION & CONSTANTS
     ========================================================================== */
  const CONFIG = {
    // Game Rules: Endless survival until max misses
    MAX_MISSES: 5,

    // Optional Google OAuth Client ID (if deploying with Google Cloud Console)
    GOOGLE_CLIENT_ID: '',

    // Star Type Definitions
    STAR_TYPES: {
      NORMAL: {
        type: 'normal',
        name: 'Normal Star',
        points: 1,
        weight: 0.70, // 70% spawn chance
        size: 50,     // pixels
        speedMultiplier: 1.0,
        cssClass: 'star-normal',
        symbol: '⭐'
      },
      GOLDEN: {
        type: 'golden',
        name: 'Golden Star',
        points: 3,
        weight: 0.20, // 20% spawn chance
        size: 46,     // slightly smaller
        speedMultiplier: 1.25,
        cssClass: 'star-golden',
        symbol: '🌟'
      },
      SUPERNOVA: {
        type: 'supernova',
        name: 'Supernova Star',
        points: 5,
        weight: 0.10, // 10% spawn chance
        size: 42,     // small & fast
        speedMultiplier: 1.5,
        cssClass: 'star-supernova',
        symbol: '💫'
      }
    },

    // Difficulty Scaling Formula
    BASE_SPEED: 140,         // pixels per second at score 0
    SPEED_PER_POINT: 3.5,    // speed increment per point
    MAX_SPEED: 460,          // safety ceiling so game remains playable

    BASE_SPAWN_MS: 1050,     // spawn interval at start
    MIN_SPAWN_MS: 420,       // fastest spawn interval
    SPAWN_REDUCTION_PER_PT: 16 // milliseconds reduced per point
  };

  /* ==========================================================================
     2. GAME STATE
     ========================================================================== */
  const state = {
    score: 0,
    misses: 0,
    elapsedSeconds: 0, // Stopwatch for endless survival
    starsCaught: 0,
    highScore: 0,

    // User authentication
    currentUser: null, // { name, email, avatar }

    // Flow flags
    isRunning: false,
    isPaused: false,
    soundEnabled: true,

    // Animation & Loop handles
    animationFrameId: null,
    timerIntervalId: null,
    spawnTimeoutId: null,
    lastFrameTime: 0,

    // Active stars pool
    stars: []
  };

  /* ==========================================================================
     3. DOM ELEMENTS CACHE
     ========================================================================== */
  const DOM = {
    // Canvas
    bgCanvas: document.getElementById('bg-canvas'),

    // Header Auth
    btnGoogleLogin: document.getElementById('btn-google-login'),
    userProfileBadge: document.getElementById('user-profile-badge'),
    userAvatar: document.getElementById('user-avatar'),
    userName: document.getElementById('user-name'),
    userEmail: document.getElementById('user-email'),
    btnSignOut: document.getElementById('btn-signout'),

    // HUD
    gameHud: document.getElementById('game-hud'),
    scoreDisplay: document.getElementById('score-display'),
    timeDisplay: document.getElementById('time-display'),
    timerProgress: document.getElementById('timer-progress'),
    missFraction: document.getElementById('miss-fraction'),
    missDots: document.querySelectorAll('.miss-dot'),
    bestDisplay: document.getElementById('best-display'),

    // Board & Layers
    gameArea: document.getElementById('game-area'),
    starLayer: document.getElementById('star-layer'),
    fxLayer: document.getElementById('fx-layer'),

    // In-game buttons
    btnPause: document.getElementById('btn-pause'),
    pauseIcon: document.getElementById('pause-icon'),
    pauseLabel: document.getElementById('pause-label'),
    btnSound: document.getElementById('btn-sound'),
    soundIcon: document.getElementById('sound-icon'),
    btnInfo: document.getElementById('btn-info'),

    // Overlays
    overlayStart: document.getElementById('overlay-start'),
    overlayPause: document.getElementById('overlay-pause'),
    overlayGameover: document.getElementById('overlay-gameover'),
    btnStart: document.getElementById('btn-start'),
    btnResume: document.getElementById('btn-resume'),
    btnPauseRestart: document.getElementById('btn-pause-restart'),
    btnPlayAgain: document.getElementById('btn-play-again'),
    btnBackHome: document.getElementById('btn-back-home'),

    // Game Over stats
    finalScore: document.getElementById('final-score'),
    finalBest: document.getElementById('final-best'),
    finalTime: document.getElementById('final-time'),
    finalCaught: document.getElementById('final-caught'),
    finalMisses: document.getElementById('final-misses'),
    gameoverReason: document.getElementById('gameover-reason'),
    newHighBanner: document.getElementById('new-high-banner'),
    gameoverBadge: document.getElementById('gameover-badge'),

    // Instructions Modal
    modalInstructions: document.getElementById('modal-instructions'),
    btnCloseModal: document.getElementById('btn-close-modal'),
    btnModalGotIt: document.getElementById('btn-modal-gotit'),

    // Google Sign-In Modal
    modalGoogle: document.getElementById('modal-google'),
    btnCloseGoogleModal: document.getElementById('btn-close-google-modal'),
    formGmailLogin: document.getElementById('form-gmail-login'),
    inputGmail: document.getElementById('input-gmail'),
    quickAccountBtns: document.querySelectorAll('.quick-account-btn'),

    // Leaderboard
    btnLeaderboardNav: document.getElementById('btn-leaderboard-nav'),
    modalLeaderboard: document.getElementById('modal-leaderboard'),
    btnCloseLeaderboard: document.getElementById('btn-close-leaderboard'),
    btnLeaderboardCloseBtn: document.getElementById('btn-leaderboard-close-btn'),
    leaderboardTbody: document.getElementById('leaderboard-tbody'),
    leaderboardPodium: document.getElementById('leaderboard-podium'),
    leaderboardEmpty: document.getElementById('leaderboard-empty'),
    leaderboardTableContainer: document.getElementById('leaderboard-table-container'),
    lbPlayerCount: document.getElementById('lb-player-count'),
    btnStartLeaderboard: document.getElementById('btn-start-leaderboard'),
    btnGameoverLeaderboard: document.getElementById('btn-gameover-leaderboard'),
    finalRank: document.getElementById('final-rank'),

    // Start Screen Auth Gate (Sign Up & Log In with Password)
    startGateLogin: document.getElementById('start-gate-login'),
    tabBtnSignup: document.getElementById('tab-btn-signup'),
    tabBtnLogin: document.getElementById('tab-btn-login'),
    authAlert: document.getElementById('auth-alert'),
    formSignup: document.getElementById('form-signup'),
    signupGmail: document.getElementById('signup-gmail'),
    signupIgn: document.getElementById('signup-ign'),
    signupPassword: document.getElementById('signup-password'),
    btnToggleSignupPwd: document.getElementById('btn-toggle-signup-pwd'),
    btnSignupSubmit: document.getElementById('btn-signup-submit'),
    formLogin: document.getElementById('form-login'),
    loginGmail: document.getElementById('login-gmail'),
    loginPassword: document.getElementById('login-password'),
    btnToggleLoginPwd: document.getElementById('btn-toggle-login-pwd'),
    btnLoginSubmit: document.getElementById('btn-login-submit'),

    // Player Ready Card
    startPlayerReady: document.getElementById('start-player-ready'),
    readyAvatar: document.getElementById('ready-avatar'),
    readyIgn: document.getElementById('ready-ign'),
    readyEmail: document.getElementById('ready-email'),
    readyBest: document.getElementById('ready-best'),
    readyRank: document.getElementById('ready-rank'),
    btnSwitchPlayer: document.getElementById('btn-switch-player'),
    startDesc: document.getElementById('start-desc'),

    // Change In-Game Name Modal & Controls
    btnHeaderEditIgn: document.getElementById('btn-header-edit-ign'),
    btnOpenChangeIgn: document.getElementById('btn-open-change-ign'),
    modalChangeIgn: document.getElementById('modal-change-ign'),
    btnCloseChangeIgn: document.getElementById('btn-close-change-ign'),
    btnCancelChangeIgn: document.getElementById('btn-cancel-change-ign'),
    formChangeIgn: document.getElementById('form-change-ign'),
    inputNewIgn: document.getElementById('input-new-ign'),
    changeIgnAlert: document.getElementById('change-ign-alert'),
    btnSubmitChangeIgn: document.getElementById('btn-submit-change-ign'),
    btnChangeIgnText: document.getElementById('btn-change-ign-text'),
    btnChangeIgnSpinner: document.getElementById('btn-change-ign-spinner'),
    btnGateLeaderboard: document.getElementById('btn-gate-leaderboard')
  };

  /* ==========================================================================
     4. WEB AUDIO API SOUND ENGINE
     Generates crisp, retro-modern synthesized sounds on the fly.
     No external .mp3 or .wav files required!
     ========================================================================== */
  class SoundEngine {
    constructor() {
      this.audioCtx = null;
    }

    // Initialize AudioContext on first user interaction (browser policy)
    init() {
      if (!this.audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (AudioContextClass) {
          this.audioCtx = new AudioContextClass();
        }
      } else if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume();
      }
    }

    // Play a sound if sound is enabled
    playTone(freqs, type = 'sine', duration = 0.15, gainVal = 0.15, isGlissando = false) {
      if (!state.soundEnabled) return;
      this.init();
      if (!this.audioCtx) return;

      try {
        const now = this.audioCtx.currentTime;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        osc.type = type;

        if (Array.isArray(freqs) && isGlissando) {
          // Slide from freqs[0] to freqs[1]
          osc.frequency.setValueAtTime(freqs[0], now);
          osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqs[1]), now + duration);
        } else if (Array.isArray(freqs)) {
          // Arpeggio notes
          const stepDuration = duration / freqs.length;
          freqs.forEach((freq, idx) => {
            osc.frequency.setValueAtTime(freq, now + idx * stepDuration);
          });
        } else {
          osc.frequency.setValueAtTime(freqs, now);
        }

        // Exponential volume decay envelope to avoid clicks
        gain.gain.setValueAtTime(gainVal, now);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(now);
        osc.stop(now + duration);
      } catch (err) {
        // Fail gracefully if audio device is unavailable
        console.warn('Audio playback error:', err);
      }
    }

    // Star caught chime: pitch depends on star type
    starCatch(starType) {
      if (starType === 'normal') {
        // Bright friendly double bell (E5 -> A5)
        this.playTone([659.25, 880], 'sine', 0.18, 0.18);
      } else if (starType === 'golden') {
        // Ascending sparkly major triad (G5 -> B5 -> D6)
        this.playTone([783.99, 987.77, 1174.66], 'triangle', 0.28, 0.22);
      } else if (starType === 'supernova') {
        // Cosmic power chord arpeggio (C6 -> E6 -> G6 -> C7)
        this.playTone([1046.5, 1318.5, 1567.98, 2093.0], 'triangle', 0.32, 0.2);
      }
    }

    // Star missed: low soft buzz / dull descending thud
    starMiss() {
      this.playTone([220, 90], 'sawtooth', 0.22, 0.12, true);
    }

    // Game Over fanfare
    gameOver(isNewHigh) {
      if (isNewHigh) {
        // Triumphant ascending fanfare
        this.playTone([523.25, 659.25, 783.99, 1046.5], 'triangle', 0.55, 0.25);
      } else {
        // Melancholy descending chime
        this.playTone([440, 392, 349, 293], 'sine', 0.5, 0.2);
      }
    }

    // Subtle UI click feedback
    uiClick() {
      this.playTone(800, 'sine', 0.04, 0.05);
    }
  }

  const soundEngine = new SoundEngine();

  /* ==========================================================================
     5. STAR SPAWNING & MOVEMENT SYSTEM
     ========================================================================== */

  // Pick a star type based on weighted probability
  function pickRandomStarType() {
    const rand = Math.random();
    if (rand < CONFIG.STAR_TYPES.NORMAL.weight) {
      return CONFIG.STAR_TYPES.NORMAL;
    } else if (rand < CONFIG.STAR_TYPES.NORMAL.weight + CONFIG.STAR_TYPES.GOLDEN.weight) {
      return CONFIG.STAR_TYPES.GOLDEN;
    } else {
      return CONFIG.STAR_TYPES.SUPERNOVA;
    }
  }

  // Calculate current falling speed based on player's score
  function getCurrentSpeed(speedMultiplier) {
    const scaledSpeed = CONFIG.BASE_SPEED + state.score * CONFIG.SPEED_PER_POINT;
    const finalSpeed = Math.min(scaledSpeed, CONFIG.MAX_SPEED) * speedMultiplier;
    return finalSpeed;
  }

  // Calculate current spawn interval in milliseconds
  function getCurrentSpawnInterval() {
    const reducedInterval = CONFIG.BASE_SPAWN_MS - state.score * CONFIG.SPAWN_REDUCTION_PER_PT;
    return Math.max(CONFIG.MIN_SPAWN_MS, reducedInterval);
  }

  // Spawn a new falling star into the game area
  function spawnStar() {
    if (!state.isRunning || state.isPaused) return;

    const gameAreaWidth = DOM.gameArea.clientWidth;
    if (gameAreaWidth <= 0) return;

    const starDef = pickRandomStarType();
    const starId = 'star_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // Ensure star stays within left/right padding boundaries
    const padding = 16;
    const maxLeft = Math.max(0, gameAreaWidth - starDef.size - padding);
    const xPos = padding + Math.random() * (maxLeft - padding);
    const yPos = -starDef.size; // Start just above the visible ceiling

    // Create DOM element for the star
    const starEl = document.createElement('div');
    starEl.id = starId;
    starEl.className = `game-star ${starDef.cssClass}`;
    starEl.style.width = `${starDef.size}px`;
    starEl.style.height = `${starDef.size}px`;
    starEl.style.transform = `translate3d(${xPos}px, ${yPos}px, 0)`;

    // Accessible labeling
    starEl.setAttribute('role', 'button');
    starEl.setAttribute('aria-label', `Catch ${starDef.name}`);
    starEl.setAttribute('tabindex', '0');

    // Inner SVG star icon for razor-sharp crisp rendering
    starEl.innerHTML = `
      <div class="star-svg-wrapper">
        <svg class="star-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M12 1.5l3.09 6.26L22 8.77l-5 4.87 1.18 6.88L12 17.27l-6.18 3.25L7 13.64 2 8.77l6.91-1.01L12 1.5z"/>
        </svg>
      </div>
    `;

    // Click & Touch Tap Handler
    const onCatchHandler = (e) => {
      e.stopPropagation();
      e.preventDefault();

      let clickX, clickY;
      if (e.clientX !== undefined && e.clientY !== undefined && e.clientX > 0) {
        const rect = DOM.gameArea.getBoundingClientRect();
        clickX = e.clientX - rect.left;
        clickY = e.clientY - rect.top;
      } else {
        const currentStar = state.stars.find((s) => s.id === starId);
        clickX = xPos + starDef.size / 2;
        clickY = (currentStar ? currentStar.y : yPos) + starDef.size / 2;
      }

      catchStar(starId, starEl, starDef, clickX, clickY);
    };

    starEl.addEventListener('pointerdown', onCatchHandler);
    starEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        onCatchHandler(e);
      }
    });

    DOM.starLayer.appendChild(starEl);

    // Save star object to active pool
    const star = {
      id: starId,
      element: starEl,
      def: starDef,
      x: xPos,
      y: yPos,
      speed: getCurrentSpeed(starDef.speedMultiplier),
      size: starDef.size,
      caught: false
    };

    state.stars.push(star);

    // Schedule the next star spawn
    scheduleNextSpawn();
  }

  // Schedule the next spawn using dynamic interval
  function scheduleNextSpawn() {
    clearTimeout(state.spawnTimeoutId);
    if (!state.isRunning || state.isPaused) return;

    const interval = getCurrentSpawnInterval();
    state.spawnTimeoutId = setTimeout(spawnStar, interval);
  }

  // Main animation frame loop for smooth 60fps+ star falling
  function gameLoop(timestamp) {
    if (!state.isRunning) return;

    if (state.isPaused) {
      state.lastFrameTime = timestamp;
      state.animationFrameId = requestAnimationFrame(gameLoop);
      return;
    }

    // Calculate delta time (seconds elapsed since last frame)
    if (!state.lastFrameTime) state.lastFrameTime = timestamp;
    const dt = Math.min((timestamp - state.lastFrameTime) / 1000, 0.1); // Clamp to avoid giant leaps
    state.lastFrameTime = timestamp;

    const gameAreaHeight = DOM.gameArea.clientHeight;
    const remainingStars = [];

    // Update positions of all falling stars
    for (let i = 0; i < state.stars.length; i++) {
      const star = state.stars[i];

      if (star.caught) continue; // Already popped

      // Move star downward
      star.y += star.speed * dt;
      star.element.style.transform = `translate3d(${star.x}px, ${star.y}px, 0)`;

      // Miss detection: check if star bottom exceeded game area bottom
      if (star.y >= gameAreaHeight - 10) {
        handleStarMiss(star);
      } else {
        remainingStars.push(star);
      }
    }

    state.stars = remainingStars;

    // Check end-of-game conditions
    if (state.misses >= CONFIG.MAX_MISSES) {
      endGame('misses');
      return;
    }

    state.animationFrameId = requestAnimationFrame(gameLoop);
  }

  /* ==========================================================================
     6. PARTICLE & VISUAL EFFECTS
     ========================================================================== */

  // Spawn floating score indicator (+1, +3, +5) at catch coordinates
  function showFloatingScore(points, x, y) {
    const floater = document.createElement('div');
    floater.className = `floating-score score-${points}`;
    floater.textContent = `+${points}`;
    floater.style.left = `${x}px`;
    floater.style.top = `${y}px`;

    DOM.fxLayer.appendChild(floater);

    // Auto remove after animation ends
    setTimeout(() => {
      floater.remove();
    }, 750);
  }

  // Spawn mini sparkle burst particles on star catch
  function createParticleBurst(x, y, color) {
    const particleCount = 8;
    for (let i = 0; i < particleCount; i++) {
      const particle = document.createElement('div');
      particle.className = 'sparkle-particle';

      const size = 5 + Math.random() * 5;
      particle.style.width = `${size}px`;
      particle.style.height = `${size}px`;
      particle.style.backgroundColor = color;
      particle.style.boxShadow = `0 0 8px ${color}`;

      // Calculate radial trajectory
      const angle = (i / particleCount) * (Math.PI * 2) + (Math.random() - 0.5);
      const distance = 25 + Math.random() * 35;
      const tx = Math.cos(angle) * distance;
      const ty = Math.sin(angle) * distance;

      particle.style.left = `${x}px`;
      particle.style.top = `${y}px`;
      particle.style.setProperty('--tx', `${tx}px`);
      particle.style.setProperty('--ty', `${ty}px`);

      DOM.fxLayer.appendChild(particle);

      setTimeout(() => {
        particle.remove();
      }, 450);
    }
  }

  // Trigger miss feedback: red border glow and subtle shake
  function triggerMissEffect() {
    DOM.gameArea.classList.remove('miss-flash');
    // Force DOM reflow to restart CSS animation
    void DOM.gameArea.offsetWidth;
    DOM.gameArea.classList.add('miss-flash');
  }

  /* ==========================================================================
     7. SCORE & MISS MANAGEMENT
     ========================================================================== */

  // Catch a star when clicked/tapped
  function catchStar(starId, starEl, starDef, clickX, clickY) {
    if (!state.isRunning || state.isPaused) return;

    // Find star in active pool
    const star = state.stars.find((s) => s.id === starId);
    if (!star || star.caught) return;

    star.caught = true;

    // Increment score & caught counter
    state.score += starDef.points;
    state.starsCaught += 1;

    // Update Score HUD with pulse animation
    DOM.scoreDisplay.textContent = state.score;
    DOM.scoreDisplay.classList.remove('score-pulse');
    void DOM.scoreDisplay.offsetWidth;
    DOM.scoreDisplay.classList.add('score-pulse');

    // Check if new high score during live gameplay
    if (state.score > state.highScore) {
      state.highScore = state.score;
      DOM.bestDisplay.textContent = state.highScore;
      saveHighScore(state.highScore);
    }

    // Play synthesized sound
    soundEngine.starCatch(starDef.type);

    // Visual FX: Pop animation on the star element
    starEl.classList.add('popping');

    // Floating points text (+1, +3, +5)
    showFloatingScore(starDef.points, clickX, clickY);

    // Particle sparkles
    const particleColor =
      starDef.type === 'supernova' ? '#ec4899' :
      starDef.type === 'golden' ? '#fbbf24' : '#facc15';
    createParticleBurst(clickX, clickY, particleColor);

    // Remove star DOM element after pop finishes
    setTimeout(() => {
      starEl.remove();
    }, 280);
  }

  // Miss a star when it reaches the bottom of the game area
  function handleStarMiss(star) {
    if (star.caught) return;
    star.caught = true;

    // Remove element
    star.element.remove();

    // Increment miss counter
    state.misses += 1;
    updateMissUI();

    // Visual & sound feedback
    triggerMissEffect();
    soundEngine.starMiss();
  }

  // Update miss counter and visual indicators
  function updateMissUI() {
    DOM.missFraction.textContent = `${state.misses} / ${CONFIG.MAX_MISSES}`;

    DOM.missDots.forEach((dot, index) => {
      if (index < state.misses) {
        dot.classList.add('lost');
      } else {
        dot.classList.remove('lost');
      }
    });
  }

  /* ==========================================================================
     8. TIMER SYSTEM (Endless Survival Stopwatch)
     ========================================================================== */

  // Format seconds into clean readable M:SS format (e.g. 0:00, 1:25, 4:09)
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Start the survival stopwatch (counts upwards without time limit)
  function startTimer() {
    clearInterval(state.timerIntervalId);
    state.elapsedSeconds = 0;
    updateTimerUI();

    state.timerIntervalId = setInterval(() => {
      if (state.isPaused || !state.isRunning) return;

      state.elapsedSeconds += 1;
      updateTimerUI();
    }, 1000);
  }

  // Update timer HUD display
  function updateTimerUI() {
    DOM.timeDisplay.textContent = formatTime(state.elapsedSeconds);
  }

  /* ==========================================================================
     9. SERVER API, PASSWORD AUTHENTICATION & REAL-PLAYER LEADERBOARD
     ========================================================================== */
  const USER_STORAGE_KEY = 'catchTheStars_userProfile';
  const SOUND_STORAGE_KEY = 'catchTheStars_soundEnabled';
  const LEADERBOARD_STORAGE_KEY = 'catchTheStars_cosmicLeaderboard';

  // API Base: Supports both http://localhost:8080 and direct file:/// launches
  const API_BASE = (window.location.protocol === 'http:' || window.location.protocol === 'https:') ? '' : 'http://localhost:8080';

  // Server API client helpers
  const API = {
    async signup(email, password, ign) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/signup`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, ign })
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        return { ok: false, data: { error: 'Unable to connect to server. Please ensure server is running.' } };
      }
    },

    async login(email, password) {
      try {
        const res = await fetch(`${API_BASE}/api/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        return { ok: false, data: { error: 'Unable to connect to server. Please ensure server is running.' } };
      }
    },

    async getLeaderboard() {
      try {
        const res = await fetch(`${API_BASE}/api/leaderboard`);
        if (res.ok) {
          const data = await res.json();
          return data.leaderboard || [];
        }
      } catch (e) {}
      // Fallback to local storage if server unreachable
      try {
        const saved = localStorage.getItem(LEADERBOARD_STORAGE_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {}
      return [];
    },

    async recordScore(email, score, timeSurvived) {
      try {
        const res = await fetch(`${API_BASE}/api/score`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, score, timeSurvived })
        });
        if (res.ok) {
          return await res.json();
        }
      } catch (e) {}
      return null;
    },

    async changeIgn(email, newIgn) {
      try {
        const res = await fetch(`${API_BASE}/api/player/change-ign`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, newIgn })
        });
        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
        return { ok: false, data: { error: 'Unable to connect to server. Please ensure server is running.' } };
      }
    }
  };

  // Return unique localStorage key based on current Gmail user
  function getHighScoreKey() {
    if (state.currentUser && state.currentUser.email) {
      const sanitized = state.currentUser.email.toLowerCase().replace(/[^a-z0-9]/g, '_');
      return `catchTheStars_highScore_${sanitized}`;
    }
    return 'catchTheStars_highScore_guest';
  }

  // Load high score for the active user profile
  function loadHighScore() {
    if (state.currentUser && typeof state.currentUser.highestScore === 'number' && state.currentUser.highestScore > 0) {
      state.highScore = state.currentUser.highestScore;
    } else {
      try {
        const key = getHighScoreKey();
        const saved = localStorage.getItem(key);
        const val = parseInt(saved, 10);
        state.highScore = !isNaN(val) && val >= 0 ? val : 0;
      } catch (e) {
        state.highScore = 0;
      }
    }
    DOM.bestDisplay.textContent = state.highScore;
  }

  // Save high score for the active user profile
  function saveHighScore(score) {
    try {
      const key = getHighScoreKey();
      localStorage.setItem(key, score.toString());
      if (state.currentUser) {
        state.currentUser.highestScore = score;
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state.currentUser));
      }
    } catch (e) {
      console.warn('localStorage not available for high score:', e);
    }
  }

  // Render leaderboard UI (Zero Bots! Strictly real registered players)
  async function renderLeaderboard() {
    const board = await API.getLeaderboard();
    const medals = ['🥇', '🥈', '🥉'];
    const currentEmail = state.currentUser ? state.currentUser.email.toLowerCase() : '';

    if (DOM.lbPlayerCount) {
      DOM.lbPlayerCount.textContent = `${board.length} Player${board.length === 1 ? '' : 's'}`;
    }

    // If 0 players have scored, show friendly empty state
    if (!board || board.length === 0) {
      if (DOM.leaderboardEmpty) DOM.leaderboardEmpty.classList.remove('hidden');
      if (DOM.leaderboardPodium) DOM.leaderboardPodium.innerHTML = '';
      if (DOM.leaderboardTableContainer) DOM.leaderboardTableContainer.classList.add('hidden');
      return;
    }

    if (DOM.leaderboardEmpty) DOM.leaderboardEmpty.classList.add('hidden');
    if (DOM.leaderboardTableContainer) DOM.leaderboardTableContainer.classList.remove('hidden');

    // Render Podium dynamically for up to 3 players
    if (DOM.leaderboardPodium) {
      const podiumCount = Math.min(3, board.length);
      let podiumHtml = '';
      for (let i = 0; i < podiumCount; i++) {
        const item = board[i];
        podiumHtml += `
          <div class="podium-card rank-${i + 1}">
            <span class="podium-medal">${medals[i]}</span>
            <span class="podium-ign" title="${item.ign}">${item.ign}</span>
            <span class="podium-score">${item.score} pts</span>
            <span class="podium-time">${item.time}</span>
          </div>
        `;
      }
      DOM.leaderboardPodium.innerHTML = podiumHtml;
    }

    // Render Table Rows
    if (DOM.leaderboardTbody) {
      DOM.leaderboardTbody.innerHTML = board.map((item, idx) => {
        const isCurrent = item.email && item.email.toLowerCase() === currentEmail;
        const medalOrRank = idx < 3 ? `${medals[idx]} #${idx + 1}` : `#${idx + 1}`;
        return `
          <tr class="${isCurrent ? 'current-user-row' : ''}">
            <td class="td-rank">${medalOrRank}</td>
            <td class="td-player">
              <strong>${item.ign || 'Player'}</strong>
              ${isCurrent ? '<span class="you-pill">YOU</span>' : ''}
            </td>
            <td class="td-score">${item.score}</td>
            <td class="td-time">${item.time}</td>
          </tr>
        `;
      }).join('');
    }
  }

  async function getPlayerRank() {
    if (!state.currentUser) return '-';
    const board = await API.getLeaderboard();
    const playerEmail = state.currentUser.email.toLowerCase();
    const rankIndex = board.findIndex((p) => p.email && p.email.toLowerCase() === playerEmail);
    return rankIndex >= 0 ? rankIndex + 1 : '-';
  }

  async function updateReadyRank() {
    if (DOM.readyRank && state.currentUser) {
      const r = await getPlayerRank();
      DOM.readyRank.textContent = typeof r === 'number' ? `#${r}` : r;
    }
  }

  function openLeaderboard() {
    soundEngine.init();
    soundEngine.uiClick();

    if (state.isRunning && !state.isPaused) {
      pauseGame();
    }

    renderLeaderboard();
    DOM.modalLeaderboard.classList.remove('hidden');
    DOM.btnCloseLeaderboard.focus();
  }

  function closeLeaderboard() {
    soundEngine.uiClick();
    DOM.modalLeaderboard.classList.add('hidden');
  }

  // Auth alert messages
  function showAuthAlert(msg, isError = true) {
    if (!DOM.authAlert) return;
    DOM.authAlert.className = `auth-alert ${isError ? 'error' : 'success'}`;
    DOM.authAlert.textContent = msg;
    DOM.authAlert.classList.remove('hidden');
  }

  function clearAuthAlert() {
    if (!DOM.authAlert) return;
    DOM.authAlert.className = 'auth-alert hidden';
    DOM.authAlert.textContent = '';
  }

  // Update Start Screen UI (Login Gate vs Ready Player Card)
  function updateStartScreenUI() {
    if (state.currentUser) {
      // Reveal Game HUD & Player Ready Card only when logged in
      if (DOM.gameHud) DOM.gameHud.classList.remove('hidden');
      if (DOM.startGateLogin) DOM.startGateLogin.classList.add('hidden');
      if (DOM.startPlayerReady) DOM.startPlayerReady.classList.remove('hidden');
      if (DOM.startDesc) DOM.startDesc.textContent = 'Endless Cosmic Survival! Catch falling stars before 5 escape.';

      if (DOM.readyIgn) DOM.readyIgn.textContent = state.currentUser.ign;
      if (DOM.readyEmail) DOM.readyEmail.textContent = state.currentUser.email;
      if (DOM.readyAvatar) DOM.readyAvatar.textContent = (state.currentUser.ign || 'P').charAt(0).toUpperCase();
      if (DOM.readyBest) DOM.readyBest.textContent = state.highScore;
      updateReadyRank();
    } else {
      // Hide Game HUD, Best Score, and Start Game on opening window
      if (DOM.gameHud) DOM.gameHud.classList.add('hidden');
      if (DOM.startGateLogin) DOM.startGateLogin.classList.remove('hidden');
      if (DOM.startPlayerReady) DOM.startPlayerReady.classList.add('hidden');
      if (DOM.startDesc) DOM.startDesc.textContent = 'Sign in or create an account to enter the arena and play.';
      clearAuthAlert();
    }
  }

  // Load saved user session from localStorage
  function loadUserSession() {
    try {
      const saved = localStorage.getItem(USER_STORAGE_KEY);
      if (saved) {
        const user = JSON.parse(saved);
        if (user && user.email) {
          if (!user.ign) {
            user.ign = user.name || user.email.split('@')[0];
          }
          applyUserSession(user);
          return;
        }
      }
    } catch (e) {
      console.warn('Error loading user session:', e);
    }
    applyGuestSession();
  }

  // Sign in user profile
  function signInUser(user) {
    if (!user.ign || !user.ign.trim()) {
      user.ign = user.name || user.email.split('@')[0];
    }
    user.ign = user.ign.trim();

    state.currentUser = user;
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
    } catch (e) {}

    applyUserSession(user);
    closeGoogleModal();
    soundEngine.uiClick();
  }

  // Sign out current user and return to guest mode
  function signOutUser() {
    soundEngine.uiClick();
    try {
      localStorage.removeItem(USER_STORAGE_KEY);
    } catch (e) {}

    applyGuestSession();
  }

  // Update UI for signed-in user
  function applyUserSession(user) {
    state.currentUser = user;
    const initial = (user.ign || user.email || 'P').charAt(0).toUpperCase();

    DOM.userAvatar.textContent = initial;
    DOM.userName.textContent = user.ign || 'Player';
    DOM.userEmail.textContent = user.email || '';

    DOM.userProfileBadge.classList.remove('hidden');
    DOM.btnGoogleLogin.style.display = 'none';

    loadHighScore();
    updateStartScreenUI();
  }

  // Update UI for guest mode
  function applyGuestSession() {
    state.currentUser = null;
    DOM.userProfileBadge.classList.add('hidden');
    DOM.btnGoogleLogin.style.display = 'inline-flex';

    loadHighScore();
    updateStartScreenUI();
  }

  // Google Modal controls
  function openGoogleModal() {
    soundEngine.init();
    soundEngine.uiClick();

    if (state.isRunning && !state.isPaused) {
      pauseGame();
    }

    DOM.modalGoogle.classList.remove('hidden');
    DOM.inputGmail.focus();
  }

  function closeGoogleModal() {
    soundEngine.uiClick();
    DOM.modalGoogle.classList.add('hidden');
  }

  /* ==========================================================================
     CHANGE IN-GAME NAME (IGN) MODAL & CONTROLS
     ========================================================================== */
  function openChangeIgnModal() {
    if (!state.currentUser) return;
    soundEngine.init();
    soundEngine.uiClick();

    if (state.isRunning && !state.isPaused) {
      pauseGame();
    }

    if (DOM.changeIgnAlert) {
      DOM.changeIgnAlert.classList.add('hidden');
      DOM.changeIgnAlert.textContent = '';
      DOM.changeIgnAlert.className = 'auth-alert hidden';
    }

    if (DOM.inputNewIgn) {
      DOM.inputNewIgn.value = state.currentUser.ign || '';
    }

    if (DOM.btnSubmitChangeIgn) {
      DOM.btnSubmitChangeIgn.disabled = false;
    }
    if (DOM.btnChangeIgnText) {
      DOM.btnChangeIgnText.textContent = 'Save New Name';
    }
    if (DOM.btnChangeIgnSpinner) {
      DOM.btnChangeIgnSpinner.classList.add('hidden');
    }

    if (DOM.modalChangeIgn) {
      DOM.modalChangeIgn.classList.remove('hidden');
    }

    setTimeout(() => {
      if (DOM.inputNewIgn) {
        DOM.inputNewIgn.focus();
        DOM.inputNewIgn.select();
      }
    }, 50);
  }

  function closeChangeIgnModal() {
    soundEngine.uiClick();
    if (DOM.modalChangeIgn) {
      DOM.modalChangeIgn.classList.add('hidden');
    }
    if (DOM.changeIgnAlert) {
      DOM.changeIgnAlert.classList.add('hidden');
      DOM.changeIgnAlert.textContent = '';
    }
  }

  function showChangeIgnAlert(msg, isSuccess = false) {
    if (!DOM.changeIgnAlert) return;
    DOM.changeIgnAlert.textContent = msg;
    DOM.changeIgnAlert.className = `auth-alert ${isSuccess ? 'success' : 'error'}`;
    DOM.changeIgnAlert.classList.remove('hidden');
  }

  async function handleChangeIgnSubmit(e) {
    e.preventDefault();
    if (!state.currentUser) return;

    const newIgn = (DOM.inputNewIgn ? DOM.inputNewIgn.value : '').trim();

    if (!newIgn || newIgn.length < 2 || newIgn.length > 16) {
      showChangeIgnAlert('In-Game Name must be between 2 and 16 characters.', false);
      if (DOM.inputNewIgn) DOM.inputNewIgn.focus();
      return;
    }

    // If identical to current IGN, just close
    if (newIgn === state.currentUser.ign) {
      closeChangeIgnModal();
      return;
    }

    // Set loading state
    if (DOM.btnSubmitChangeIgn) DOM.btnSubmitChangeIgn.disabled = true;
    if (DOM.btnChangeIgnText) DOM.btnChangeIgnText.textContent = 'Saving...';
    if (DOM.btnChangeIgnSpinner) DOM.btnChangeIgnSpinner.classList.remove('hidden');

    const res = await API.changeIgn(state.currentUser.email, newIgn);

    if (DOM.btnSubmitChangeIgn) DOM.btnSubmitChangeIgn.disabled = false;
    if (DOM.btnChangeIgnText) DOM.btnChangeIgnText.textContent = 'Save New Name';
    if (DOM.btnChangeIgnSpinner) DOM.btnChangeIgnSpinner.classList.add('hidden');

    if (!res.ok) {
      showChangeIgnAlert(res.data && res.data.error ? res.data.error : 'Failed to update name.', false);
      if (DOM.inputNewIgn) DOM.inputNewIgn.focus();
      return;
    }

    // Success! Update local state
    state.currentUser.ign = res.data.user.ign;
    try {
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(state.currentUser));
    } catch (err) {}

    // Update displays
    applyUserSession(state.currentUser);
    renderLeaderboard();
    soundEngine.starCatch('golden');

    showChangeIgnAlert(`Name successfully changed to "${res.data.user.ign}"!`, true);
    setTimeout(() => {
      closeChangeIgnModal();
    }, 700);
  }

  // Initialize official Google Identity Services if available and configured
  function initGoogleIdentityServices() {
    if (window.google && window.google.accounts && CONFIG.GOOGLE_CLIENT_ID) {
      try {
        window.google.accounts.id.initialize({
          client_id: CONFIG.GOOGLE_CLIENT_ID,
          callback: (response) => {
            // Decode standard JWT credential
            try {
              const base64Url = response.credential.split('.')[1];
              const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
              const jsonPayload = decodeURIComponent(
                atob(base64)
                  .split('')
                  .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
                  .join('')
              );
              const payload = JSON.parse(jsonPayload);
              signInUser({
                name: payload.name || payload.given_name || 'Google User',
                email: payload.email,
                avatar: payload.picture
              });
            } catch (jwtErr) {
              console.warn('Error parsing Google JWT:', jwtErr);
            }
          }
        });
      } catch (err) {
        console.warn('Google Identity initialization error:', err);
      }
    }
  }

  function loadSoundSetting() {
    try {
      const saved = localStorage.getItem(SOUND_STORAGE_KEY);
      if (saved !== null) {
        state.soundEnabled = saved === 'true';
      }
    } catch (e) {
      state.soundEnabled = true;
    }
    updateSoundUI();
  }

  function toggleSound() {
    soundEngine.init();
    state.soundEnabled = !state.soundEnabled;
    try {
      localStorage.setItem(SOUND_STORAGE_KEY, state.soundEnabled.toString());
    } catch (e) {
      // Ignore localStorage error
    }
    updateSoundUI();
    if (state.soundEnabled) {
      soundEngine.uiClick();
    }
  }

  function updateSoundUI() {
    DOM.soundIcon.textContent = state.soundEnabled ? '🔊' : '🔇';
    DOM.btnSound.setAttribute(
      'aria-label',
      state.soundEnabled ? 'Mute Sound' : 'Unmute Sound'
    );
  }

  /* ==========================================================================
     10. SCREEN & UI FLOW (Start, Pause, Resume, Game Over)
     ========================================================================== */

  // Clear all stars from board and memory
  function clearAllStars() {
    DOM.starLayer.innerHTML = '';
    DOM.fxLayer.innerHTML = '';
    state.stars = [];
    clearTimeout(state.spawnTimeoutId);
  }

  // Start / Restart a fresh game session
  function startGame() {
    // Enforce mandatory login & in-game name
    if (!state.currentUser) {
      soundEngine.init();
      soundEngine.uiClick();
      updateStartScreenUI();
      if (DOM.signupGmail) DOM.signupGmail.focus();
      return;
    }

    soundEngine.init();
    soundEngine.uiClick();

    // Reset game state
    state.score = 0;
    state.misses = 0;
    state.starsCaught = 0;
    state.isRunning = true;
    state.isPaused = false;
    state.lastFrameTime = 0;

    // Reset HUD
    DOM.scoreDisplay.textContent = '0';
    DOM.scoreDisplay.classList.remove('score-pulse');
    updateMissUI();
    updateTimerUI();

    // Clean any remnants
    clearAllStars();
    cancelAnimationFrame(state.animationFrameId);

    // Hide all overlays
    DOM.overlayStart.classList.add('hidden');
    DOM.overlayStart.classList.remove('active');
    DOM.overlayPause.classList.add('hidden');
    DOM.overlayPause.classList.remove('active');
    DOM.overlayGameover.classList.add('hidden');
    DOM.overlayGameover.classList.remove('active');

    // In-game pause button state
    DOM.btnPause.style.display = 'flex';
    DOM.pauseIcon.textContent = '⏸';
    DOM.pauseLabel.textContent = 'Pause';

    // Start timer & game loop
    startTimer();
    state.animationFrameId = requestAnimationFrame(gameLoop);

    // Spawn first star immediately, then schedule regular intervals
    spawnStar();

    // Accessibility focus into game area
    DOM.gameArea.focus();
  }

  // Toggle Pause / Resume
  function togglePause() {
    if (!state.isRunning) return;

    soundEngine.init();
    soundEngine.uiClick();

    if (state.isPaused) {
      resumeGame();
    } else {
      pauseGame();
    }
  }

  function pauseGame() {
    if (!state.isRunning || state.isPaused) return;

    state.isPaused = true;
    clearTimeout(state.spawnTimeoutId);

    DOM.pauseIcon.textContent = '▶';
    DOM.pauseLabel.textContent = 'Resume';

    DOM.overlayPause.classList.remove('hidden');
    DOM.overlayPause.classList.add('active');
    DOM.btnResume.focus();
  }

  function resumeGame() {
    if (!state.isRunning || !state.isPaused) return;

    state.isPaused = false;
    state.lastFrameTime = performance.now();

    DOM.pauseIcon.textContent = '⏸';
    DOM.pauseLabel.textContent = 'Pause';

    DOM.overlayPause.classList.add('hidden');
    DOM.overlayPause.classList.remove('active');

    scheduleNextSpawn();
    DOM.gameArea.focus();
  }

  // End the game session
  async function endGame(reason) {
    if (!state.isRunning) return;

    state.isRunning = false;
    state.isPaused = false;

    // Cancel loops
    cancelAnimationFrame(state.animationFrameId);
    clearInterval(state.timerIntervalId);
    clearTimeout(state.spawnTimeoutId);

    // Hide in-game pause button
    DOM.btnPause.style.display = 'none';

    // Determine if new best score achieved locally
    const isNewHigh = state.score > 0 && state.score >= state.highScore;
    if (state.score > state.highScore) {
      state.highScore = state.score;
      saveHighScore(state.highScore);
      DOM.bestDisplay.textContent = state.highScore;
    }

    // Record score into server folder & leaderboard
    if (state.currentUser) {
      const timeStr = formatTime(state.elapsedSeconds);
      const res = await API.recordScore(state.currentUser.email, state.score, timeStr);
      if (res && res.rank) {
        if (DOM.finalRank) DOM.finalRank.textContent = `#${res.rank}`;
        if (DOM.readyRank) DOM.readyRank.textContent = `#${res.rank}`;
      } else {
        const localRank = await getPlayerRank();
        if (DOM.finalRank) DOM.finalRank.textContent = typeof localRank === 'number' ? `#${localRank}` : localRank;
      }
    } else {
      if (DOM.finalRank) DOM.finalRank.textContent = '-';
    }

    // Play game over tone
    soundEngine.gameOver(isNewHigh);

    // Update Game Over modal UI
    DOM.finalScore.textContent = state.score;
    DOM.finalBest.textContent = state.highScore;
    if (DOM.finalTime) {
      DOM.finalTime.textContent = formatTime(state.elapsedSeconds);
    }
    DOM.finalCaught.textContent = state.starsCaught;
    DOM.finalMisses.textContent = `${state.misses} / ${CONFIG.MAX_MISSES}`;

    DOM.gameoverReason.textContent = '💔 5 stars escaped past the cosmic boundary!';
    DOM.gameoverBadge.textContent = isNewHigh ? '🏆' : '💥';

    if (isNewHigh) {
      DOM.newHighBanner.classList.remove('hidden');
    } else {
      DOM.newHighBanner.classList.add('hidden');
    }

    // Show Game Over overlay
    DOM.overlayGameover.classList.remove('hidden');
    DOM.overlayGameover.classList.add('active');
    DOM.btnPlayAgain.focus();
  }

  // Return to the initial Start screen
  function backToHome() {
    soundEngine.uiClick();

    state.isRunning = false;
    state.isPaused = false;

    cancelAnimationFrame(state.animationFrameId);
    clearInterval(state.timerIntervalId);
    clearTimeout(state.spawnTimeoutId);
    clearAllStars();

    DOM.scoreDisplay.textContent = '0';
    state.misses = 0;
    state.elapsedSeconds = 0;
    updateMissUI();
    updateTimerUI();

    DOM.overlayGameover.classList.add('hidden');
    DOM.overlayGameover.classList.remove('active');
    DOM.overlayPause.classList.add('hidden');
    DOM.overlayPause.classList.remove('active');

    DOM.overlayStart.classList.remove('hidden');
    DOM.overlayStart.classList.add('active');
    DOM.btnPause.style.display = 'none';

    updateStartScreenUI();
  }

  // Instructions Modal controls
  function openInstructions() {
    soundEngine.init();
    soundEngine.uiClick();

    // Auto-pause if actively playing
    if (state.isRunning && !state.isPaused) {
      pauseGame();
    }

    DOM.modalInstructions.classList.remove('hidden');
    DOM.btnCloseModal.focus();
  }

  function closeInstructions() {
    soundEngine.uiClick();
    DOM.modalInstructions.classList.add('hidden');
  }

  /* ==========================================================================
     11. EVENT LISTENERS & KEYBOARD CONTROLS
     ========================================================================== */
  function setupEventListeners() {
    // Start button
    DOM.btnStart.addEventListener('click', startGame);

    // Pause / Resume buttons
    DOM.btnPause.addEventListener('click', togglePause);
    DOM.btnResume.addEventListener('click', resumeGame);
    DOM.btnPauseRestart.addEventListener('click', startGame);

    // Game Over buttons
    DOM.btnPlayAgain.addEventListener('click', startGame);
    DOM.btnBackHome.addEventListener('click', backToHome);

    // Sound toggle button
    DOM.btnSound.addEventListener('click', toggleSound);

    // Instructions modal triggers
    DOM.btnInfo.addEventListener('click', openInstructions);
    DOM.btnCloseModal.addEventListener('click', closeInstructions);
    DOM.btnModalGotIt.addEventListener('click', closeInstructions);

    // Close instructions modal on click outside content
    DOM.modalInstructions.addEventListener('click', (e) => {
      if (e.target === DOM.modalInstructions) {
        closeInstructions();
      }
    });

    // Tab switching (Sign Up vs Log In)
    if (DOM.tabBtnSignup && DOM.tabBtnLogin) {
      DOM.tabBtnSignup.addEventListener('click', () => {
        soundEngine.init();
        soundEngine.uiClick();
        DOM.tabBtnSignup.classList.add('active');
        DOM.tabBtnSignup.setAttribute('aria-selected', 'true');
        DOM.tabBtnLogin.classList.remove('active');
        DOM.tabBtnLogin.setAttribute('aria-selected', 'false');
        if (DOM.formSignup) DOM.formSignup.classList.remove('hidden');
        if (DOM.formLogin) DOM.formLogin.classList.add('hidden');
        clearAuthAlert();
      });

      DOM.tabBtnLogin.addEventListener('click', () => {
        soundEngine.init();
        soundEngine.uiClick();
        DOM.tabBtnLogin.classList.add('active');
        DOM.tabBtnLogin.setAttribute('aria-selected', 'true');
        DOM.tabBtnSignup.classList.remove('active');
        DOM.tabBtnSignup.setAttribute('aria-selected', 'false');
        if (DOM.formLogin) DOM.formLogin.classList.remove('hidden');
        if (DOM.formSignup) DOM.formSignup.classList.add('hidden');
        clearAuthAlert();
      });
    }

    // Password visibility toggles
    if (DOM.btnToggleSignupPwd && DOM.signupPassword) {
      DOM.btnToggleSignupPwd.addEventListener('click', () => {
        soundEngine.init();
        soundEngine.uiClick();
        const type = DOM.signupPassword.type === 'password' ? 'text' : 'password';
        DOM.signupPassword.type = type;
        DOM.btnToggleSignupPwd.textContent = type === 'password' ? '👁️' : '🙈';
      });
    }

    if (DOM.btnToggleLoginPwd && DOM.loginPassword) {
      DOM.btnToggleLoginPwd.addEventListener('click', () => {
        soundEngine.init();
        soundEngine.uiClick();
        const type = DOM.loginPassword.type === 'password' ? 'text' : 'password';
        DOM.loginPassword.type = type;
        DOM.btnToggleLoginPwd.textContent = type === 'password' ? '👁️' : '🙈';
      });
    }

    // Sign Up form submission
    if (DOM.formSignup) {
      DOM.formSignup.addEventListener('submit', async (e) => {
        e.preventDefault();
        soundEngine.init();
        clearAuthAlert();

        const email = (DOM.signupGmail.value || '').trim();
        const ign = (DOM.signupIgn.value || '').trim();
        const password = (DOM.signupPassword.value || '').trim();

        if (!email || !ign || !password) {
          showAuthAlert('Please fill in your Gmail, In-Game Name, and Password.');
          return;
        }

        if (password.length < 4) {
          showAuthAlert('Password must be at least 4 characters long.');
          return;
        }

        DOM.btnSignupSubmit.disabled = true;
        DOM.btnSignupSubmit.textContent = 'Registering Account...';

        const res = await API.signup(email, password, ign);
        DOM.btnSignupSubmit.disabled = false;
        DOM.btnSignupSubmit.innerHTML = '<span>Create Account &amp; Play</span><span aria-hidden="true">🚀</span>';

        if (res.ok && res.data.user) {
          showAuthAlert('Account created successfully! Welcome aboard 🚀', false);
          setTimeout(() => {
            signInUser(res.data.user);
          }, 350);
        } else {
          showAuthAlert((res.data && res.data.error) || 'Failed to create account. Please check details and try again.');
        }
      });
    }

    // Log In form submission
    if (DOM.formLogin) {
      DOM.formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        soundEngine.init();
        clearAuthAlert();

        const email = (DOM.loginGmail.value || '').trim();
        const password = (DOM.loginPassword.value || '').trim();

        if (!email || !password) {
          showAuthAlert('Please enter both your Gmail and password.');
          return;
        }

        DOM.btnLoginSubmit.disabled = true;
        DOM.btnLoginSubmit.textContent = 'Logging in...';

        const res = await API.login(email, password);
        DOM.btnLoginSubmit.disabled = false;
        DOM.btnLoginSubmit.innerHTML = '<span>Log In &amp; Continue Game</span><span aria-hidden="true">🔑</span>';

        if (res.ok && res.data.user) {
          showAuthAlert(`Welcome back, ${res.data.user.ign}!`, false);
          setTimeout(() => {
            signInUser(res.data.user);
          }, 350);
        } else {
          showAuthAlert((res.data && res.data.error) || 'Login failed. Please check your Gmail and password.');
        }
      });
    }

    // Switch player / Log out button on player ready card
    if (DOM.btnSwitchPlayer) {
      DOM.btnSwitchPlayer.addEventListener('click', signOutUser);
    }

    // Change In-Game Name triggers
    if (DOM.btnOpenChangeIgn) {
      DOM.btnOpenChangeIgn.addEventListener('click', openChangeIgnModal);
    }
    if (DOM.btnHeaderEditIgn) {
      DOM.btnHeaderEditIgn.addEventListener('click', openChangeIgnModal);
    }
    if (DOM.btnCloseChangeIgn) {
      DOM.btnCloseChangeIgn.addEventListener('click', closeChangeIgnModal);
    }
    if (DOM.btnCancelChangeIgn) {
      DOM.btnCancelChangeIgn.addEventListener('click', closeChangeIgnModal);
    }
    if (DOM.formChangeIgn) {
      DOM.formChangeIgn.addEventListener('submit', handleChangeIgnSubmit);
    }
    if (DOM.modalChangeIgn) {
      DOM.modalChangeIgn.addEventListener('click', (e) => {
        if (e.target === DOM.modalChangeIgn) {
          closeChangeIgnModal();
        }
      });
    }

    // Leaderboard trigger buttons
    if (DOM.btnLeaderboardNav) {
      DOM.btnLeaderboardNav.addEventListener('click', openLeaderboard);
    }
    if (DOM.btnGateLeaderboard) {
      DOM.btnGateLeaderboard.addEventListener('click', openLeaderboard);
    }
    if (DOM.btnStartLeaderboard) {
      DOM.btnStartLeaderboard.addEventListener('click', openLeaderboard);
    }
    if (DOM.btnGameoverLeaderboard) {
      DOM.btnGameoverLeaderboard.addEventListener('click', openLeaderboard);
    }
    if (DOM.btnCloseLeaderboard) {
      DOM.btnCloseLeaderboard.addEventListener('click', closeLeaderboard);
    }
    if (DOM.btnLeaderboardCloseBtn) {
      DOM.btnLeaderboardCloseBtn.addEventListener('click', closeLeaderboard);
    }
    if (DOM.modalLeaderboard) {
      DOM.modalLeaderboard.addEventListener('click', (e) => {
        if (e.target === DOM.modalLeaderboard) {
          closeLeaderboard();
        }
      });
    }

    // Google / Gmail Auth triggers
    if (DOM.btnGoogleLogin) {
      DOM.btnGoogleLogin.addEventListener('click', openGoogleModal);
    }
    if (DOM.btnCloseGoogleModal) {
      DOM.btnCloseGoogleModal.addEventListener('click', closeGoogleModal);
    }
    if (DOM.modalGoogle) {
      DOM.modalGoogle.addEventListener('click', (e) => {
        if (e.target === DOM.modalGoogle) {
          closeGoogleModal();
        }
      });
    }
    if (DOM.btnSignOut) {
      DOM.btnSignOut.addEventListener('click', signOutUser);
    }

    // Gmail form manual submit
    if (DOM.formGmailLogin) {
      DOM.formGmailLogin.addEventListener('submit', (e) => {
        e.preventDefault();
        const email = (DOM.inputGmail.value || '').trim();
        if (email) {
          const namePart = email.split('@')[0];
          const displayName = namePart.charAt(0).toUpperCase() + namePart.slice(1);
          signInUser({
            ign: displayName,
            name: displayName,
            email: email,
            avatar: null
          });
          DOM.inputGmail.value = '';
        }
      });
    }

    // Quick 1-click account buttons
    if (DOM.quickAccountBtns) {
      DOM.quickAccountBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          const email = btn.getAttribute('data-email');
          const name = btn.getAttribute('data-name');
          signInUser({ ign: name, name: name, email: email, avatar: null });
        });
      });
    }

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Modal escape close handlers
      if (DOM.modalChangeIgn && !DOM.modalChangeIgn.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          closeChangeIgnModal();
        }
        return;
      }

      if (DOM.modalLeaderboard && !DOM.modalLeaderboard.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          closeLeaderboard();
        }
        return;
      }

      if (DOM.modalGoogle && !DOM.modalGoogle.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          closeGoogleModal();
        }
        return;
      }

      if (DOM.modalInstructions && !DOM.modalInstructions.classList.contains('hidden')) {
        if (e.key === 'Escape') {
          closeInstructions();
        }
        return;
      }

      // 'L' or 'l': Toggle Leaderboard (only if not typing in input)
      if ((e.key === 'l' || e.key === 'L') && !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA'))) {
        e.preventDefault();
        if (DOM.modalLeaderboard && !DOM.modalLeaderboard.classList.contains('hidden')) {
          closeLeaderboard();
        } else {
          openLeaderboard();
        }
        return;
      }

      // Spacebar: Start, Play Again, or Resume if paused
      if (e.code === 'Space') {
        if (e.target && (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT')) return;
        if (!state.isRunning) {
          e.preventDefault();
          startGame();
        } else if (state.isPaused) {
          e.preventDefault();
          resumeGame();
        }
      }

      // 'P' or 'p': Toggle Pause
      if (e.key === 'p' || e.key === 'P') {
        if (e.target && e.target.tagName === 'INPUT') return;
        e.preventDefault();
        togglePause();
      }

      // 'M' or 'm': Toggle Sound
      if (e.key === 'm' || e.key === 'M') {
        if (e.target && e.target.tagName === 'INPUT') return;
        e.preventDefault();
        toggleSound();
      }

      // 'Escape': Pause if playing, or Resume if paused
      if (e.key === 'Escape') {
        if (state.isRunning) {
          e.preventDefault();
          togglePause();
        }
      }
    });

    // Prevent touch gestures like double-tap zoom inside game area
    DOM.gameArea.addEventListener(
      'touchmove',
      (e) => {
        if (state.isRunning) {
          e.preventDefault();
        }
      },
      { passive: false }
    );
  }

  /* ==========================================================================
     12. AMBIENT BACKGROUND STARFIELD CANVAS
     Ultra-lightweight background with twinkling stars and drifting dust.
     Optimized to consume <1% CPU so game loop runs at maximum smoothness.
     ========================================================================== */
  class StarfieldBackground {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.stars = [];
      this.starCount = 75; // Lightweight count
      this.animId = null;

      this.resize = this.resize.bind(this);
      this.render = this.render.bind(this);

      window.addEventListener('resize', this.resize);
      this.resize();
      this.initStars();
      this.render();
    }

    resize() {
      this.width = window.innerWidth;
      this.height = window.innerHeight;
      this.canvas.width = this.width;
      this.canvas.height = this.height;
    }

    initStars() {
      this.stars = [];
      for (let i = 0; i < this.starCount; i++) {
        this.stars.push({
          x: Math.random() * this.width,
          y: Math.random() * this.height,
          size: Math.random() * 1.6 + 0.4,
          alpha: Math.random() * 0.7 + 0.2,
          twinkleSpeed: (Math.random() * 0.02 + 0.008) * (Math.random() > 0.5 ? 1 : -1),
          driftY: Math.random() * 0.15 + 0.05
        });
      }
    }

    render() {
      this.ctx.clearRect(0, 0, this.width, this.height);

      for (let i = 0; i < this.stars.length; i++) {
        const star = this.stars[i];

        // Subtle twinkling
        star.alpha += star.twinkleSpeed;
        if (star.alpha > 0.9 || star.alpha < 0.2) {
          star.twinkleSpeed = -star.twinkleSpeed;
        }

        // Slow downward cosmic drift
        star.y += star.driftY;
        if (star.y > this.height) {
          star.y = 0;
          star.x = Math.random() * this.width;
        }

        this.ctx.beginPath();
        this.ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(215, 225, 255, ${star.alpha})`;
        this.ctx.fill();
      }

      this.animId = requestAnimationFrame(this.render);
    }
  }

  /* ==========================================================================
     13. INITIALIZATION
     ========================================================================== */
  function init() {
    loadUserSession(); // Restores Gmail user session & user-specific high score
    loadSoundSetting();
    renderLeaderboard(); // Prepares podium and rankings
    setupEventListeners();
    initGoogleIdentityServices(); // Google OAuth GIS SDK hook

    // Start ambient canvas starfield
    if (DOM.bgCanvas) {
      new StarfieldBackground(DOM.bgCanvas);
    }

    // Initial pause button state (hidden until game starts)
    DOM.btnPause.style.display = 'none';

    // Ready log for developers/inspectors
    console.log('⭐ Catch the Stars (Endless Survival + Gmail Login) initialized successfully!');
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
