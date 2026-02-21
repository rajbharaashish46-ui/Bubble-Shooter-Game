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

    playPop() {
        if (!this.enabled) return;
        this._playTone(800, 400, 'triangle', 0.05, 0.4);
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

        const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
        grad.addColorStop(0, '#ffffff');
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, this._shadeColor(this.color, -30));

        ctx.fillStyle = grad;
        ctx.fill();
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

        this.audio = new AudioSyncer();

        this.state = GAME_STATE.START;
        this.score = 0;
        this.currentLevel = 0;

        this.grid = [];
        this.bubbles = [];
        this.particles = [];
        this.floatingBubbles = [];

        this.playerCannon = { x: 0, y: 0, angle: -Math.PI / 2 };
        this.activeBubble = null;
        this.nextBubbleColor = null;

        this.cols = 11;
        this.bubbleRadius = 0;
        this.rowHeight = 0;
        this.maxRows = 0;

        this.mousePos = { x: 0, y: 0 };

        this.resize = this.resize.bind(this);
        this.loop = this.loop.bind(this);
        this.handlePointerMove = this.handlePointerMove.bind(this);
        this.handlePointerDown = this.handlePointerDown.bind(this);
        this.handlePointerUp = this.handlePointerUp.bind(this); // new up handler

        window.addEventListener('resize', this.resize);
        this.canvas.addEventListener('mousemove', this.handlePointerMove);
        this.canvas.addEventListener('mousedown', this.handlePointerDown);
        this.canvas.addEventListener('mouseup', this.handlePointerUp); // bind up to shoot

        this.canvas.addEventListener('touchmove', this.handlePointerMove, { passive: false });
        this.canvas.addEventListener('touchstart', this.handlePointerDown, { passive: false });
        this.canvas.addEventListener('touchend', this.handlePointerUp, { passive: false }); // bind up to shoot

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
        this.maxRows = Math.floor(this.canvas.height / this.rowHeight) - 2;

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
        const y = this.bubbleRadius + (row * this.rowHeight);
        return { x, y };
    }

    getGridPositionFromPixels(x, y) {
        let row = Math.round((y - this.bubbleRadius) / this.rowHeight);
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
        this.state = GAME_STATE.PLAYING;
        this.grid = [];
        this.bubbles = [];
        this.particles = [];
        this.floatingBubbles = [];

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
        const colorArr = Array.from(availableColors);

        if (colorArr.length === 0) {
            this.nextBubbleColor = COLOR_VALUES[0];
        } else {
            this.nextBubbleColor = colorArr[Math.floor(Math.random() * colorArr.length)];
        }
        this.nextBallPreviewEl.style.backgroundColor = this.nextBubbleColor;
    }

    loadActiveBubble() {
        // Start the bubble slightly lower so it animated up into the cannon
        this.activeBubble = new Bubble(this.playerCannon.x, this.playerCannon.y + this.bubbleRadius * 2, this.bubbleRadius, this.nextBubbleColor);
        this.pickNextBubble();
    }

    handlePointerMove(e) {
        if (this.state !== GAME_STATE.PLAYING) return;

        let clientX = e.clientX;
        let clientY = e.clientY;

        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
            e.preventDefault();
        }

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
        this.handlePointerMove(e);
        // Removed shoot() from here so player can aim by holding down
    }

    handlePointerUp(e) {
        if (this.state !== GAME_STATE.PLAYING) return;
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
            if (this.activeBubble.y - this.bubbleRadius <= 0) {
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
        const matchGroup = this.findMatches(row, col, savedColor);

        if (matchGroup.length >= 3) {
            this.audio.playPop();
            this.updateScore(matchGroup.length * 10);

            // Pop matched cluster
            for (let b of matchGroup) {
                b.popping = true;
                this.grid[b.row][b.col] = null;
                this.createParticles(b.x, b.y, b.color, 8);
            }

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
        if (matchGroup.length < 3) {
            this.state = GAME_STATE.PLAYING;
            this.checkWinCondition();
        }

        // Check game over
        if (this.state !== GAME_STATE.GAME_OVER) {
            for (let c = 0; c < this.cols; c++) {
                if (this.grid[this.maxRows - 1] && this.grid[this.maxRows - 1][c] != null) {
                    this.handleGameOver();
                    return;
                }
            }
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
        if (!this.activeBubble || this.state !== GAME_STATE.PLAYING ||
            this.activeBubble.vx !== 0 || this.activeBubble.vy !== 0) return;

        this.ctx.save();
        this.ctx.setLineDash([10, 15]);
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.beginPath();

        let startX = this.playerCannon.x;
        let startY = this.playerCannon.y;
        this.ctx.moveTo(startX, startY);

        // Use a much larger multiplier so the line reaches the top of very tall screens
        const lineLength = Math.max(this.canvas.width, this.canvas.height) * 4;
        const targetX = startX + Math.cos(this.playerCannon.angle) * lineLength;
        const targetY = startY + Math.sin(this.playerCannon.angle) * lineLength;

        if (targetX < 0) {
            // Hit left wall
            let t = -startX / (targetX - startX);
            let hitY = startY + t * (targetY - startY);
            this.ctx.lineTo(0, hitY);
            // Reflect off the left wall (mirror X coordinates)
            this.ctx.lineTo(-targetX, targetY);
        } else if (targetX > this.canvas.width) {
            // Hit right wall
            let t = (this.canvas.width - startX) / (targetX - startX);
            let hitY = startY + t * (targetY - startY);
            this.ctx.lineTo(this.canvas.width, hitY);
            // Reflect off the right wall (mirror X coordinates)
            this.ctx.lineTo(2 * this.canvas.width - targetX, targetY);
        } else {
            this.ctx.lineTo(targetX, targetY);
        }

        this.ctx.stroke();
        this.ctx.restore();
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.state === GAME_STATE.PLAYING) {
            this.drawAimLine();
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

        // Draw player cannon
        this.ctx.fillStyle = 'var(--panel-bg)';
        this.ctx.beginPath();
        this.ctx.arc(this.playerCannon.x, this.playerCannon.y, this.bubbleRadius * 2, Math.PI, 0);
        this.ctx.fill();

        // Draw cannon barrel
        this.ctx.save();
        this.ctx.translate(this.playerCannon.x, this.playerCannon.y);
        this.ctx.rotate(this.playerCannon.angle);
        this.ctx.fillStyle = 'var(--accent)';
        this.ctx.shadowColor = 'var(--accent-glow)';
        this.ctx.shadowBlur = 10;
        this.ctx.beginPath();
        this.ctx.roundRect(0, -this.bubbleRadius * 0.4, this.bubbleRadius * 3, this.bubbleRadius * 0.8, 8);
        this.ctx.fill();
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
