/**
 * Ashu Bubble Adventure - Core Game Engine
 */

const GAME_STATE = {
    START: 'START',
    MAP: 'MAP',
    PLAYING: 'PLAYING',
    PAUSED: 'PAUSED',
    WIN: 'WIN',
    LOSE: 'LOSE',
    ANIMATING: 'ANIMATING'
};

const BUBBLE_COLORS = [
    '#ef4444', // Red
    '#22c55e', // Green
    '#3b82f6', // Blue
    '#eab308', // Yellow
    '#a855f7', // Purple
    '#f97316'  // Orange
];

class AudioEngine {
    constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.enabled = true;
        this.musicEnabled = true;
    }

    _playTone(freq, duration, type = 'sine', vol = 0.2) {
        if (!this.enabled) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    }

    playShoot() { this._playTone(300, 0.2, 'sine', 0.1); }
    playPop() { this._playTone(600, 0.1, 'sine', 0.2); }
    playWin() {
        const now = this.ctx.currentTime;
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            setTimeout(() => this._playTone(f, 0.4, 'sine', 0.2), i * 150);
        });
    }
    playLose() { this._playTone(150, 0.5, 'sawtooth', 0.1); }
    playClick() { this._playTone(800, 0.05); }

    startMusic() {
        if (!this.musicEnabled) return;
        // Basic rhythmic pulse for background music
        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled) return;
            this._playTone(130.81, 0.8, 'triangle', 0.05);
        }, 1000);
    }
    stopMusic() { clearInterval(this.musicInterval); }
}

