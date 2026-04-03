const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('sim-container');

// UI Elements
const getElem = id => document.getElementById(id);
const massInput = getElem('mass');
const gravityInput = getElem('gravity');
const frictionInput = getElem('friction');
const timescaleInput = getElem('timescale');
const scenarioSelect = getElem('scenario');
const btnPause = getElem('btn-pause'), btnReset = getElem('btn-reset');

// Checkboxes
const checkGrid = getElem('check-grid');
const checkPie = getElem('check-pie');
const checkBar = getElem('check-bar');
const checkSlow = getElem('check-slow');

// Labels
const valMass = getElem('val-mass'), valGravity = getElem('val-gravity'), valFriction = getElem('val-friction'), valTimescale = getElem('val-timescale');
const keLabel = getElem('val-ke'), peLabel = getElem('val-pe'), teLabel = getElem('val-te');
const keBar = getElem('bar-ke'), peBar = getElem('bar-pe'), teBar = getElem('bar-te');

// Colors
const Colors = {
    ke: '#22c55e', // Green
    pe: '#3b82f6', // Blue
    te: '#f59e0b', // Yellow
    thermal: '#ef4444' // Red (Friction)
};

// State
let width, height;
const pixelsToMeters = 60;
let isPaused = false, isDragging = false;
let timeScale = 1.0;
let currentScenario = 'free';

let ball = {
    x: 100, y: 100, radius: 18,
    vx: 0, vy: 0,
    mass: 10, gravity: 9.8, friction: 0.01,
    color: '#6366f1',
    thermalEnergy: 0
};

// --- Surface Definitions (PhET-style Ramps) ---
const getSurfaceY = (x) => {
    if (currentScenario === 'free') return height - 50;
    
    if (currentScenario === 'ramp') {
        const margin = 100;
        const startY = 150, endY = height - 100;
        if (x < margin) return startY;
        if (x > width - margin) return endY;
        return startY + (x - margin) * (endY - startY) / (width - margin * 2);
    }
    
    if (currentScenario === 'parabola') {
        const centerX = width / 2;
        const bottomY = height - 100;
        const depth = 400;
        const bowlWidth = (width - 150) / 2;
        const k = depth / Math.pow(bowlWidth, 2);
        return bottomY - Math.max(0, depth - k * Math.pow(x - centerX, 2));
    }
    
    if (currentScenario === 'loop') {
        return height/2 + 120 * Math.sin(x * 0.012) + 120;
    }
    return height - 50;
};

function getSurfaceNormal(x) {
    const y1 = getSurfaceY(x - 0.5);
    const y2 = getSurfaceY(x + 0.5);
    const dx = 1.0;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    return { nx: -dy / len, ny: dx / len, tx: dx / len, ty: dy / len, angle: Math.atan2(dy, dx) };
}

function reset() {
    if (currentScenario === 'free') {
        ball.x = width / 2; ball.y = 100;
    } else {
        ball.x = 120; ball.y = getSurfaceY(120) - ball.radius - 20;
    }
    ball.vx = 0; ball.vy = 0;
    ball.thermalEnergy = 0;
}

function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    reset();
}

window.addEventListener('resize', resize);
resize();

// UI Observers
massInput.oninput = (e) => { ball.mass = +e.target.value; valMass.innerText = ball.mass; };
gravityInput.oninput = (e) => { ball.gravity = +e.target.value; valGravity.innerText = ball.gravity; };
frictionInput.oninput = (e) => { ball.friction = (+e.target.value / 100) * 1.5; valFriction.innerText = e.target.value; };
timescaleInput.oninput = (e) => { timeScale = +e.target.value; valTimescale.innerText = timeScale.toFixed(1); };
scenarioSelect.onchange = (e) => { currentScenario = e.target.value; reset(); };
btnPause.onclick = () => { isPaused = !isPaused; btnPause.innerText = isPaused ? 'Retomar' : 'Pausar'; };
btnReset.onclick = reset;

// Interaction
canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (Math.hypot(mx - ball.x, my - ball.y) < ball.radius * 3) isDragging = true;
};
window.onmousemove = (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    ball.x = e.clientX - rect.left;
    ball.y = e.clientY - rect.top;
    ball.vx = 0; ball.vy = 0;
    ball.thermalEnergy = 0;
};
window.onmouseup = () => isDragging = false;

// Statistics & Energy
let stats = { ke: 0, pe: 0, te: 0, maxTe: 2000 };

