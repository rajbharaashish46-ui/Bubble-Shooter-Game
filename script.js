/**
 * Bubble Arcade Classic - Game Engine
 * A modern, vanilla JS bubble shooter.
 */

// --- Audio Engine (Web Audio API Synthesizer) ---
class AudioSyncer {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = false;
    }

    init() {
        if (this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
        this.enabled = true;
    }

    playShoot() {
        if (!this.enabled) return;
        this._playTone(300, 100, 'sine', 0.1, 0.5);
    }

    playPop(colorObj, pitchScale = 1) {
        if (!this.enabled) return;
        const freqs = {
            '#ef4444': 400, // Red
            '#22c55e': 450, // Green
            '#3b82f6': 500, // Blue
            '#eab308': 650, // Yellow
            '#a855f7': 600, // Purple
            '#f97316': 550, // Orange
            'bomb': 200
        };
        let bFreq = freqs[colorObj] || 500;

        // Soft sa catchy: sine wave
        this._playTone(bFreq * pitchScale, (bFreq * pitchScale) * 0.8, 'sine', 0.15, 0.4);
    }

    playBounce() {
        if (!this.enabled) return;
        this._playTone(200, 150, 'sine', 0.1, 0.3);
    }

    playWin() {
        if (!this.enabled) return;
        this._playTone(400, 600, 'square', 0.1, 0.5);
        setTimeout(() => this._playTone(600, 800, 'square', 0.2, 0.5), 100);
        setTimeout(() => this._playTone(800, 1200, 'square', 0.4, 0.5), 300);
    }

    playLose() {
        if (!this.enabled) return;
        this._playTone(300, 200, 'sawtooth', 0.5, 0.6);
        setTimeout(() => this._playTone(200, 100, 'sawtooth', 0.5, 0.6), 300);
    }

    _playTone(startFreq, endFreq, type, duration, vol) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(startFreq, this.ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(endFreq, this.ctx.currentTime + duration);

        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }
}

// --- Enums & Constants ---
const COLORS = {
    RED: '#ef4444',
    GREEN: '#22c55e',
    BLUE: '#3b82f6',
    YELLOW: '#eab308',
    PURPLE: '#a855f7',
    ORANGE: '#f97316'
};
const COLOR_VALUES = Object.values(COLORS);

const GAME_STATE = {
    START: 0,
    PLAYING: 1,
    ANIMATING: 2, // While resolving matches/falls
    GAME_OVER: 3,
    WIN: 4
};

// --- Level Definitions ---
const LEVELS = [
    { speed: 12, rows: 4, pattern: (r, c) => Math.floor(Math.random() * 3) },
    { speed: 14, rows: 5, pattern: (r, c) => r % 4 },
    { speed: 16, rows: 6, pattern: (r, c) => (r + c) % 5 },
    { speed: 18, rows: 7, pattern: (r, c) => (Math.abs(r - c)) % 6 },
    { speed: 20, rows: 8, pattern: (r, c) => Math.floor(Math.random() * 6) }
];

// --- Classes ---

