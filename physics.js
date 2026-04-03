const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('sim-container');

// UI Elements
const massInput = document.getElementById('mass');
const gravityInput = document.getElementById('gravity');
const frictionInput = document.getElementById('friction');
const timeScaleInput = document.getElementById('timescale');
const scenarioSelect = document.getElementById('scenario');

const valMass = document.getElementById('val-mass');
const valGravity = document.getElementById('val-gravity');
const valFriction = document.getElementById('val-friction');
const valTimeScale = document.getElementById('val-timescale');

const keLabel = document.getElementById('val-ke');
const peLabel = document.getElementById('val-pe');
const teLabel = document.getElementById('val-te');
const keBar = document.getElementById('bar-ke');
const peBar = document.getElementById('bar-pe');
const teBar = document.getElementById('bar-te');

const btnPause = document.getElementById('btn-pause');
const btnReset = document.getElementById('btn-reset');

// State
let width, height;
const pixelsToMeters = 50;
let isPaused = false;
let isDragging = false;
let timeScale = 1.0;
let currentScenario = 'free';

let ball = {
    x: 100,
    y: 100,
    radius: 12,
    vx: 0,
    vy: 0,
    mass: 10,
    gravity: 9.8,
    friction: 0.01,
    color: '#6366f1'
};

// --- Models/Ramps Definition ---
const Scenarios = {
    free: {
        getY: (x) => null,
        start: () => ({ x: width / 2, y: 100 })
    },
    ramp: {
        getY: (x) => {
            const startX = 50, endX = width - 50;
            const startY = 100, endY = height - 50;
            if (x <= startX) return startY;
            if (x >= endX) return endY;
            return startY + (x - startX) * (endY - startY) / (endX - startX);
        },
        start: () => ({ x: 60, y: 100 - 12 })
    },
    parabola: {
        getY: (x) => {
            const centerX = width / 2;
            const baseY = height - 50;
            const depth = height - 150;
            const widthScale = 0.002;
            return baseY - depth * Math.exp(-widthScale * Math.pow(x - centerX, 2));
        },
        start: () => ({ x: 100, y: 130 })
    },
    bowl: {
        getY: (x) => {
            const centerX = width / 2;
            const baseY = height - 50;
            const radius = Math.min(width, height) * 0.4;
            const dx = x - centerX;
            if (Math.abs(dx) > radius) return null;
            return baseY - Math.sqrt(radius * radius - dx * dx);
        },
        start: () => ({ x: width / 2 - 100, y: 300 })
    }
};

// Help helper for bowl/loop logic
function getSurfaceY(x) {
    if (currentScenario === 'free') return null;
    if (currentScenario === 'ramp') return Scenarios.ramp.getY(x);
    if (currentScenario === 'parabola') return Scenarios.parabola.getY(x);
    
    // Custom bowl mapping for more models
    if (currentScenario === 'loop') {
        // Wave/Terrain
        return height - 150 + Math.sin(x * 0.01) * 50 + Math.cos(x * 0.005) * 30;
    }
    return null;
}

// Get numeric derivative for slope
function getSlopeInfo(x) {
    const y0 = getSurfaceY(x);
    if (y0 === null) return null;
    
    const dx = 0.1;
    const y1 = getSurfaceY(x + dx);
    const dy = y1 - y0;
    const angle = Math.atan2(dy, dx);
    
    return {
        y: y0,
        angle: angle,
        tx: Math.cos(angle),
        ty: Math.sin(angle),
        nx: -Math.sin(angle),
        ny: Math.cos(angle)
    };
}

function reset() {
    const pos = Scenarios[currentScenario]?.start?.() || { x: 100, y: 100 };
    ball.x = pos.x;
    ball.y = pos.y;
    ball.vx = 0;
    ball.vy = 0;
}

function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    reset();
}

window.addEventListener('resize', resize);

// UI Listeners
massInput.addEventListener('input', (e) => { ball.mass = +e.target.value; valMass.textContent = ball.mass; });
gravityInput.addEventListener('input', (e) => { ball.gravity = +e.target.value; valGravity.textContent = ball.gravity; });
frictionInput.addEventListener('input', (e) => { ball.friction = +e.target.value / 100; valFriction.textContent = e.target.value; });
timeScaleInput.addEventListener('input', (e) => { timeScale = +e.target.value; valTimeScale.textContent = timeScale.toFixed(1); });
scenarioSelect.addEventListener('change', (e) => { currentScenario = e.target.value; reset(); });
btnPause.addEventListener('click', () => { isPaused = !isPaused; btnPause.textContent = isPaused ? 'Retomar' : 'Pausar'; });
btnReset.addEventListener('click', reset);

