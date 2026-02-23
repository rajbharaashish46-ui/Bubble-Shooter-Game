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

    playClick() {
        this._playTone(1200, 0.08, 'sine', 0.15);
    }

    startMusic() {
        if (!this.musicEnabled) return;
        this.stopMusic();

        this.musicInterval = setInterval(() => {
            if (!this.musicEnabled) return;
            this._playTone(60, 0.15, 'sine', 0.3);
            setTimeout(() => {
                if (!this.musicEnabled) return;
                this._playTone(800, 0.05, 'triangle', 0.05);
            }, 500);
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
        grad.addColorStop(0.3, this.color);
        grad.addColorStop(1, this.calculateDarkerColor(this.color));

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();

        const shineGrad = ctx.createLinearGradient(0, -this.radius, 0, 0);
        shineGrad.addColorStop(0, 'rgba(255,255,255,0.8)');
        shineGrad.addColorStop(1, 'rgba(255,255,255,0)');

        ctx.fillStyle = shineGrad;
        ctx.beginPath();
        ctx.ellipse(0, -this.radius * 0.4, this.radius * 0.7, this.radius * 0.4, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = 'rgba(255,255,255,0.2)';
        ctx.beginPath();
        ctx.ellipse(0, this.radius * 0.6, this.radius * 0.5, this.radius * 0.2, 0, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }

    calculateDarkerColor(hex) {
        return hex + 'cc';
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
        this.unlockedLevel = parseInt(localStorage.getItem('ashu_unlocked')) || 0;

        this.bubbles = [];
        this.activeBubble = null;
        this.nextBubbleColor = null;
        this.isDragging = false;
        this.targetAngle = -Math.PI / 2;

        this.cols = 11;
        this.bubbleRadius = 0;
        this.rowHeight = 0;
        this.topMargin = 50;
        this.shotsTaken = 0;
        this.grid = [];
        this.dangerLineY = 0;

        this.initListeners();
        this.resize();
        this.loop();
    }

    initListeners() {
        window.addEventListener('resize', () => this.resize());

        document.getElementById('start-game-btn').onclick = () => { this.audio.playClick(); this.showMap(); this.audio.startMusic(); };
        document.getElementById('settings-btn').onclick = () => { this.audio.playClick(); this.pauseGame(); };
        document.getElementById('map-back-btn').onclick = () => { this.audio.playClick(); this.showStart(); };
        document.getElementById('in-game-pause-btn').onclick = () => { this.audio.playClick(); this.pauseGame(); };
        document.getElementById('exchange-btn').onclick = () => { this.audio.playClick(); this.exchangeBall(); };
        document.getElementById('close-x').onclick = () => { this.audio.playClick(); this.resumeGame(); };

        document.getElementById('win-next-btn').onclick = () => { this.audio.playClick(); this.currentLevel++; this.loadLevel(this.currentLevel); };
        document.getElementById('win-map-btn').onclick = () => { this.audio.playClick(); this.showMap(); };
        document.getElementById('win-retry-btn').onclick = () => { this.audio.playClick(); this.loadLevel(this.currentLevel); };
        document.getElementById('retry-btn').onclick = () => { this.audio.playClick(); this.loadLevel(this.currentLevel); };
        document.getElementById('lose-home-btn').onclick = () => { this.audio.playClick(); this.showStart(); };

        document.getElementById('how-to-play-btn').onclick = () => this.audio.playClick();
        document.getElementById('popup-music-btn').onclick = () => { this.audio.playClick(); this.toggleMusic(); };
        document.getElementById('language-btn').onclick = () => this.audio.playClick();

        const handleMove = (e) => {
            if (this.state !== GAME_STATE.PLAYING) return;
            const pos = this.getEventPos(e);
            this.targetAngle = Math.atan2(pos.y - this.cannonPos.y, pos.x - this.cannonPos.x);
        };

        const handleStart = (e) => {
            if (this.state !== GAME_STATE.PLAYING) return;
            if (e.type === 'touchstart') {
                this.isDragging = true;
                handleMove(e);
            } else if (e.type === 'mousedown') {
                this.shoot();
            }
        };

        const handleEnd = (e) => {
            if (e.type === 'touchend' && this.isDragging) {
                this.isDragging = false;
                this.shoot();
            }
        };

        this.canvas.addEventListener('mousedown', handleStart);
        window.addEventListener('mousemove', handleMove);
        this.canvas.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });
        window.addEventListener('touchmove', (e) => { handleMove(e); }, { passive: false });
        window.addEventListener('touchend', (e) => { handleEnd(e); }, { passive: false });
    }

    getEventPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        const clientX = (e.touches && e.touches.length > 0) ? e.touches[0].clientX : e.clientX;
        const clientY = (e.touches && e.touches.length > 0) ? e.touches[0].clientY : e.clientY;
        return { x: clientX - rect.left, y: clientY - rect.top };
    }

    resize() {
        const container = this.canvas.parentElement;
        this.canvas.width = container.clientWidth;
        this.canvas.height = container.clientHeight;
        this.bubbleRadius = this.canvas.width / (this.cols * 2);
        this.rowHeight = this.bubbleRadius * 1.73;
        this.cannonPos = { x: this.canvas.width / 2, y: this.canvas.height - 100 };
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
        const grid = document.getElementById('level-grid');
        grid.innerHTML = '';
        const pageSize = 20;
        const startIdx = (this.currentPage || 0) * pageSize;
        const endIdx = startIdx + pageSize;

        for (let i = startIdx; i < endIdx && i < 100; i++) {
            const item = document.createElement('div');
            const isUnlocked = i <= this.unlockedLevel;
            item.className = `level-item ${isUnlocked ? 'unlocked' : 'locked'}`;
            item.innerText = i + 1;

            if (isUnlocked) {
                item.onclick = (e) => {
                    e.stopPropagation();
                    this.audio.playClick();
                    this.currentLevel = i;
                    this.loadLevel(i);
                };
            } else {
                item.onclick = (e) => {
                    e.stopPropagation();
                    this.audio.playClick();
                    const toast = document.getElementById('toast');
                    toast.innerText = "Level Locked!";
                    toast.classList.remove('hidden');
                    setTimeout(() => toast.classList.add('hidden'), 2000);
                };
            }
            grid.appendChild(item);
        }

        const dots = document.querySelectorAll('.dot');
        dots.forEach((dot, idx) => {
            dot.className = `dot ${idx === (this.currentPage || 0) ? 'active' : ''}`;
            dot.onclick = () => { this.currentPage = idx; this.renderMap(); };
        });
    }

    loadLevel(idx) {
        this.score = 0;
        this.currentLevel = idx;
        this.shotsTaken = 0;
        this.updateHUD();
        this.switchScreen('game-screen');
        this.state = GAME_STATE.PLAYING;

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
        const nextBallEl = document.getElementById('footer-next-ball');
        if (nextBallEl) nextBallEl.style.backgroundColor = this.nextBubbleColor;
    }

    exchangeBall() {
        if (!this.activeBubble || this.activeBubble.vx !== 0) return;
        this.audio.playClick();
        const temp = this.activeBubble.color;
        this.activeBubble.color = this.nextBubbleColor;
        this.nextBubbleColor = temp;
        const nextBallEl = document.getElementById('footer-next-ball');
        if (nextBallEl) nextBallEl.style.backgroundColor = this.nextBubbleColor;
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
        const scoreEl = document.getElementById('score-val');
        const levelEl = document.getElementById('level-val');
        if (scoreEl) scoreEl.innerText = this.score;
        if (levelEl) levelEl.innerText = this.currentLevel + 1;
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
        const popupBtnSpan = document.querySelector('#popup-music-btn span');
        if (popupBtnSpan) popupBtnSpan.innerText = `Sound ${this.audio.musicEnabled ? 'on' : 'off'}`;
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

            if (this.activeBubble.x < this.bubbleRadius || this.activeBubble.x > this.canvas.width - this.bubbleRadius) {
                this.activeBubble.vx *= -1;
            }

            if (this.activeBubble.y < this.topMargin + this.bubbleRadius || this.checkCollision()) {
                this.snapActive();
            }
        }

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
        for (let r = 19; r > 0; r--) {
            this.grid[r] = this.grid[r - 1] || [];
            for (let c = 0; c < this.grid[r].length; c++) {
                const b = this.grid[r][c];
                if (b) {
                    const pos = this.getGridCoords(r, c);
                    b.x = pos.x; b.y = pos.y;
                }
            }
        }
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

        const stars = [
            document.getElementById('star1-win'),
            document.getElementById('star2-win'),
            document.getElementById('star3-win')
        ];
        stars.forEach(s => s.classList.remove('active'));

        stars[0].classList.add('active');
        if (this.score > 1500) stars[1].classList.add('active');
        if (this.score > 3000) stars[2].classList.add('active');

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

        if (this.activeBubble && (this.isDragging || (this.state === GAME_STATE.PLAYING && !window.matchMedia("(pointer: coarse)").matches))) {
            this.ctx.save();
            this.ctx.beginPath();
            this.ctx.setLineDash([8, 12]);
            this.ctx.lineWidth = 4;
            this.ctx.strokeStyle = this.activeBubble.color;
            this.ctx.globalAlpha = 0.6;

            let curX = this.cannonPos.x;
            let curY = this.cannonPos.y;
            let curVX = Math.cos(this.targetAngle);
            let curVY = Math.sin(this.targetAngle);

            this.ctx.moveTo(curX, curY);

            for (let i = 0; i < 800; i += 5) {
                curX += curVX * 5;
                curY += curVY * 5;

                if (curX < this.bubbleRadius || curX > this.canvas.width - this.bubbleRadius) {
                    curVX *= -1;
                    this.ctx.lineTo(curX, curY);
                }

                if (curY < this.topMargin + this.bubbleRadius) break;

                let hitIdx = this.bubbles.findIndex(b => !b.popping && !b.falling && Math.hypot(curX - b.x, curY - b.y) < this.bubbleRadius * 2);
                if (hitIdx !== -1) break;
            }
            this.ctx.lineTo(curX, curY);
            this.ctx.stroke();
            this.ctx.restore();
        }

        this.bubbles.forEach(b => b.draw(this.ctx));

        // Draw Danger Line
        this.ctx.save();
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeStyle = '#ef4444';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(0, this.dangerLineY);
        this.ctx.lineTo(this.canvas.width, this.dangerLineY);
        this.ctx.stroke();
        this.ctx.restore();

        // Draw Cannon Base / Body first
        this.ctx.save();
        this.ctx.translate(this.cannonPos.x, this.cannonPos.y);

        this.ctx.fillStyle = 'rgba(0,0,0,0.2)';
        this.ctx.beginPath();
        this.ctx.ellipse(0, 45, 40, 10, 0, 0, Math.PI * 2);
        this.ctx.fill();

        const potGrad = this.ctx.createLinearGradient(-35, 0, 35, 0);
        potGrad.addColorStop(0, '#1e293b');
        potGrad.addColorStop(0.5, '#334155');
        potGrad.addColorStop(1, '#0f172a');

        this.ctx.fillStyle = potGrad;
        this.ctx.rotate(this.targetAngle + Math.PI / 2); // Rotate cannon body
        this.ctx.beginPath();
        this.ctx.moveTo(-20, -40);
        this.ctx.quadraticCurveTo(-45, 0, -35, 40);
        this.ctx.lineTo(35, 40);
        this.ctx.quadraticCurveTo(45, 0, 20, -40);
        this.ctx.closePath();
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = '#fbbf24';
        this.ctx.fillRect(-38, 0, 76, 10);

        this.ctx.fillStyle = '#ef4444';
        this.ctx.beginPath();
        this.ctx.arc(0, 5, 12, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        this.ctx.restore();

        // Draw Active Bubble LAST (In the nozzle)
        if (this.activeBubble) {
            if (this.activeBubble.vx === 0 && this.activeBubble.vy === 0) {
                // Place in nozzle
                const nozzleX = this.cannonPos.x + Math.cos(this.targetAngle) * 35;
                const nozzleY = this.cannonPos.y + Math.sin(this.targetAngle) * 35;
                const originalX = this.activeBubble.x;
                const originalY = this.activeBubble.y;
                this.activeBubble.x = nozzleX;
                this.activeBubble.y = nozzleY;
                this.activeBubble.draw(this.ctx);
                this.activeBubble.x = originalX;
                this.activeBubble.y = originalY;
            } else {
                this.activeBubble.draw(this.ctx);
            }
        }
    }
}

window.onload = () => { window.game = new GameEngine(); };