class Bubble {
    constructor(x, y, radius, color, row = -1, col = -1) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.row = row;
        this.col = col;
        this.vx = 0;
        this.vy = 0;
        this.active = true;
        this.popping = false;
        this.popScale = 1;
        this.popAlpha = 1;
        this.falling = false;
    }

    draw(ctx) {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.popping) {
            ctx.scale(this.popScale, this.popScale);
            ctx.globalAlpha = this.popAlpha;
        }
        if (!this.popping && !this.falling) {
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetY = 3;
        }
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);

        if (this.color === 'bomb') {
            const grad = ctx.createRadialGradient(-this.radius * 0.2, -this.radius * 0.2, this.radius * 0.1, 0, 0, this.radius);
            grad.addColorStop(0, '#555555');
            grad.addColorStop(1, '#000000');
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.fillStyle = '#ef4444';
            ctx.shadowColor = '#ef4444';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius * 0.4, 0, Math.PI * 2);
            ctx.fill();
        } else {
            const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
            grad.addColorStop(0, '#ffffff');
            grad.addColorStop(0.3, this.color);
            grad.addColorStop(1, this._shadeColor(this.color, -30));

            ctx.fillStyle = grad;
            ctx.fill();
        }
        ctx.restore();
    }

    update(dt) {
        if (this.popping) {
            this.popScale += 0.05 * (dt / 16);
            this.popAlpha -= 0.1 * (dt / 16);
            if (this.popAlpha <= 0) {
                this.active = false;
                this.popping = false;
            }
        } else if (this.falling) {
            this.vy += 0.5 * (dt / 16);
            this.x += this.vx * (dt / 16);
            this.y += this.vy * (dt / 16);
        } else if (this.vx !== 0 || this.vy !== 0) {
            this.x += this.vx * (dt / 16);
            this.y += this.vy * (dt / 16);
        }
    }

    _shadeColor(color, percent) {
        let R = parseInt(color.substring(1, 3), 16);
        let G = parseInt(color.substring(3, 5), 16);
        let B = parseInt(color.substring(5, 7), 16);
        R = parseInt(R * (100 + percent) / 100);
        G = parseInt(G * (100 + percent) / 100);
        B = parseInt(B * (100 + percent) / 100);
        R = (R < 255) ? R : 255; G = (G < 255) ? G : 255; B = (B < 255) ? B : 255;
        let RR = ((R.toString(16).length == 1) ? "0" + R.toString(16) : R.toString(16));
        let GG = ((G.toString(16).length == 1) ? "0" + G.toString(16) : G.toString(16));
        let BB = ((B.toString(16).length == 1) ? "0" + B.toString(16) : B.toString(16));
        return "#" + RR + GG + BB;
    }
}

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = 1.0;
        this.decay = Math.random() * 0.03 + 0.02;
        this.size = Math.random() * 4 + 2;
    }
    update(dt) {
        this.vy += 0.2 * (dt / 16);
        this.x += this.vx * (dt / 16);
        this.y += this.vy * (dt / 16);
        this.life -= this.decay * (dt / 16);
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
}

