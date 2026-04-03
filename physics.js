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

const valMass = getElem('val-mass');
const valGravity = getElem('val-gravity');
const valFriction = getElem('val-friction');
const valTimescale = getElem('val-timescale');

const keLabel = getElem('val-ke'), peLabel = getElem('val-pe'), teLabel = getElem('val-te');
const keBar = getElem('bar-ke'), peBar = getElem('bar-pe'), teBar = getElem('bar-te');

const btnPause = getElem('btn-pause'), btnReset = getElem('btn-reset');

// State
let width, height;
const pixelsToMeters = 60;
let isPaused = false, isDragging = false;
let timeScale = 1.0;
let currentScenario = 'free';

let ball = {
    x: 0, y: 0, radius: 15,
    vx: 0, vy: 0,
    mass: 10, gravity: 9.8, friction: 0.05,
    color: '#6366f1'
};

// --- Ramps Definition ---
const getSurfaceY = (x) => {
    if (currentScenario === 'free') return height - ball.radius;
    
    if (currentScenario === 'ramp') {
        const startX = 50, endX = width - 50;
        const startY = 150, endY = height - 50;
        if (x < startX) return startY;
        if (x > endX) return endY;
        return startY + (x - startX) * (endY - startY) / (endX - startX);
    }
    
    if (currentScenario === 'parabola') {
        const centerX = width / 2;
        const baseY = height - 50;
        return baseY - 300 + 0.002 * Math.pow(x - centerX, 2);
    }
    
    if (currentScenario === 'loop') {
        return height/2 + 100 * Math.sin(x * 0.015) + 120;
    }
    return height - ball.radius;
};

// Physics Helpers
function getSurfaceNormal(x) {
    const y1 = getSurfaceY(x - 0.5);
    const y2 = getSurfaceY(x + 0.5);
    const dx = 1.0;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    return { nx: -dy / len, ny: dx / len, tx: dx / len, ty: dy / len };
}

function reset() {
    if (currentScenario === 'free') {
        ball.x = width / 2; ball.y = 100;
    } else {
        ball.x = 80; ball.y = getSurfaceY(80) - ball.radius - 20;
    }
    ball.vx = 0; ball.vy = 0;
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
frictionInput.oninput = (e) => { ball.friction = (+e.target.value / 100) * 2; valFriction.innerText = e.target.value; };
timescaleInput.oninput = (e) => { timeScale = +e.target.value; valTimescale.innerText = timeScale.toFixed(1); };
scenarioSelect.onchange = (e) => { currentScenario = e.target.value; reset(); };
btnPause.onclick = () => { isPaused = !isPaused; btnPause.innerText = isPaused ? 'Retomar' : 'Pausar'; };
btnReset.onclick = reset;

// Interaction
canvas.onmousedown = (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (Math.hypot(mx - ball.x, my - ball.y) < ball.radius * 3) {
        isDragging = true;
        isPaused = false; // Resume on drag
    }
};
window.onmousemove = (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    ball.x = e.clientX - rect.left;
    ball.y = e.clientY - rect.top;
    ball.vx = 0; ball.vy = 0;
};
window.onmouseup = () => isDragging = false;

// Physics Loop
function update() {
    if (!isPaused && !isDragging) {
        const dt = (1/60) * timeScale;
        const g_px = ball.gravity * pixelsToMeters;
        
        // Sub-stepping for stability
        const steps = 8;
        const sdt = dt / steps;

        for (let i = 0; i < steps; i++) {
            // Apply Gravity
            ball.vy += g_px * sdt;
            
            // Apply Friction (Air)
            ball.vx *= (1 - ball.friction * sdt);
            ball.vy *= (1 - ball.friction * sdt);

            // Move
            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;

            // Collision Resolution
            const groundY = getSurfaceY(ball.x);
            if (ball.y + ball.radius > groundY) {
                // Ball is penetrating ground
                const norm = getSurfaceNormal(ball.x);
                
                // 1. Position correction
                ball.y = groundY - ball.radius;

                // 2. Velocity resolution (Slide along tangent)
                // Project velocity onto tangent: V_new = (V dot T) * T
                const v_dot_t = (ball.vx * norm.tx + ball.vy * norm.ty);
                
                // Surface Friction
                const surfaceFriction = 1 - (ball.friction * 5 * sdt); 
                
                ball.vx = v_dot_t * norm.tx * surfaceFriction;
                ball.vy = v_dot_t * norm.ty * surfaceFriction;
                
                // Add tiny jump prevention
                if (Math.abs(ball.vy) < 1) ball.vy = 0;
            }

            // Wall Bounce
            if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.5; }
            if (ball.x > width - ball.radius) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.5; }
            if (ball.y > height - ball.radius) { ball.y = height - ball.radius; ball.vy = -Math.abs(ball.vy) * 0.5; }
        }
    }

    // Energy
    const h = Math.max(0, (height - ball.radius - ball.y) / pixelsToMeters);
    const speed = Math.hypot(ball.vx, ball.vy) / pixelsToMeters;
    const PE = ball.mass * ball.gravity * h;
    const KE = 0.5 * ball.mass * speed * speed;
    const TE = PE + KE;

    keLabel.innerText = KE.toFixed(1) + ' J';
    peLabel.innerText = PE.toFixed(1) + ' J';
    teLabel.innerText = TE.toFixed(1) + ' J';
    
    // Progress bars (relative to total energy at start usually, but let's use 5000 as base)
    const baseScale = Math.max(TE, 2000);
    keBar.style.width = Math.min(100, (KE / baseScale) * 100) + '%';
    peBar.style.width = Math.min(100, (PE / baseScale) * 100) + '%';
    teBar.style.width = '100%';

    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw Surface
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 4;
    for (let x = 0; x <= width; x += 1) {
        const y = getSurfaceY(x);
        if (x === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Fill area below surface
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fill();

    // Draw Ball
    ctx.shadowBlur = 20; ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
}

update();
