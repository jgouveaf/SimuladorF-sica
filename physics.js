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
let width = 800, height = 600;
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
        const margin = 100;
        const startY = 150, endY = height - 100;
        if (x < margin) return startY;
        if (x > width - margin) return endY;
        return startY + (x - margin) * (endY - startY) / (width - margin * 2);
    }
    
    if (currentScenario === 'parabola') {
        // TRUE BOWL (U SHAPE ∪)
        // Lowest point at center Y = height - 100
        // Highest points at edges Y = 100
        const centerX = width / 2;
        const bottomY = height - 100;
        const depth = 400; // Total height of the U
        const bowlWidth = (width - 200) / 2;
        const k = depth / Math.pow(bowlWidth, 2);
        
        let dy = k * Math.pow(x - centerX, 2);
        return bottomY - Math.min(depth + 50, dy);
    }
    
    if (currentScenario === 'loop') {
        return height/2 + 100 * Math.sin(x * 0.015) + 120;
    }
    return height - ball.radius;
};

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
        ball.x = 150; ball.y = getSurfaceY(150) - ball.radius - 10;
    } else {
        ball.x = 150; ball.y = 150;
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
        const steps = 12;
        const sdt = dt / steps;

        for (let i = 0; i < steps; i++) {
            ball.vy += g_px * sdt;
            ball.vx *= (1 - ball.friction * sdt);
            ball.vy *= (1 - ball.friction * sdt);

            ball.x += ball.vx * sdt;
            ball.y += ball.vy * sdt;

            // X constraints
            if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx) * 0.3; }
            if (ball.x > width - ball.radius) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx) * 0.3; }

            const groundY = getSurfaceY(ball.x);
            if (ball.y + ball.radius > groundY) {
                const norm = getSurfaceNormal(ball.x);
                ball.y = groundY - ball.radius;
                const v_dot_t = (ball.vx * norm.tx + ball.vy * norm.ty);
                const surfFric = 1 - (ball.friction * 4 * sdt); 
                ball.vx = v_dot_t * norm.tx * surfFric;
                ball.vy = v_dot_t * norm.ty * surfFric;
                if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
            }
            if (ball.y > height - ball.radius) { ball.y = height - ball.radius; ball.vy *= -0.3; }
        }
    }

    // Displays
    const h = Math.max(0, (height - ball.radius - ball.y) / pixelsToMeters);
    const speed = Math.hypot(ball.vx, ball.vy) / pixelsToMeters;
    const PE = ball.mass * ball.gravity * h;
    const KE = 0.5 * ball.mass * speed * speed;
    const TE = PE + KE;

    keLabel.innerText = KE.toFixed(1) + ' J';
    peLabel.innerText = PE.toFixed(1) + ' J';
    teLabel.innerText = TE.toFixed(1) + ' J';
    const base = Math.max(TE, 2000);
    keBar.style.width = (KE / base) * 100 + '%';
    peBar.style.width = (PE / base) * 100 + '%';
    teBar.style.width = '100%';

    render();
    requestAnimationFrame(update);
}

function render() {
    ctx.clearRect(0, 0, width, height);

    // Draw Surface
    ctx.beginPath();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 5;
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

    // Ball
    ctx.shadowBlur = 20; ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
}

// Initial resize
resize();
update();
