const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('sim-container');

// Elements
const massInput = document.getElementById('mass');
const gravityInput = document.getElementById('gravity');
const frictionInput = document.getElementById('friction');
const valMass = document.getElementById('val-mass');
const valGravity = document.getElementById('val-gravity');
const valFriction = document.getElementById('val-friction');

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
const pixelsToMeters = 50; // 50 pixels = 1 meter
let isPaused = false;
let isDragging = false;

let ball = {
    x: 0,
    y: 0,
    radius: 20,
    vx: 0,
    vy: 0,
    mass: 10,
    gravity: 9.8,
    friction: 0,
    color: '#6366f1'
};

// Initialization
function reset() {
    ball.x = width / 2;
    ball.y = 100;
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
        if (ball.y < ball.radius) ball.y = ball.radius;
        if (ball.y > height - ball.radius) ball.y = height - ball.radius;
    }
});

window.addEventListener('mouseup', () => {
    isDragging = false;
});

// Physics and Animation
function update() {
    if (!isPaused && !isDragging) {
        // Simple Euler Integration
        ball.vy += ball.gravity / 60; // Approximate 60fps
        
        // Air friction
        ball.vx *= (1 - ball.friction);
        ball.vy *= (1 - ball.friction);
        
        ball.y += ball.vy;
        ball.x += ball.vx;

        // Collision with ground (height - radius)
        if (ball.y + ball.radius > height) {
            ball.y = height - ball.radius;
            ball.vy *= -0.7; // Bounce factor
            if (Math.abs(ball.vy) < 0.5) ball.vy = 0;
        }
        
        // Side boundaries
        if (ball.x < ball.radius || ball.x > width - ball.radius) {
            ball.vx *= -0.7;
            ball.x = ball.x < ball.radius ? ball.radius : width - ball.radius;
        }
    }

    // Energy Calculations
    // Height h: distance from ground in meters
    const h = (height - ball.radius - ball.y) / pixelsToMeters;
    const velocity = Math.hypot(ball.vx, ball.vy) / pixelsToMeters * 60; // m/s
    
    const PE = ball.mass * ball.gravity * Math.max(0, h);
    const KE = 0.5 * ball.mass * velocity * velocity;
    const TE = PE + KE;

    // Display
    keLabel.textContent = `${KE.toFixed(1)} J`;
    peLabel.textContent = `${PE.toFixed(1)} J`;
    teLabel.textContent = `${TE.toFixed(1)} J`;

    // Bars (relative to an arbitrary max for visual)
    const maxEnergy = 10000; // Let's use mass=100, gravity=30, height=10 as max reference
    keBar.style.width = `${Math.min(100, (KE / (TE || 1)) * 100)}%`;
    peBar.style.width = `${Math.min(100, (PE / (TE || 1)) * 100)}%`;
    teBar.style.width = '100%';

    draw();
    requestAnimationFrame(update);
}

function draw() {
    ctx.clearRect(0, 0, width, height);

    // Draw floor grid/line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(0, height - ball.radius);
    ctx.lineTo(width, height - ball.radius);
    ctx.stroke();

    // Draw ball with glow
    ctx.shadowBlur = 15;
    ctx.shadowColor = ball.color;
    ctx.fillStyle = ball.color;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Draw velocity vector (optional, for fun)
    if (Math.abs(ball.vy) > 0.1 || Math.abs(ball.vx) > 0.1) {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.beginPath();
        ctx.moveTo(ball.x, ball.y);
        ctx.lineTo(ball.x + ball.vx * 2, ball.y + ball.vy * 2);
        ctx.stroke();
    }
}

update();