class FloatingText {
    constructor(x, y, text, color) {
        this.x = x;
        this.y = y;
        this.text = text;
        this.color = color;
        this.life = 1.0;
    }
    update(dt) {
        this.y -= 30 * (dt / 1000); // float up
        this.life -= 1.2 * (dt / 1000); // fade out over roughly a second
    }
    draw(ctx) {
        if (this.life <= 0) return;
        ctx.save();
        ctx.globalAlpha = Math.max(0, this.life);
        ctx.font = 'bold 26px Outfit';
        ctx.fillStyle = this.color;

        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 4;
        ctx.shadowOffsetY = 2;

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, this.x, this.y);
        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.scoreEl = document.getElementById('score');
        this.levelEl = document.getElementById('level');
        this.nextBallPreviewEl = document.getElementById('next-ball-preview');
        this.overlayEl = document.getElementById('overlay');
        this.overlayTitleStr = document.getElementById('overlay-title');
        this.overlayMsgStr = document.getElementById('overlay-message');
        this.finalScoreEl = document.getElementById('final-score');
        this.startScreenEl = document.getElementById('start-screen');

        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.proceedToNextOrRestart());
        document.getElementById('in-game-restart-btn').addEventListener('click', () => this.startGame());

        this.audio = new AudioSyncer();

        this.state = GAME_STATE.START;
        this.score = 0;
        this.currentLevel = 0;

        this.grid = [];
        this.bubbles = [];
        this.particles = [];
        this.floatingBubbles = [];
        this.floatingTexts = [];

        this.playerCannon = { x: 0, y: 0, angle: -Math.PI / 2 };
        this.activeBubble = null;
        this.nextBubbleColor = null;

        this.cols = 11;
        this.bubbleRadius = 0;
        this.rowHeight = 0;
        this.maxRows = 0;
        this.topMargin = 0;
        this.baseTopMargin = 0;
        this.currentCeilingOffset = 0;

        this.mousePos = { x: 0, y: 0 };
        this.isDragging = false;

        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this); // new up handler

        window.addEventListener('resize', this.resize);
        this.canvas.addEventListener('pointermove', this.handlePointerMove);
        this.canvas.addEventListener('pointerdown', this.handlePointerDown);
        this.canvas.addEventListener('pointerup', this.handlePointerUp);

        this.lastTime = 0;
        this.resize();
        requestAnimationFrame(this.loop);
    }

    resize() {
        const container = document.getElementById('game-container');
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;

        this.bubbleRadius = this.canvas.width / (this.cols * 2);
        this.rowHeight = this.bubbleRadius * Math.sqrt(3);

        const topUI = document.getElementById('top-ui');
        this.baseTopMargin = topUI ? topUI.offsetHeight + 40 : 100; // Add breathing room below UI
        this.topMargin = this.baseTopMargin + this.currentCeilingOffset;

        // Ensure we calculate rows factoring in the margin so bubbles don't go off bottom
        this.maxRows = Math.floor((this.canvas.height - this.baseTopMargin) / this.rowHeight) - 2;

        this.playerCannon.x = this.canvas.width / 2;
        this.playerCannon.y = this.canvas.height - this.bubbleRadius * 2;

        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.ANIMATING) {
            this.recalculateGridPositions();
            if (this.activeBubble && this.activeBubble.vx === 0 && this.activeBubble.vy === 0) {
                this.activeBubble.x = this.playerCannon.x;
                this.activeBubble.y = this.playerCannon.y;
            }
        }
    }

    recalculateGridPositions() {
        for (let r = 0; r < this.grid.length; r++) {
            if (!this.grid[r]) continue;
            for (let c = 0; c < this.grid[r].length; c++) {
                const b = this.grid[r][c];
                if (b) {
                    const coords = this.getGridCoordinates(r, c);
                    b.x = coords.x;
                    b.y = coords.y;
                    b.radius = this.bubbleRadius;
                }
            }
        }
    }

    getGridCoordinates(row, col) {
        const isOffset = row % 2 !== 0;
        const xOffset = isOffset ? this.bubbleRadius : 0;
        const x = xOffset + this.bubbleRadius + (col * this.bubbleRadius * 2);
        const y = this.topMargin + this.bubbleRadius + (row * this.rowHeight);
        return { x, y };
    }

    getGridPositionFromPixels(x, y) {
        let row = Math.round((y - this.topMargin - this.bubbleRadius) / this.rowHeight);
        row = Math.max(0, Math.min(row, this.maxRows - 1));

        const isOffset = row % 2 !== 0;
        const xOffset = isOffset ? this.bubbleRadius : 0;
        let col = Math.round((x - xOffset - this.bubbleRadius) / (this.bubbleRadius * 2));

        const maxCols = isOffset ? this.cols - 1 : this.cols;
        col = Math.max(0, Math.min(col, maxCols - 1));

        return { row, col };
    }

    startGame() {
        this.audio.init();
        this.startScreenEl.classList.add('hidden');
        this.overlayEl.classList.add('hidden');
        this.score = 0;
        this.currentLevel = 0;
        this.updateScore(0);
        this.loadLevel(this.currentLevel);
    }

    proceedToNextOrRestart() {
        if (this.state === GAME_STATE.WIN) {
            this.currentLevel++;
            if (this.currentLevel >= LEVELS.length) {
                // Completely beat the game
                this.currentLevel = 0;
                this.score = 0;
            }
            this.overlayEl.classList.add('hidden');
            this.loadLevel(this.currentLevel);
        } else {
            this.startGame();
        }
    }

    loadLevel(levelIndex) {
        this.currentCeilingOffset = 0;
        this.topMargin = this.baseTopMargin;

        this.state = GAME_STATE.PLAYING;
        this.grid = [];
        this.bubbles = [];
        this.particles = [];
        this.floatingBubbles = [];
        this.floatingTexts = [];

        const levelDef = LEVELS[levelIndex % LEVELS.length];
        this.levelEl.innerText = levelIndex + 1;

        for (let r = 0; r < this.maxRows; r++) {
            this.grid[r] = [];
            const colsInRow = (r % 2 !== 0) ? this.cols - 1 : this.cols;
            for (let c = 0; c < colsInRow; c++) {
                if (r < levelDef.rows) {
                    const colorIdx = levelDef.pattern(r, c);
                    if (colorIdx >= 0 && colorIdx < COLOR_VALUES.length) {
                        const coords = this.getGridCoordinates(r, c);
                        const b = new Bubble(coords.x, coords.y, this.bubbleRadius, COLOR_VALUES[colorIdx], r, c);
                        this.grid[r][c] = b;
                        this.bubbles.push(b);
                    } else {
                        this.grid[r][c] = null;
                    }
                } else {
                    this.grid[r][c] = null;
                }
            }
        }

        this.pickNextBubble();
        this.loadActiveBubble();
    }

    pickNextBubble() {
        const availableColors = new Set(this.bubbles.filter(b => b.active && !b.popping && !b.falling).map(b => b.color));
        let colorArr = Array.from(availableColors);

        if (colorArr.length === 0) {
            colorArr = COLOR_VALUES;
        }

        // 5% chance of a bomb bubble
        if (Math.random() < 0.05) {
            this.nextBubbleColor = 'bomb';
            this.nextBallPreviewEl.style.backgroundColor = '#222';
            this.nextBallPreviewEl.style.boxShadow = '0 0 10px #ef4444';
        } else {
            // normal color
            // filter out 'bomb' if it somehow got in availableColors
            colorArr = colorArr.filter(c => c !== 'bomb');
            if (colorArr.length === 0) colorArr = COLOR_VALUES;

            this.nextBubbleColor = colorArr[Math.floor(Math.random() * colorArr.length)];
            this.nextBallPreviewEl.style.backgroundColor = this.nextBubbleColor;
            this.nextBallPreviewEl.style.boxShadow = '';
        }
    }

    loadActiveBubble() {
        // Start the bubble slightly lower so it animated up into the cannon
        this.activeBubble = new Bubble(this.playerCannon.x, this.playerCannon.y + this.bubbleRadius * 2, this.bubbleRadius, this.nextBubbleColor);
        this.pickNextBubble();
    }

    handlePointerMove(e) {
        if (this.state !== GAME_STATE.PLAYING) return;

        // Pointer event already contains clientX/clientY correctly for both mouse and touch!
        const clientX = e.clientX;
        const clientY = e.clientY;

        const rect = this.canvas.getBoundingClientRect();
        this.mousePos.x = clientX - rect.left;
        this.mousePos.y = clientY - rect.top;

        const dx = this.mousePos.x - this.playerCannon.x;
        let dy = this.mousePos.y - this.playerCannon.y;

        // If aiming anywhere below the cannon, treat it as aiming straight horizontal
        if (dy > 0) {
            dy = -0.001;
        }

        this.playerCannon.angle = Math.atan2(dy, dx);

        if (this.playerCannon.angle > -0.1) this.playerCannon.angle = -0.1;
        if (this.playerCannon.angle < -Math.PI + 0.1) this.playerCannon.angle = -Math.PI + 0.1;
    }

    handlePointerDown(e) {
        if (this.state !== GAME_STATE.PLAYING) return;
        // Don't register canvas clicks down if we touched a UI button
        if (e.target !== this.canvas) return;

        this.isDragging = true;
        this.canvas.setPointerCapture(e.pointerId); // Lock pointer to canvas during drag
        this.handlePointerMove(e);
        // Removed shoot() from here so player can aim by holding down
    }

    handlePointerUp(e) {
        if (this.state !== GAME_STATE.PLAYING) return;
        this.isDragging = false;
        this.canvas.releasePointerCapture(e.pointerId);
        this.shoot();
    }

    shoot() {
        if (this.state !== GAME_STATE.PLAYING) return;
        if (!this.activeBubble || this.activeBubble.vx !== 0 || this.activeBubble.vy !== 0) return;

        this.audio.playShoot();
        const speed = LEVELS[this.currentLevel % LEVELS.length].speed;
        this.activeBubble.vx = Math.cos(this.playerCannon.angle) * speed;
        this.activeBubble.vy = Math.sin(this.playerCannon.angle) * speed;
    }

    updateScore(points) {
        this.score += points;
        this.scoreEl.innerText = this.score;
        this.scoreEl.style.transform = 'scale(1.5)';
        this.scoreEl.style.color = 'var(--accent)';
        setTimeout(() => {
            this.scoreEl.style.transform = 'scale(1)';
            this.scoreEl.style.color = 'var(--text-primary)';
        }, 150);
    }

    handleWin() {
        this.state = GAME_STATE.WIN;
        this.audio.playWin();
        if (this.currentLevel >= LEVELS.length - 1) {
            this.overlayTitleStr.innerText = "GAME CLEARED!";
            this.overlayMsgStr.innerText = "You beat all levels! Amazing!";
            document.getElementById('restart-btn').innerText = "PLAY AGAIN";
        } else {
            this.overlayTitleStr.innerText = "LEVEL CLEARED!";
            this.overlayMsgStr.innerText = "Excellent aiming!";
            document.getElementById('restart-btn').innerText = "NEXT LEVEL";
        }
        this.finalScoreEl.innerText = this.score;
        this.overlayEl.classList.remove('hidden');
    }

    handleGameOver() {
        this.state = GAME_STATE.GAME_OVER;
        this.audio.playLose();
        this.overlayTitleStr.innerText = "GAME OVER";
        this.overlayMsgStr.innerText = "The bubbles reached the bottom!";
        this.finalScoreEl.innerText = this.score;
        this.overlayEl.classList.remove('hidden');
        document.getElementById('restart-btn').innerText = "TRY AGAIN";
    }

    loop(timestamp) {
        const dt = timestamp - this.lastTime;
        this.lastTime = timestamp;

        // Cap dt to prevent massive jumps when tab is inactive
        this.update(Math.min(dt, 30));
        this.draw();

        requestAnimationFrame(this.loop);
    }

    update(dt) {
        if (this.state === GAME_STATE.START) return;

        // Drop ceiling slowly
        if (this.state === GAME_STATE.PLAYING || this.state === GAME_STATE.ANIMATING) {
            this.currentCeilingOffset += 6 * (dt / 1000); // 6 pixels per second
            this.topMargin = this.baseTopMargin + this.currentCeilingOffset;
            this.recalculateGridPositions();

            // Check if any active grid bubbles touch the gun (GAME OVER)
            for (let b of this.bubbles) {
                if (b.active && !b.popping && !b.falling) {
                    if (b.y + b.radius * 0.8 >= this.playerCannon.y) {
                        this.handleGameOver();
                        return;
                    }
                }
            }
        }

        // Update active bubbles that are popping or falling
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.update(dt);
            if (!b.active && !b.popping && !b.falling) {
                this.bubbles.splice(i, 1);
            }
        }

        for (let i = this.floatingBubbles.length - 1; i >= 0; i--) {
            const fb = this.floatingBubbles[i];
            if (fb.y > this.canvas.height + this.bubbleRadius) {
                this.floatingBubbles.splice(i, 1);
                fb.falling = false;
                fb.active = false;
            }
        }

        // Update Particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (this.particles[i].life <= 0) {
                this.particles.splice(i, 1);
            }
        }

        // Update Floating Texts
        for (let i = this.floatingTexts.length - 1; i >= 0; i--) {
            this.floatingTexts[i].update(dt);
            if (this.floatingTexts[i].life <= 0) {
                this.floatingTexts.splice(i, 1);
            }
        }

        let animatingBubbles = this.bubbles.some(b => b.popping || b.falling);
        if (this.state === GAME_STATE.ANIMATING && !animatingBubbles) {
            // Animation finished
            this.state = GAME_STATE.PLAYING;
            this.checkWinCondition();
        }

        // Active Bubble loading animation
        if (this.activeBubble && this.activeBubble.vx === 0 && this.activeBubble.vy === 0) {
            // Animate it dropping into the cannon
            if (this.activeBubble.y < this.playerCannon.y) {
                this.activeBubble.y += 10 * (dt / 16);
                if (this.activeBubble.y > this.playerCannon.y) {
                    this.activeBubble.y = this.playerCannon.y;
                }
            } else if (this.activeBubble.y > this.playerCannon.y) {
                this.activeBubble.y -= 10 * (dt / 16);
                if (this.activeBubble.y < this.playerCannon.y) {
                    this.activeBubble.y = this.playerCannon.y; // safety clamp
                }
            }
        }

        // Update Active Player Bubble (Shot)
        if (this.activeBubble && (this.activeBubble.vx !== 0 || this.activeBubble.vy !== 0)) {
            this.activeBubble.update(dt);

            // Wall collisions
            if (this.activeBubble.x - this.bubbleRadius <= 0) {
                this.activeBubble.x = this.bubbleRadius;
                this.activeBubble.vx *= -1;
                this.audio.playBounce();
            } else if (this.activeBubble.x + this.bubbleRadius >= this.canvas.width) {
                this.activeBubble.x = this.canvas.width - this.bubbleRadius;
                this.activeBubble.vx *= -1;
                this.audio.playBounce();
            }

            // Ceiling collision
            if (this.activeBubble.y - this.bubbleRadius <= this.topMargin) {
                this.snapBubble();
                return;
            }

            // Bubble collisions
            let hasCollided = false;
            for (let b of this.bubbles) {
                if (b.popping || b.falling) continue;

                let dist = Math.hypot(this.activeBubble.x - b.x, this.activeBubble.y - b.y);
                if (dist <= this.bubbleRadius * 2 * 0.95) { // slight leniency
                    hasCollided = true;
                    break;
                }
            }

            if (hasCollided) {
                this.snapBubble();
            }
        }
    }

    playBurstSounds(count, color) {
        for (let i = 0; i < count; i++) {
            setTimeout(() => {
                this.audio.playPop(color, 1 + (i * 0.05)); // pitch goes up each bubble softly
            }, i * 100); // 100ms delay between each soft pop sound
        }

        if (count >= 5 && window.speechSynthesis) { // Combo announcer
            setTimeout(() => {
                const phrases = ["Nice play!", "Impressive!", "Awesome!", "Well scored!", "You are playing very well!"];
                const text = phrases[Math.floor(Math.random() * phrases.length)];
                let u = new SpeechSynthesisUtterance(text);
                u.rate = 1.1;
                u.pitch = 1.2;
                window.speechSynthesis.speak(u);
            }, 300);
        }
    }

    snapBubble() {
        this.audio.playBounce();
        this.state = GAME_STATE.ANIMATING;

        const pos = this.getGridPositionFromPixels(this.activeBubble.x, this.activeBubble.y);
        let row = pos.row;
        let col = pos.col;

        // Fallback for snapping into an already occupied grid cell - find nearest empty
        if (this.grid[row] && this.grid[row][col] != null) {
            let found = false;
            const neighbors = this.getNeighbors(row, col);
            for (let n of neighbors) {
                if (this.grid[n.r][n.c] == null) {
                    row = n.r;
                    col = n.c;
                    found = true;
                    break;
                }
            }
            if (!found) { // Game Over condition essentially if board is stuffed and no neighbor found
                this.handleGameOver();
                return;
            }
        }

        const coords = this.getGridCoordinates(row, col);
        this.activeBubble.x = coords.x;
        this.activeBubble.y = coords.y;
        this.activeBubble.vx = 0;
        this.activeBubble.vy = 0;
        this.activeBubble.row = row;
        this.activeBubble.col = col;

        if (!this.grid[row]) this.grid[row] = [];
        this.grid[row][col] = this.activeBubble;
        this.bubbles.push(this.activeBubble);

        const savedColor = this.activeBubble.color;
        this.activeBubble = null;

        // Check Matches
        let matchGroup = [];
        if (savedColor === 'bomb') {
            // Explode bomb plus surrounding bubbles
            matchGroup = [this.grid[row][col]];
            const neighbors = this.getNeighbors(row, col);
            for (let n of neighbors) {
                let b = this.grid[n.r][n.c];
                if (b && !b.popping && !b.falling) {
                    if (!matchGroup.includes(b)) matchGroup.push(b);
                }
            }
        } else {
            matchGroup = this.findMatches(row, col, savedColor);
        }

        if (matchGroup.length >= 3 || (savedColor === 'bomb' && matchGroup.length > 0)) {
            let popScore = matchGroup.length * 10;
            this.playBurstSounds(matchGroup.length, savedColor);

            // Pop matched cluster
            for (let b of matchGroup) {
                b.popping = true;
                this.grid[b.row][b.col] = null;
                this.createParticles(b.x, b.y, b.color === 'bomb' ? '#ef4444' : b.color, 8);
            }

            // Draw floating text
            let centerB = this.grid[row] && this.grid[row][col] ? this.grid[row][col] : matchGroup[0];
            if (centerB) {
                this.floatingTexts.push(new FloatingText(centerB.x, centerB.y, `+${popScore}`, '#fde047'));
            }

            // Add score AFTER a short delay 
            setTimeout(() => this.updateScore(popScore), 600);

            // Find Disconnected
            const disconnected = this.findFloatingBubbles();
            for (let fb of disconnected) {
                fb.falling = true;
                this.floatingBubbles.push(fb);
                this.grid[fb.row][fb.col] = null; // Remove from grid directly
                this.updateScore(20); // Bonus score for dropped bubbles
            }
        }

        // Wait for animations, but if no matches load next bubble instantly
        if (matchGroup.length < 3 && savedColor !== 'bomb') {
            this.state = GAME_STATE.PLAYING;
            this.checkWinCondition();
        }
    }

    checkWinCondition() {
        if (this.state === GAME_STATE.GAME_OVER) return;

        // If grid has no active bubbles
        let hasActive = false;
        for (let b of this.bubbles) {
            if (b.active && !b.popping && !b.falling) {
                hasActive = true;
                break;
            }
        }

        if (!hasActive) {
            this.handleWin();
        } else if (this.state !== GAME_STATE.ANIMATING) {
            // BUG FIX: Ensure we always load a new bubble if there isn't one after animations
            if (!this.activeBubble) {
                this.loadActiveBubble();
            }
        }
    }

    // --- Graph Algorithms (BFS) ---

    getNeighbors(row, col) {
        const isOffset = row % 2 !== 0;
        const neighbors = [];

        // The 6 adjacent directions on hex grid
        const dirsOffset = [
            [-1, 0], [-1, 1],
            [0, -1], [0, 1],
            [1, 0], [1, 1]
        ];

        const dirsNormal = [
            [-1, -1], [-1, 0],
            [0, -1], [0, 1],
            [1, -1], [1, 0]
        ];

        const dirs = isOffset ? dirsOffset : dirsNormal;

        for (let [dr, dc] of dirs) {
            let nr = row + dr;
            let nc = col + dc;

            if (nr >= 0 && nr < this.maxRows) {
                const maxC = (nr % 2 !== 0) ? this.cols - 1 : this.cols;
                if (nc >= 0 && nc < maxC) {
                    neighbors.push({ r: nr, c: nc });
                }
            }
        }
        return neighbors;
    }

    findMatches(startRow, startCol, matchColor) {
        const visited = new Set();
        const cluster = [];
        const queue = [{ r: startRow, c: startCol }];

        visited.add(`${startRow},${startCol}`);

        while (queue.length > 0) {
            const { r, c } = queue.shift();
            const b = this.grid[r][c];

            if (b && b.color === matchColor && !b.popping && !b.falling) {
                cluster.push(b);

                const neighbors = this.getNeighbors(r, c);
                for (let n of neighbors) {
                    const hash = `${n.r},${n.c}`;
                    if (!visited.has(hash)) {
                        visited.add(hash);
                        queue.push(n);
                    }
                }
            }
        }

        return cluster;
    }

    findFloatingBubbles() {
        const visited = new Set();
        const queue = [];

        // Start BFS from Top Row
        if (this.grid[0]) {
            for (let c = 0; c < this.grid[0].length; c++) {
                const b = this.grid[0][c];
                if (b && !b.popping && !b.falling) {
                    queue.push({ r: 0, c });
                    visited.add(`0,${c}`);
                }
            }
        }

        while (queue.length > 0) {
            const { r, c } = queue.shift();
            const b = this.grid[r][c];

            if (b && !b.popping && !b.falling) {
                const neighbors = this.getNeighbors(r, c);
                for (let n of neighbors) {
                    const hash = `${n.r},${n.c}`;
                    if (!visited.has(hash)) {
                        const nb = this.grid[n.r][n.c];
                        if (nb && !nb.popping && !nb.falling) {
                            visited.add(hash);
                            queue.push(n);
                        }
                    }
                }
            }
        }

        // Find all bubbles NOT in the visited set
        const floating = [];
        for (let b of this.bubbles) {
            if (b.active && !b.popping && !b.falling) {
                if (!visited.has(`${b.row},${b.col}`)) {
                    floating.push(b);
                }
            }
        }

        return floating;
    }

    createParticles(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }

    // --- Drawing ---

    drawAimLine() {
        if (!this.isDragging) return;
        if (!this.activeBubble || this.state !== GAME_STATE.PLAYING ||
            this.activeBubble.vx !== 0 || this.activeBubble.vy !== 0) return;

        this.ctx.save();
        this.ctx.setLineDash([10, 15]);
        this.ctx.lineWidth = 4;

        if (this.activeBubble.color === 'bomb') {
            this.ctx.strokeStyle = '#ef4444'; // Red for bomb
        } else {
            this.ctx.strokeStyle = this.activeBubble.color;
        }
        this.ctx.globalAlpha = 0.6;

        this.ctx.beginPath();

        let startX = this.playerCannon.x;
        let startY = this.playerCannon.y;
        this.ctx.moveTo(startX, startY);

        let cx = startX;
        let cy = startY;
        let vx = Math.cos(this.playerCannon.angle);
        let vy = Math.sin(this.playerCannon.angle);

        // Max bounces to prevent infinite loop (just in case), user wants 1 fold reflect so limit is 2 ray segments.
        let bounces = 0;

        while (cy > this.topMargin && bounces < 2) {
            let tSide = Infinity;
            if (vx < 0) tSide = (0 - cx) / vx;
            else if (vx > 0) tSide = (this.canvas.width - cx) / vx;

            let tTop = (this.topMargin - cy) / Math.min(-0.001, vy); // vy is mostly negative

            let t = Math.min(tSide, tTop);

            cx += vx * t;
            cy += vy * t;
            this.ctx.lineTo(cx, cy);

            if (tTop <= tSide) {
                // Hit ceiling, stop drawing!
                break;
            } else {
                // Hit side wall, reflect X velocity instantly and continue
                vx *= -1;
                bounces++;
            }
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === GAME_STATE.PLAYING) {
            this.drawAimLine();
        }

        // Draw descending ceiling wall (Visible warning boundary)
        if (this.topMargin > 0) {
            this.ctx.save();
            this.ctx.fillStyle = 'rgba(239, 68, 68, 0.05)';
            this.ctx.fillRect(0, 0, this.canvas.width, this.topMargin);

            this.ctx.strokeStyle = '#ef4444'; // Red energy line
            this.ctx.lineWidth = 3;
            // Pulsing glow effect based on time
            let glow = 10 + Math.sin(Date.now() / 200) * 5;
            this.ctx.shadowBlur = glow;
            this.ctx.shadowColor = '#ef4444';

            this.ctx.beginPath();
            this.ctx.moveTo(0, this.topMargin);
            this.ctx.lineTo(this.canvas.width, this.topMargin);
            this.ctx.stroke();
            this.ctx.restore();
        }

        // Draw grid bubbles
        for (let b of this.bubbles) {
            if (!b.falling && !b.popping) b.draw(this.ctx);
        }

        // Draw popping bubbles
        for (let b of this.bubbles) {
            if (b.popping) b.draw(this.ctx);
        }

        // Draw falling bubbles
        for (let fb of this.floatingBubbles) {
            fb.draw(this.ctx);
        }

        // Draw Particles
        for (let p of this.particles) {
            p.draw(this.ctx);
        }

        // Draw Floating Texts
        for (let t of this.floatingTexts) {
            t.draw(this.ctx);
        }

        // Draw player cannon (Golden Shield Base)
        this.ctx.save();
        const gradient = this.ctx.createRadialGradient(
            this.playerCannon.x, this.playerCannon.y, this.bubbleRadius * 0.5,
            this.playerCannon.x, this.playerCannon.y, this.bubbleRadius * 2.5
        );
        gradient.addColorStop(0, '#fef08a'); // Bright gold
        gradient.addColorStop(0.6, '#eab308'); // Pure gold
        gradient.addColorStop(1, '#854d0e'); // Dark antique gold

        this.ctx.fillStyle = gradient;
        this.ctx.beginPath();
        this.ctx.arc(this.playerCannon.x, this.playerCannon.y, this.bubbleRadius * 2.5, Math.PI, 0);
        this.ctx.fill();

        // Shield Metallic Rim
        this.ctx.strokeStyle = '#fde047';
        this.ctx.lineWidth = 3;
        this.ctx.stroke();
        this.ctx.restore();

        // Draw cannon barrel
        this.ctx.save();
        this.ctx.translate(this.playerCannon.x, this.playerCannon.y);
        this.ctx.rotate(this.playerCannon.angle);

        // Golden barrel
        const barrelGrad = this.ctx.createLinearGradient(0, -this.bubbleRadius, 0, this.bubbleRadius);
        barrelGrad.addColorStop(0, '#d97706');
        barrelGrad.addColorStop(0.5, '#fde047');
        barrelGrad.addColorStop(1, '#d97706');
        this.ctx.fillStyle = barrelGrad;

        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 6;
        this.ctx.shadowOffsetY = 4;

        this.ctx.beginPath();
        // Snout
        this.ctx.roundRect(0, -this.bubbleRadius * 0.7, this.bubbleRadius * 3.5, this.bubbleRadius * 1.4, 6);
        this.ctx.fill();

        // Barrel Rim
        this.ctx.lineWidth = 2;
        this.ctx.strokeStyle = '#ca8a04';
        this.ctx.stroke();
        this.ctx.restore();

        // Draw active bubble ON TOP so it is visible in the gun
        if (this.activeBubble) {
            this.activeBubble.draw(this.ctx);
        }
    }
}

// Start Game Engine
window.onload = () => {
    window.game = new GameEngine();
};
