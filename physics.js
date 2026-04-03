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
    const margin = 80;
    const safeWidth = width - margin * 2;
    
    if (currentScenario === 'free') return height - ball.radius;
    
    if (currentScenario === 'ramp') {
        const startY = 150, endY = height - 80;
        if (x < margin) return startY;
        if (x > width - margin) return endY;
        return startY + (x - margin) * (endY - startY) / safeWidth;
    }
    
    if (currentScenario === 'parabola') {
        // Corrected Bowl (∪ shape)
        const centerX = width / 2;
        const depth = 350;
        const k = 0.002;
        // height - (offset + growth)
        return (height - 80) - Math.max(0, depth - k * Math.pow(x - centerX, 2));
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
    } else if (currentScenario === 'parabola') {
        ball.x = 100; ball.y = getSurfaceY(100) - ball.radius - 20;
    } else {
        ball.x = 100; ball.y = 100;
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
};
window.onmouseup = () => isDragging = false;

// Physics Loop
function update() {
    if (!isPaused && !isDragging) {
        const dt = (1/60) * timeScale;
        const g_px = ball.gravity * pixelsToMeters;
        const steps = 10;
        const sdt = dt / steps;

        for (let i = 0; i < steps; i++) {
            ball.vy += g_px * sdt;
            ball.vx *= (1 - ball.friction * sdt);
            ball.vy *= (1 - ball.friction * sdt);

            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;

            // Constrain X to prevent hitting walls in scenarios
            const margin = ball.radius + 10;
            if (ball.x < margin) { ball.x = margin; ball.vx = Math.abs(ball.vx) * 0.4; }
            if (ball.x > width - margin) { ball.x = width - margin; ball.vx = -Math.abs(ball.vx) * 0.4; }

            const groundY = getSurfaceY(ball.x);
            if (ball.y + ball.radius > groundY) {
                const norm = getSurfaceNormal(ball.x);
                ball.y = groundY - ball.radius;
                const v_dot_t = (ball.vx * norm.tx + ball.vy * norm.ty);
                const surfaceFriction = 1 - (ball.friction * 4 * sdt); 
                ball.vx = v_dot_t * norm.tx * surfaceFriction;
                ball.vy = v_dot_t * norm.ty * surfaceFriction;
                if (Math.abs(ball.vy) < 1) ball.vy = 0;
            }

            if (ball.y > height - ball.radius) { ball.y = height - ball.radius; ball.vy = -Math.abs(ball.vy) * 0.4; }
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