class Bubble {
    constructor(x, y, radius, color) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.color = color;
        this.vx = 0;
        this.vy = 0;
        this.popping = false;
        this.falling = false;
        this.popScale = 1;
        this.popAlpha = 1;
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.popping) {
            ctx.scale(this.popScale, this.popScale);
            ctx.globalAlpha = this.popAlpha;
        }

        const grad = ctx.createRadialGradient(-this.radius * 0.3, -this.radius * 0.3, this.radius * 0.1, 0, 0, this.radius);
        grad.addColorStop(0, '#fff');
        grad.addColorStop(0.4, this.color);
        grad.addColorStop(1, '#000');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        // Highlight shine
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        ctx.beginPath();
        ctx.arc(-this.radius * 0.35, -this.radius * 0.35, this.radius * 0.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.audio = new AudioEngine();

        this.state = GAME_STATE.START;
        this.score = 0;
        this.currentLevel = 0;
        this.movesRemaining = 25;
        this.unlockedLevel = parseInt(localStorage.getItem('ashu_unlocked')) || 0;

        this.bubbles = [];
        this.floatingBubbles = [];
        this.activeBubble = null;
        this.nextBubbleColor = null;
        this.isDragging = false;

        this.cols = 11;
        this.bubbleRadius = 0;
        this.rowHeight = 0;
        this.topMargin = 100;
        this.shotsTaken = 0;
        this.grid = [];
        this.dangerLineY = 0;

        this.initListeners();
        this.resize();
        this.loop();
    }

    initListeners() {
        window.addEventListener('resize', () => this.resize());

        // Screens & Buttons
        document.getElementById('start-game-btn').onclick = () => { this.audio.playWin(); this.showMap(); this.audio.startMusic(); };
        document.getElementById('settings-btn').onclick = () => this.audio.playClick();
        document.getElementById('map-back-btn').onclick = () => this.showStart();
        document.getElementById('pause-btn').onclick = () => this.pauseGame();
        document.getElementById('home-btn').onclick = () => this.showStart();
        document.getElementById('music-btn').onclick = () => this.toggleMusic();

        document.getElementById('resume-btn').onclick = () => this.resumeGame();
        document.getElementById('restart-btn').onclick = () => this.loadLevel(this.currentLevel);
        document.getElementById('popup-home-btn').onclick = () => this.showStart();
        document.getElementById('popup-music-btn').onclick = () => this.toggleMusic();
        document.getElementById('close-x').onclick = () => this.resumeGame();

        document.getElementById('win-next-btn').onclick = () => { this.currentLevel++; this.loadLevel(this.currentLevel); };
        document.getElementById('win-map-btn').onclick = () => this.showMap();
        document.getElementById('retry-btn').onclick = () => this.loadLevel(this.currentLevel);
        document.getElementById('lose-home-btn').onclick = () => this.showStart();

        // Interaction
        const handleStart = (e) => {
            if (this.state !== GAME_STATE.PLAYING) return;
            this.isDragging = true;
            this.handleMove(e);
        };
        const handleMove = (e) => {
            if (!this.isDragging || this.state !== GAME_STATE.PLAYING) return;
            const pos = this.getEventPos(e);
            this.targetAngle = Math.atan2(pos.y - this.cannonPos.y, pos.x - this.cannonPos.x);
        };
        const handleEnd = () => {
            if (this.isDragging) {
                this.isDragging = false;
                this.shoot();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); });
        window.addEventListener('touchmove', handleMove);
        window.addEventListener('touchend', handleEnd);
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.bubbleRadius = this.canvas.width / (this.cols * 2);
        this.rowHeight = this.bubbleRadius * 1.73;
        this.cannonPos = { x: this.canvas.width / 2, y: this.canvas.height - 130 };
        this.cannonPos = { x: this.canvas.width / 2, y: this.canvas.height - 130 };
        this.dangerLineY = this.cannonPos.y - this.bubbleRadius * 2;
        if (this.activeBubble) {
            this.activeBubble.x = this.cannonPos.x;
            this.activeBubble.y = this.cannonPos.y;
            this.activeBubble.radius = this.bubbleRadius;
        }
    }

    showStart() {
        this.state = GAME_STATE.START;
        this.switchScreen('start-screen');
    }

    showMap() {
        this.state = GAME_STATE.MAP;
        this.switchScreen('map-screen');
        this.renderMap();
    }

    switchScreen(id) {
        document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
        document.querySelectorAll('.overlay').forEach(o => o.classList.add('hidden'));
        document.getElementById(id).classList.remove('hidden');
    }

    renderMap() {
        const container = document.getElementById('level-nodes-container');
        container.innerHTML = '';
        for (let i = 0; i < 30; i++) {
            const node = document.createElement('div');
            node.className = `level-node ${i <= this.unlockedLevel ? 'unlocked' : 'locked'} ${i === this.unlockedLevel ? 'current' : ''}`;
            const row = Math.floor(i / 3);
            const col = i % 3;
            node.style.bottom = `${100 + i * 110}px`;
            node.style.left = `${20 + (i % 2 === 0 ? 20 : 60)}%`;
            node.innerText = i + 1;

            node.onclick = () => {
                if (i <= this.unlockedLevel) {
                    this.currentLevel = i;
                    this.loadLevel(i);
                } else {
                    const toast = document.getElementById('toast');
                    toast.classList.remove('hidden');
                    setTimeout(() => toast.classList.add('hidden'), 2000);
                }
            };
            container.appendChild(node);
        }
    }

    loadLevel(idx) {
        this.score = 0;
        this.currentLevel = idx;
        this.shotsTaken = 0;
        this.updateHUD();
        this.switchScreen('game-screen');
        this.state = GAME_STATE.PLAYING;

        // Create initial grid
        this.grid = [];
        this.bubbles = [];
        for (let r = 0; r < 8; r++) {
            this.grid[r] = [];
            for (let c = 0; c < (r % 2 === 0 ? this.cols : this.cols - 1); c++) {
                const color = BUBBLE_COLORS[Math.floor(Math.random() * 6)];
                const pos = this.getGridCoords(r, c);
                const b = new Bubble(pos.x, pos.y, this.bubbleRadius, color);
                this.grid[r][c] = b;
                this.bubbles.push(b);
            }
        }

        this.nextBubbleColor = BUBBLE_COLORS[Math.floor(Math.random() * 6)];
        this.loadActive();
    }

    loadActive() {
        this.activeBubble = new Bubble(this.cannonPos.x, this.cannonPos.y, this.bubbleRadius, this.nextBubbleColor);
        this.nextBubbleColor = BUBBLE_COLORS[Math.floor(Math.random() * 6)];
        document.getElementById('next-ball-circle').style.backgroundColor = this.nextBubbleColor;
    }

    getGridCoords(r, c) {
        const xOffset = (r % 2 !== 0) ? this.bubbleRadius : 0;
        return {
            x: xOffset + this.bubbleRadius + c * (this.bubbleRadius * 2),
            y: this.topMargin + this.bubbleRadius + r * this.rowHeight
        };
    }

    shoot() {
        if (!this.activeBubble || this.activeBubble.vx !== 0) return;
        this.audio.playShoot();
        const speed = 15;
        this.activeBubble.vx = Math.cos(this.targetAngle) * speed;
        this.activeBubble.vy = Math.sin(this.targetAngle) * speed;
        this.updateHUD();
    }

    updateHUD() {
        document.getElementById('score-val').innerText = this.score;
        document.getElementById('level-val').innerText = this.currentLevel + 1;
    }

    pauseGame() {
        this.state = GAME_STATE.PAUSED;
        document.getElementById('pause-overlay').classList.remove('hidden');
    }

    resumeGame() {
        this.state = GAME_STATE.PLAYING;
        document.getElementById('pause-overlay').classList.add('hidden');
    }

    toggleMusic() {
        this.audio.musicEnabled = !this.audio.musicEnabled;

        // Update HUD Icon with cross line
        const hudBtn = document.getElementById('music-btn');
        if (hudBtn) hudBtn.classList.toggle('music-off', !this.audio.musicEnabled);

        // Update Popup Btn
        const popupBtn = document.getElementById('popup-music-btn');
        if (popupBtn) popupBtn.innerText = `MUSIC ${this.audio.musicEnabled ? 'ON' : 'OFF'}`;

        if (!this.audio.musicEnabled) this.audio.stopMusic(); else this.audio.startMusic();
    }

    loop() {
        this.update();
        this.draw();
        requestAnimationFrame(() => this.loop());
    }

    update() {
        if (this.state !== GAME_STATE.PLAYING && this.state !== GAME_STATE.ANIMATING) return;

        if (this.activeBubble && (this.activeBubble.vx !== 0 || this.activeBubble.vy !== 0)) {
            this.activeBubble.x += this.activeBubble.vx;
            this.activeBubble.y += this.activeBubble.vy;

            // Wall bounce
            if (this.activeBubble.x < this.bubbleRadius || this.activeBubble.x > this.canvas.width - this.bubbleRadius) {
                this.activeBubble.vx *= -1;
            }

            // Top collision or Bubble collision
            if (this.activeBubble.y < this.topMargin + this.bubbleRadius || this.checkCollision()) {
                this.snapActive();
            }
        }

        // Update popping bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            if (b.popping) {
                b.popScale += 0.1;
                b.popAlpha -= 0.1;
                if (b.popAlpha <= 0) this.bubbles.splice(i, 1);
            }
            if (b.falling) {
                b.y += 10;
                if (b.y > this.canvas.height) this.bubbles.splice(i, 1);
            }
        }

        if (this.state === GAME_STATE.ANIMATING && !this.bubbles.some(b => b.popping || b.falling)) {
            this.state = GAME_STATE.PLAYING;
            this.checkGameStatus();
        }

        // Check Danger Line
        for (const b of this.bubbles) {
            if (!b.popping && !b.falling && b.y + b.radius > this.dangerLineY) {
                this.gameOver();
                break;
            }
        }
    }

    checkCollision() {
        for (const b of this.bubbles) {
            if (b.popping || b.falling) continue;
            const dist = Math.hypot(this.activeBubble.x - b.x, this.activeBubble.y - b.y);
            if (dist < this.bubbleRadius * 1.8) return true;
        }
        return false;
    }

    snapActive() {
        // Find best grid slot
        let bestSlot = { r: 0, c: 0, dist: Infinity };
        for (let r = 0; r < 20; r++) {
            const rowCount = (r % 2 === 0 ? this.cols : this.cols - 1);
            for (let c = 0; c < rowCount; c++) {
                if (this.grid[r] && this.grid[r][c]) continue;
                const pos = this.getGridCoords(r, c);
                const d = Math.hypot(this.activeBubble.x - pos.x, this.activeBubble.y - pos.y);
                if (d < bestSlot.dist) {
                    bestSlot = { r, c, dist: d };
                }
            }
        }

        const snapped = new Bubble(0, 0, this.bubbleRadius, this.activeBubble.color);
        const pos = this.getGridCoords(bestSlot.r, bestSlot.c);
        snapped.x = pos.x; snapped.y = pos.y;

        if (!this.grid[bestSlot.r]) this.grid[bestSlot.r] = [];
        this.grid[bestSlot.r][bestSlot.c] = snapped;
        this.bubbles.push(snapped);
        this.activeBubble = null;

        const matches = this.findMatches(bestSlot.r, bestSlot.c, snapped.color);
        if (matches.length >= 3) {
            this.popGroup(matches);
        } else {
            this.shotsTaken++;
            let threshold = 5;
            if (this.currentLevel === 1) threshold = 4;
            if (this.currentLevel >= 2) threshold = 3;

            if (this.shotsTaken >= threshold) {
                this.addNewRow();
                this.shotsTaken = 0;
            }
            this.loadActive();
        }
    }

    findMatches(r, c, color, visited = new Set()) {
        const key = `${r},${c}`;
        if (visited.has(key)) return [];
        visited.add(key);

        const bubble = this.grid[r] ? this.grid[r][c] : null;
        if (!bubble || bubble.color !== color) return [];

        let matches = [bubble];
        const neighbors = this.getNeighbors(r, c);
        for (const n of neighbors) {
            matches = matches.concat(this.findMatches(n.r, n.c, color, visited));
        }
        return matches;
    }

    getNeighbors(r, c) {
        const res = [];
        const evenOdd = r % 2 === 0 ? 0 : 1;
        const offsets = [
            [0, -1], [0, 1], [-1, evenOdd - 1], [-1, evenOdd], [1, evenOdd - 1], [1, evenOdd]
        ];
        for (const [dr, dc] of offsets) {
            const nr = r + dr, nc = c + dc;
            if (nr >= 0 && nc >= 0) res.push({ r: nr, c: nc });
        }
        return res;
    }

    popGroup(group) {
        this.audio.playPop();
        group.forEach(b => {
            b.popping = true;
            // Clear from grid
            for (let r = 0; r < this.grid.length; r++) {
                if (!this.grid[r]) continue;
                const idx = this.grid[r].indexOf(b);
                if (idx !== -1) this.grid[r][idx] = null;
            }
        });
        this.score += group.length * 100;
        this.updateHUD();
        this.state = GAME_STATE.ANIMATING;
        this.dropFloating();
        this.loadActive();
    }

    dropFloating() {
        const connected = new Set();
        const firstRow = this.grid[0] || [];
        firstRow.forEach((b, c) => { if (b) this.markConnected(0, c, connected); });

        this.bubbles.forEach(b => {
            if (b.popping || b.falling) return;
            let inGrid = false;
            for (let r = 0; r < 20; r++) {
                if (!this.grid[r]) continue;
                if (this.grid[r].includes(b) && connected.has(`${r},${this.grid[r].indexOf(b)}`)) {
                    inGrid = true; break;
                }
            }
            if (!inGrid) {
                b.falling = true;
                // remove from grid
                for (let r = 0; r < 20; r++) { if (this.grid[r]) { const i = this.grid[r].indexOf(b); if (i !== -1) this.grid[r][i] = null; } }
            }
        });
    }

    markConnected(r, c, seen) {
        const key = `${r},${c}`;
        if (seen.has(key) || !this.grid[r] || !this.grid[r][c]) return;
        seen.add(key);
        this.getNeighbors(r, c).forEach(n => this.markConnected(n.r, n.c, seen));
    }

    addNewRow() {
        // Shift grid down
        for (let r = 19; r > 0; r--) {
            this.grid[r] = this.grid[r - 1] || [];
            // Update bubble positions
            for (let c = 0; c < this.grid[r].length; c++) {
                const b = this.grid[r][c];
                if (b) {
                    const pos = this.getGridCoords(r, c);
                    b.x = pos.x; b.y = pos.y;
                }
            }
        }
        // Add new top row
        this.grid[0] = [];
        for (let c = 0; c < this.cols; c++) {
            const color = BUBBLE_COLORS[Math.floor(Math.random() * 6)];
            const pos = this.getGridCoords(0, c);
            const b = new Bubble(pos.x, pos.y, this.bubbleRadius, color);
            this.grid[0][c] = b;
            this.bubbles.push(b);
        }
    }

    checkGameStatus() {
        if (this.bubbles.length === 0) {
            this.winLevel();
        }
    }

    winLevel() {
        this.state = GAME_STATE.WIN;
        this.audio.playWin();
        if (this.currentLevel === this.unlockedLevel) {
            this.unlockedLevel++;
            localStorage.setItem('ashu_unlocked', this.unlockedLevel);
        }
        document.getElementById('star2').classList.add('active');
        if (this.score > 2000) document.getElementById('star1').classList.add('active');
        if (this.score > 5000) document.getElementById('star3').classList.add('active');

        document.getElementById('win-score-val').innerText = this.score;
        document.getElementById('win-overlay').classList.remove('hidden');
    }

    gameOver() {
        this.state = GAME_STATE.LOSE;
        this.audio.playLose();
        this.audio.stopMusic();
        document.getElementById('lose-overlay').classList.remove('hidden');
    }

    draw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Aim line
        if (this.isDragging && this.activeBubble) {
            this.ctx.beginPath();
            this.ctx.setLineDash([5, 10]);
            this.ctx.moveTo(this.cannonPos.x, this.cannonPos.y);
            this.ctx.lineTo(this.cannonPos.x + Math.cos(this.targetAngle) * 200, this.cannonPos.y + Math.sin(this.targetAngle) * 200);
            this.ctx.strokeStyle = 'rgba(255,255,255,0.5)';
            this.ctx.stroke();
            this.ctx.setLineDash([]);
        }

        this.bubbles.forEach(b => b.draw(this.ctx));
        if (this.activeBubble) this.activeBubble.draw(this.ctx);

        // Danger Line
        this.ctx.save();
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.dangerLineY);
        this.ctx.lineTo(this.canvas.width, this.dangerLineY);
        this.ctx.stroke();
        this.ctx.restore();

        // Draw Cannon
        this.ctx.save();
        this.ctx.translate(this.cannonPos.x, this.cannonPos.y);

        // Cannon Base
        const baseGrad = this.ctx.createRadialGradient(0, 0, 10, 0, 0, 40);
        baseGrad.addColorStop(0, '#1e293b');
        baseGrad.addColorStop(1, '#0f172a');
        this.ctx.fillStyle = baseGrad;
        this.ctx.beginPath();
        this.ctx.arc(0, 0, 40, Math.PI, 0);
        this.ctx.fill();

        this.ctx.rotate(this.targetAngle || -Math.PI / 2);

        // Cannon barrel
        const grad = this.ctx.createLinearGradient(0, -15, 0, 15);
        grad.addColorStop(0, '#475569');
        grad.addColorStop(0.5, '#94a3b8');
        grad.addColorStop(1, '#1e293b');

        this.ctx.fillStyle = grad;
        this.ctx.beginPath();
        this.ctx.roundRect(0, -15, 50, 30, 8);
        this.ctx.fill();
        this.ctx.strokeStyle = 'rgba(255,255,255,0.3)';
        this.ctx.lineWidth = 1;
        this.ctx.stroke();

        this.ctx.restore();
    }
}

window.onload = () => { window.game = new GameEngine(); };