// Dragging
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    if (Math.hypot(mx - ball.x, my - ball.y) < ball.radius * 2) isDragging = true;
});
window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    const rect = canvas.getBoundingClientRect();
    ball.x = e.clientX - rect.left;
    ball.y = e.clientY - rect.top;
    ball.vx = 0; ball.vy = 0;
    if (ball.x < ball.radius) ball.x = ball.radius;
    if (ball.x > width - ball.radius) ball.x = width - ball.radius;
});
window.addEventListener('mouseup', () => isDragging = false);

// Init
resize();

// Loop
function update() {
    if (!isPaused && !isDragging) {
        const dt = (1/60) * timeScale * 1.5; // Slightly faster base speed
        const g_px = ball.gravity * pixelsToMeters;
        
        const surface = getSlopeInfo(ball.x);
        const onSurface = surface && (ball.y + ball.radius >= surface.y - 4);

        if (onSurface) {
            // Apply physics on slope
            // a = g * sin(theta) - friction
            const gTangent = g_px * surface.ty;
            let v = (ball.vx * surface.tx + ball.vy * surface.ty);
            
            v += gTangent * dt;
            v *= (1 - ball.friction); // Simple friction

            ball.vx = v * surface.tx;
            ball.vy = v * surface.ty;
            ball.y = surface.y - ball.radius;
        } else {
            // Air physics
            ball.vy += g_px * dt;
            ball.vx *= (1 - ball.friction * 0.1);
            ball.vy *= (1 - ball.friction * 0.1);
            
            ball.x += ball.vx * dt;
            ball.y += ball.vy * dt;
            
            // Re-check collision with surface
            const s2 = getSlopeInfo(ball.x);
            if (s2 && ball.y + ball.radius >= s2.y) {
                ball.y = s2.y - ball.radius;
                // Reflect or slide? Let's project velocity to tangent
                const vMag = (ball.vx * s2.tx + ball.vy * s2.ty);
                ball.vx = vMag * s2.tx;
                ball.vy = vMag * s2.ty;
                // Bounce reduction
                ball.vx *= 0.8;
                ball.vy *= 0.8;
            }
        }

        // Walls
        if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx *= -0.5; }
        if (ball.x > width - ball.radius) { ball.x = width - ball.radius; ball.vx *= -0.5; }
        if (ball.y > height - ball.radius) { ball.y = height - ball.radius; ball.vy *= -0.5; }
    }

    // Stats
    const h = Math.max(0, (height - ball.radius - ball.y) / pixelsToMeters);
    const vMeters = Math.hypot(ball.vx, ball.vy) / pixelsToMeters;
    const PE = ball.mass * ball.gravity * h;
    const KE = 0.5 * ball.mass * vMeters * vMeters;
    const TE = PE + KE;

    keLabel.textContent = `${KE.toFixed(1)} J`;
    peLabel.textContent = `${PE.toFixed(1)} J`;
    teLabel.textContent = `${TE.toFixed(1)} J`;
    keBar.style.width = `${Math.min(100, (KE / 5000) * 100)}%`;
    peBar.style.width = `${Math.min(100, (PE / 5000) * 100)}%`;
    teBar.style.width = `${Math.min(100, (TE / 5000) * 100)}%`;

    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw Ramp (Visual)
    if (currentScenario !== 'free') {
        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(99, 102, 241, 0.2)');
        gradient.addColorStop(1, 'rgba(239, 68, 68, 0.2)');
        
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 6;
        ctx.lineJoin = 'round';
        ctx.beginPath();
        let pathStarted = false;
        for (let x = 0; x <= width; x += 2) {
            const y = getSurfaceY(x);
            if (y === null) {
                pathStarted = false;
                continue;
            }
            if (!pathStarted) {
                ctx.moveTo(x, y);
                pathStarted = true;
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();

        // Under-ramp shadow/fill
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fill();
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.moveTo(0, height-ball.radius); ctx.lineTo(width, height-ball.radius); ctx.stroke();
    }

    // Ball
    ctx.shadowBlur = 20; ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
}

update();