function update() {
    if (!isPaused && !isDragging) {
        let actualTimeScale = timeScale * (checkSlow.checked ? 0.25 : 1.0);
        const dt = (1/60) * actualTimeScale;
        const g_px = ball.gravity * pixelsToMeters;
        const steps = 12;
        const sdt = dt / steps;

        for (let i = 0; i < steps; i++) {
            ball.vy += g_px * sdt;
            
            // Move
            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;

            // X constraints
            if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.2; }
            if (ball.x > width - ball.radius) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.2; }

            const groundY = getSurfaceY(ball.x);
            if (ball.y + ball.radius > groundY) {
                const norm = getSurfaceNormal(ball.x);
                ball.y = groundY - ball.radius;
                
                const v_dot_t = (ball.vx * norm.tx + ball.vy * norm.ty);
                const prevSpeed = Math.abs(v_dot_t);
                
                const lossRatio = ball.friction * 4 * sdt;
                ball.vx = v_dot_t * norm.tx * (1 - lossRatio);
                ball.vy = v_dot_t * norm.ty * (1 - lossRatio);
                
                // Track thermal energy loss for PhET graph
                const currentSpeed = Math.abs(v_dot_t * (1 - lossRatio));
                const dEnergy = 0.5 * ball.mass * (Math.pow(prevSpeed/pixelsToMeters, 2) - Math.pow(currentSpeed/pixelsToMeters, 2));
                ball.thermalEnergy += Math.max(0, dEnergy);

                if (Math.abs(ball.vx) < 0.2 && Math.abs(ball.vy) < 0.2) { ball.vx = 0; ball.vy = 0; }
            }
            if (ball.y > height - ball.radius) { ball.y = height - ball.radius; ball.vy *= -0.2; }
        }
    }

    // Energy Calculation
    const h = Math.max(0, (height - 50 - ball.radius - ball.y) / pixelsToMeters);
    const speed = Math.hypot(ball.vx, ball.vy) / pixelsToMeters;
    
    stats.pe = ball.mass * ball.gravity * h;
    stats.ke = 0.5 * ball.mass * speed * speed;
    stats.te = stats.pe + stats.ke + ball.thermalEnergy;
    
    if (stats.te > stats.maxTe) stats.maxTe = stats.te;

    keLabel.innerText = stats.ke.toFixed(1) + ' J';
    peLabel.innerText = stats.pe.toFixed(1) + ' J';
    teLabel.innerText = stats.te.toFixed(1) + ' J';
    
    keBar.style.width = (stats.ke / stats.te * 100) + '%';
    peBar.style.width = (stats.pe / stats.te * 100) + '%';
    teBar.style.width = '100%';

    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0, 0, width, height);

    if (checkGrid.checked) drawGrid();

    // Draw Surface (PhET-style Track)
    ctx.beginPath();
    ctx.strokeStyle = '#4e54c8';
    ctx.lineWidth = 10;
    ctx.lineCap = 'round';
    for (let x = 0; x <= width; x += 2) {
        const y = getSurfaceY(x);
        x === 0 ? ctx.moveTo(x, y + 4) : ctx.lineTo(x, y + 4);
    }
    ctx.stroke();
    
    ctx.beginPath();
    ctx.strokeStyle = '#8f94fb';
    ctx.lineWidth = 4;
    for (let x = 0; x <= width; x += 2) {
        const y = getSurfaceY(x);
        x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Draw Ball (The Skater replacement)
    ctx.shadowBlur = 15; ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;

    // PhET Features:
    if (checkPie.checked) drawPieChart();
    if (checkBar.checked) drawPhETBarChart();
}

function drawGrid() {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < width; x += 50) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }
    for (let y = height; y > 0; y -= 50) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        // Meters label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.font = '10px Inter';
        ctx.fillText(`${(height - 50 - y) / pixelsToMeters}m`, 5, y - 5);
    }
}

function drawPieChart() {
    const r = 35;
    const px = ball.x;
    const py = ball.y - 60;
    const total = Math.max(0.1, stats.ke + stats.pe + ball.thermalEnergy);
    
    let startAngle = -Math.PI / 2;
    
    const drawSlice = (energy, color) => {
        const slice = (energy / total) * Math.PI * 2;
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.arc(px, py, r, startAngle, startAngle + slice);
        ctx.closePath();
        ctx.fill();
        startAngle += slice;
    };

    ctx.globalAlpha = 0.8;
    drawSlice(stats.ke, Colors.ke);
    drawSlice(stats.pe, Colors.pe);
    drawSlice(ball.thermalEnergy, Colors.thermal);
    ctx.globalAlpha = 1.0;
    
    ctx.strokeStyle = 'white';
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI * 2); ctx.stroke();
}

function drawPhETBarChart() {
    const x = 30, y = 50, w = 150, h = 180;
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.roundRect ? ctx.fillRoundedRect(x, y, w, h, 10) : ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(x, y, w, h);

    const barW = 20;
    const maxVal = Math.max(stats.maxTe, 100);
    
    const drawBar = (val, color, idx, label) => {
        const bh = (val / maxVal) * (h - 40);
        ctx.fillStyle = color;
        ctx.fillRect(x + 15 + idx * 32, y + h - 25 - bh, barW, bh);
        ctx.fillStyle = 'white';
        ctx.font = '9px Inter';
        ctx.fillText(label, x + 15 + idx * 32, y + h - 10);
    };

    drawBar(stats.ke, Colors.ke, 0, 'Cin');
    drawBar(stats.pe, Colors.pe, 1, 'Pot');
    drawBar(ball.thermalEnergy, Colors.thermal, 2, 'Tér');
    drawBar(stats.te, Colors.te, 3, 'Tot');
}

update();
