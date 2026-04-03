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
    x: 0, y: 0, radius: 12,
    vx: 0, vy: 0,
    mass: 10, gravity: 9.8, friction: 0.01,
    color: '#6366f1'
};

// --- Ramps Definition ---
const getSurfaceY = (x) => {
    if (currentScenario === 'free') return null;
    
    if (currentScenario === 'ramp') {
        // Linear ramp from 100 to height-50
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
        return height/2 + 80 * Math.sin(x * 0.015) + 100;
    }
    return null;
};

// Physics Helpers
function getSurfaceInfo(x) {
    const y = getSurfaceY(x);
    if (y === null) return null;
    const dx = 0.5;
    const y2 = getSurfaceY(x + dx);
    const angle = Math.atan2(y2 - y, dx);
    return { y, angle, tx: Math.cos(angle), ty: Math.sin(angle) };
}

function reset() {
    if (currentScenario === 'free') {
        ball.x = width / 2; ball.y = 100;
    } else {
        ball.x = 60; ball.y = getSurfaceY(60) - ball.radius - 50;
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
frictionInput.oninput = (e) => { ball.friction = +e.target.value / 100; valFriction.innerText = e.target.value; };
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
        
        let subSteps = 5; // Use sub-stepping for stability
        let subDt = dt / subSteps;

        for (let s = 0; s < subSteps; s++) {
            const surface = getSurfaceInfo(ball.x);
            const onSurface = surface && (ball.y + ball.radius >= surface.y - 2);

            if (onSurface) {
                // Motion along the slope
                const tangentAccel = g_px * surface.ty;
                let v = (ball.vx * surface.tx + ball.vy * surface.ty);
                
                v += tangentAccel * subDt;
                v *= (1 - ball.friction * subDt * 10);
                
                ball.vx = v * surface.tx;
                ball.vy = v * surface.ty;
                ball.x += ball.vx * subDt;
                ball.y = surface.y - ball.radius;
            } else {
                // Free fall
                ball.vy += g_px * subDt;
                ball.vx *= (1 - ball.friction * subDt * 2);
                ball.vy *= (1 - ball.friction * subDt * 2);
                
                ball.x += ball.vx * subDt;
                ball.y += ball.vy * subDt;
                
                // Ground/Surface crash check
                const sAfter = getSurfaceInfo(ball.x);
                if (sAfter && ball.y + ball.radius >= sAfter.y) {
                    ball.y = sAfter.y - ball.radius;
                    // Project velocity to tangent
                    const vDotT = (ball.vx * sAfter.tx + ball.vy * sAfter.ty);
                    ball.vx = vDotT * sAfter.tx;
                    ball.vy = vDotT * sAfter.ty;
                }
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
    
    const displayMax = 10000;
    keBar.style.width = Math.min(100, (KE / displayMax) * 300) + '%';
    peBar.style.width = Math.min(100, (PE / displayMax) * 300) + '%';
    teBar.style.width = Math.min(100, (TE / displayMax) * 300) + '%';

    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw Surface
    if (currentScenario !== 'free') {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 4;
        let first = true;
        for (let x = 0; x <= width; x += 1) {
            const y = getSurfaceY(x);
            if (y === null) { first = true; continue; }
            if (first) { ctx.moveTo(x, y); first = false; }
            else ctx.lineTo(x, y);
        }
        ctx.stroke();

        // Under-ramp shadow
        ctx.lineTo(width, height);
        ctx.lineTo(0, height);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.fill();
    } else {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath(); ctx.moveTo(0, height - ball.radius); ctx.lineTo(width, height - ball.radius); ctx.stroke();
    }

    // Draw Ball
    ctx.shadowBlur = 20; ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
}

update();
