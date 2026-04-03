const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('sim-container');

// Elements
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

// Constants & State
let width, height;
const pixelsToMeters = 50; 
let isPaused = false;
let isDragging = false;
let timeScale = 1.0;
let currentScenario = 'free';

let ball = {
    x: 0,
    y: 0,
    radius: 15,
    vx: 0,
    vy: 0,
    mass: 10,
    gravity: 9.8,
    friction: 0,
    color: '#6366f1'
};

// Scenario Definitions
const scenarios = {
    free: (x) => null, // No constraint
    ramp: (x) => {
        // Simple ramp from top left to bottom right
        const slope = (height - 100) / (width - 100);
        if (x < 50) return 100;
        if (x > width - 50) return height - 50;
        return 100 + (x - 50) * slope;
    },
    parabola: (x) => {
        // U shape
        const centerX = width / 2;
        const baseY = height - 100;
        const k = 0.002;
        return baseY - k * Math.pow(x - centerX, 2) * -1; // Wait, let's make it a bowl
    },
    loop: (x) => {
        // A loop-the-loop shape
        // This is more complex to define as dynamic y=f(x) for simplicity, 
        // let's use a composite path for "Looping"
        return null; // I'll handle special logic or more paths
    }
};

// Re-defining parabola for a better bowl
const getSurfaceY = (x) => {
    if (currentScenario === 'free') return null;
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
        const k = 0.0015;
        const y = baseY - (baseY - 100) * Math.exp(-k * Math.pow(x - centerX, 2));
        // Simple bowl: 
        return baseY - 300 + 0.002 * Math.pow(x - centerX, 2);
    }
    if (currentScenario === 'loop') {
        // Simple wave ramp
        return height/2 + 100 * Math.sin(x * 0.01) + 100;
    }
    return null;
};

// Normal and Tangent vectors for the surface
function getSurfaceNormal(x) {
    const delta = 1;
    const y1 = getSurfaceY(x - delta);
    const y2 = getSurfaceY(x + delta);
    if (y1 === null || y2 === null) return null;
    
    const dx = 2 * delta;
    const dy = y2 - y1;
    const length = Math.hypot(dx, dy);
    
    // Tangent: (dx, dy)
    // Normal (perpendicular): (-dy, dx)
    return {
        tx: dx / length,
        ty: dy / length,
        nx: -dy / length,
        ny: dx / length
    };
}

// Initialization
function reset() {
    if (currentScenario === 'free') {
        ball.x = width / 2;
        ball.y = 100;
    } else {
        ball.x = 60;
        ball.y = getSurfaceY(60) - ball.radius;
    }
    ball.vx = 0;
    ball.vy = 0;
}

function resize() {
    width = container.clientWidth;
    height = container.clientHeight;
    canvas.width = width;
    canvas.height = height;
    if (ball.x === 0 && ball.y === 0) reset();
}

window.addEventListener('resize', resize);
resize();

// Inputs
massInput.addEventListener('input', (e) => {
    ball.mass = parseFloat(e.target.value);
    valMass.textContent = ball.mass;
});

gravityInput.addEventListener('input', (e) => {
    ball.gravity = parseFloat(e.target.value);
    valGravity.textContent = ball.gravity;
});

frictionInput.addEventListener('input', (e) => {
    ball.friction = parseFloat(e.target.value) / 100;
    valFriction.textContent = e.target.value;
});

timeScaleInput.addEventListener('input', (e) => {
    timeScale = parseFloat(e.target.value);
    valTimeScale.textContent = timeScale.toFixed(1);
});

scenarioSelect.addEventListener('change', (e) => {
    currentScenario = e.target.value;
    reset();
});

btnPause.addEventListener('click', () => {
    isPaused = !isPaused;
    btnPause.textContent = isPaused ? 'Retomar' : 'Pausar';
});

btnReset.addEventListener('click', reset);

// Interaction
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const dist = Math.hypot(mouseX - ball.x, mouseY - ball.y);
    if (dist < ball.radius * 2) {
        isDragging = true;
    }
});

window.addEventListener('mousemove', (e) => {
    if (isDragging) {
        const rect = canvas.getBoundingClientRect();
        ball.x = e.clientX - rect.left;
        ball.y = e.clientY - rect.top;
        ball.vx = 0;
        ball.vy = 0;
        
        // Boundaries
        if (ball.x < ball.radius) ball.x = ball.radius;
        if (ball.x > width - ball.radius) ball.x = width - ball.radius;
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// Physics and Animation
function update() {
    if (!isPaused && !isDragging) {
        const dt = (1/60) * timeScale;
        
        // Gravity
        let ax = 0;
        let ay = ball.gravity * pixelsToMeters;

        const surfaceY = getSurfaceY(ball.x);
        const onSurface = surfaceY !== null && (ball.y + ball.radius >= surfaceY - 2);

        if (onSurface && currentScenario !== 'free') {
            const vec = getSurfaceNormal(ball.x);
            
            // Project gravity onto tangent
            // accel_tangent = g * sin(theta) = g_vector dot tangent_vector
            const gDotT = (ax * vec.tx + ay * vec.ty);
            
            // Motion along surface
            let velocityParallel = (ball.vx * vec.tx + ball.vy * vec.ty);
            
            // Apply acceleration and friction
            velocityParallel += gDotT * dt;
            velocityParallel *= (1 - ball.friction);

            ball.vx = velocityParallel * vec.tx;
            ball.vy = velocityParallel * vec.ty;
            
            // Snap to surface
            ball.y = surfaceY - ball.radius;
        } else {
            // Free fall
            ball.vy += ay * dt;
            ball.vx *= (1 - ball.friction);
            ball.vy *= (1 - ball.friction);
        }

        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Ground Collision
        if (ball.y + ball.radius > height) {
            ball.y = height - ball.radius;
            ball.vy *= -0.6; 
            if (Math.abs(ball.vy) < 10) ball.vy = 0;
        }
        
        // Side boundaries
        if (ball.x < ball.radius || ball.x > width - ball.radius) {
            ball.vx *= -0.6;
            ball.x = ball.x < ball.radius ? ball.radius : width - ball.radius;
        }
    }

    // Energy Calculations
    const h = (height - ball.radius - ball.y) / pixelsToMeters;
    const velocity = Math.hypot(ball.vx, ball.vy) / pixelsToMeters; 
    
    const PE = ball.mass * ball.gravity * Math.max(0, h);
    const KE = 0.5 * ball.mass * velocity * velocity;
    const TE = PE + KE;

    // Display
    keLabel.textContent = `${KE.toFixed(1)} J`;
    peLabel.textContent = `${PE.toFixed(1)} J`;
    teLabel.textContent = `${TE.toFixed(1)} J`;

    const maxEnergyForDisplay = 5000;
    keBar.style.width = `${Math.min(100, (KE / (TE || 1)) * 100)}%`;
    peBar.style.width = `${Math.min(100, (PE / (TE || 1)) * 100)}%`;
    teBar.style.width = '100%';

    draw();
    requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw Surface
    if (currentScenario !== 'free') {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        for (let x = 0; x <= width; x += 5) {
            const y = getSurfaceY(x);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.stroke();
        ctx.lineWidth = 1;
    } else {
        // Draw floor grid/line
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.moveTo(0, height - ball.radius);
        ctx.lineTo(width, height - ball.radius);
        ctx.stroke();
    }

    // Draw ball with glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
}

update();
