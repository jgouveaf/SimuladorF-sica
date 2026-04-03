console.log("FisicaSim PRO v3 - Carregada com sucesso");
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const container = document.getElementById('sim-container');

// UI Elements
const getElem = id => document.getElementById(id);
const massInput = getElem('mass'), gravityInput = getElem('gravity'), frictionInput = getElem('friction');
const timescaleInput = getElem('timescale'), scenarioSelect = getElem('scenario');
const checkBar = getElem('check-bar'), checkSlow = getElem('check-slow');
const valMass = getElem('val-mass'), valFriction = getElem('val-friction');
const valTeLabel = getElem('val-te');
const btnPause = getElem('btn-pause'), btnReset = getElem('btn-reset');

const Colors = { ke: '#22c55e', pe: '#3b82f6', te: '#f59e0b', thermal: '#ef4444' };

let width, height;
const pixelsToMeters = 60;
let isPaused = false, isDragging = false, timeScale = 1.0, currentScenario = 'free';

let ball = { x: 100, y: 100, radius: 18, vx: 0, vy: 0, mass: 10, gravity: 9.8, friction: 0.01, thermalEnergy: 0 };
let stats = { ke: 0, pe: 0, te: 0, maxTe: 2000 };

const getSurfaceY = (x) => {
    if (currentScenario === 'free') return height - 50;
    const margin = 100;
    if (currentScenario === 'ramp') {
        const startY = 150, endY = height - 100;
        if (x < margin) return startY;
        if (x > width - margin) return endY;
        return startY + (x - margin) * (endY - startY) / (width - margin * 2);
    }
    if (currentScenario === 'parabola') {
        const centerX = width / 2;
        const bottomY = height - 100, depth = 450, bowlWidth = (width - 150) / 2;
        const k = depth / Math.pow(bowlWidth, 2);
        // Standard Parabola formula for U shape: y = bottom - depth + k*(x-centerX)^2? No.
        // Let's use: Lowest point at centerX is bottomY. Edges at centerX +/- bowlWidth are bottomY - depth.
        // Actually Y decreases as we go UP. So:
        const xDist = x - centerX;
        return bottomY - Math.max(0, depth - k * Math.pow(xDist, 2)); // THIS WAS INVERTED (n shape)
    }
    if (currentScenario === 'loop') return height/2 + 120 * Math.sin(x * 0.012) + 120;
    return height - 50;
};

// CORRECTED PARABOLA FORMULA for U-SHAPE (∪)
const getParabolaY = (x) => {
    const centerX = width / 2;
    const bottomY = height - 50; // The bottom floor
    const topY = 150; // Top of the U
    const h = bottomY - topY;
    const halfWidth = (width - 150) / 2;
    const k = h / Math.pow(halfWidth, 2);
    const xDist = x - centerX;
    // Parabola opening upwards: y = topY + k*(x - centerX)^2? No.
    // In Canvas: Y increases DOWN. So lowest point (bottom) has LARGER Y.
    // So y = bottomY - k*xDist^2 is WRONG (it goes UP as xDist increases). Wait.
    // If k > 0, xDist^2 is positive. subtracting moves points UP.
    // So y = bottomY - (h - k*xDist^2) ? No.
    // We want y(centerX) = bottomY and y(centerX+hw) = topY.
    // y = bottomY - (h * (1 - Math.pow(xDist/halfWidth, - something?)))
    // Let's use: y = bottomY - h + k*xDist^2? No.
    // Let's use: y = bottomY - (h - k * Math.pow(xDist, 2)).
    // If xDist = 0: y = bottomY - h. (That's the TOP). 
    // Okay, simple: vertex is at bottomY. y = bottomY - (h * (1 - Math.pow(xDist / halfWidth, 2)))? No, that's n.
    // Correct U-shape (∪) in canvas coordinates:
    // P1=(centerX, bottomY), P2=(centerX-halfWidth, topY), P3=(centerX+halfWidth, topY)
    // Formula: y = topY + k*(x - (centerX-halfWidth))^2... No.
    // Formula relative to center: y = bottomY - (h - k * xDist^2)? No.
    // Simple: y = topY + k * (xDist)^2   where k = (bottomY - topY) / (halfWidth^2)? No, that's UPWARD curve.
    // In canvas, y=topY is TOP, y=bottomY is BOTTOM.
    // So we want y to start at topY, go DOWN to bottomY, then go UP to topY.
    // y = topY + (h * (1 - Math.pow(xDist / halfWidth, 2)))? No.
    // y = bottomY - h + k * xDist^2? No.
    // Let's use: y = bottomY - h * (1 - Math.pow(xDist/halfWidth, 2))? No.
    
    // THIS IS IT: y = bottomY - h + k * Math.pow(xDist, 2) is n shape.
    // We want ∪: y = topY + k * Math.pow(Math.abs(xDist) - halfWidth, 2)? No.
    
    // OKAY: Let's define the parabola by its vertex (bottomY) at centerX.
    // y = bottomY - h + h * Math.pow(xDist / halfWidth, 2)? No.
    // Try this: y = topY + h * Math.pow(xDist / halfWidth, 2)? No, that's top-center.
    
    // FINAL ANSWER:
    // vertex at (centerX, bottomY).
    // y = bottomY - k * xDist^2? No, that moves points UP.
    // y = bottomY + k * xDist^2? Yes! BUT we want to limit it.
    // But bottomY is the bottom of the screen. If we add k*xDist^2, it goes OFF-SCREEN.
    
    // SO: we want the vertex at TOP? No, vertex at BOTTOM.
    // y = bottomY - something.
    // y = bottomY - (depth - k * xDist^2) where k = depth / (halfWidth^2).
    // Let's test again:
    // xDist = 0: y = bottomY - depth. (TOP). This was INF-shape.
    
    // TO GET U-SHAPE (∪):
    // Vertex (lowest point) should be at CENTER.
    // Edges (highest point) at SIDES.
    // y_low = bottomY, y_high = topY.
    // y = topY + k * pow(xDist, 2)? No, that's vertex at TOP.
    // y = bottomY - h + k * pow(xDist, 2)? No.
    
    // SIMPLEST: y = topY + h * (1 - pow(xDist / halfWidth, 2))? No.
    
    // WAIT! In canvas: Top = 100, Bottom = 600.
    // We want y(centerX) = 600 (Bottom).
    // We want y(sides) = 100 (Top).
    // y = 100 + k * pow(xDist - halfWidth, 2)? No.
    // y = bottomY - (h * (1 - pow(xDist / halfWidth, 2))).
    // If xDist=0: y = bottomY - h = topY. (INVERTED).
    
    // IF WE WANT U: y = topY + (h * (1 - pow(xDist / halfWidth, 2))) ? No.
    // THE FORMULA IS: y = topY + k * pow(xDist, 2) where k makes it reach bottom. No.
    
    // LET'S JUST DO THIS: 
    // h_from_top = top_offset + k * (x - centerX)^2.
    // No.
    // Let's use a simple inverted-height approach.
    // height_from_bottom = depth * (1 - pow(xDist/halfWidth, 2)). (This is a hill).
    // curve = depth * pow(xDist/halfWidth, 2). (This is a valley!).
    // y = topY + (depth * (pow(xDist/halfWidth, 2))).
    // Let's check:
    // xDist = 0 (Center): y = topY + 0 = topY. (Still inverted if topY is the peak).
    
    // I NEED: y(center) = bottomY (large value), y(sides) = topY (small value).
    // y = bottomY - (h * (1 - pow(xDist / halfWidth, 2)))? No.
    // y = topY + h * (1 - pow(xDist / halfWidth, 2)).
    // xDist = 0: y = topY + h = bottomY. (YES! CENTER IS AT BOTTOM).
    // xDist = halfWidth: y = topY + 0 = topY. (YES! SIDES ARE AT TOP).
    // THIS IS THE ONE!
    return topY + h * (1 - Math.pow(xDist / halfWidth, 2));
};

function getBetterSurfaceY(x) {
    if (currentScenario === 'free') return height - 50;
    if (currentScenario === 'ramp') {
        const m = 100;
        if (x < m) return 150;
        if (x > width - m) return height - 100;
        return 150 + (x - m) * (height - 250) / (width - 2 * m);
    }
    if (currentScenario === 'parabola') {
        const centerX = width / 2;
        const bottomY = height - 100, topY = 150;
        const h = bottomY - topY, halfWidth = (width - 150) / 2;
        const xDist = Math.max(-halfWidth, Math.min(halfWidth, x - centerX));
        return topY + h * (1 - Math.pow(xDist / halfWidth, 2));
    }
    if (currentScenario === 'loop') return height/2 + 120 * Math.sin(x * 0.012) + 120;
    return height - 50;
}

function getNormal(x) {
    const y1 = getBetterSurfaceY(x - 0.5), y2 = getBetterSurfaceY(x + 0.5);
    const dx = 1, dy = y2 - y1, len = Math.hypot(dx, dy);
    return { nx: -dy/len, ny: dx/len, tx: dx/len, ty: dy/len };
}

function reset() {
    if (currentScenario === 'free') { ball.x = width/2; ball.y = 100; }
    else if (currentScenario === 'parabola') { ball.x = width/2 - (width-200)/2; ball.y = 130; }
    else { ball.x = 120; ball.y = getBetterSurfaceY(120) - ball.radius - 20; }
    ball.vx = 0; ball.vy = 0; ball.thermalEnergy = 0;
}

function resize() {
    width = container.clientWidth; height = container.clientHeight;
    canvas.width = width; canvas.height = height; reset();
}
window.addEventListener('resize', resize);
resize();

massInput.oninput = (e) => { ball.mass = +e.target.value; valMass.innerText = ball.mass; };
frictionInput.oninput = (e) => { ball.friction = (+e.target.value / 100) * 1.5; valFriction.innerText = e.target.value; };
timescaleInput.oninput = (e) => { timeScale = +e.target.value; getElem('val-timescale').innerText = timeScale.toFixed(1); };
scenarioSelect.onchange = (e) => { currentScenario = e.target.value; reset(); };
btnPause.onclick = () => { isPaused = !isPaused; btnPause.innerText = isPaused ? 'Retomar' : 'Pausar'; };
btnReset.onclick = reset;

canvas.onmousedown = (e) => {
    const r = canvas.getBoundingClientRect();
    if (Math.hypot(e.clientX - r.left - ball.x, e.clientY - r.top - ball.y) < ball.radius * 3) isDragging = true;
};
window.onmousemove = (e) => {
    if (!isDragging) return;
    const r = canvas.getBoundingClientRect();
    ball.x = e.clientX - r.left; ball.y = e.clientY - r.top;
    ball.vx = 0; ball.vy = 0; ball.thermalEnergy = 0;
};
window.onmouseup = () => isDragging = false;

function update() {
    if (!isPaused && !isDragging) {
        const dt = (1/60) * timeScale * (checkSlow.checked ? 0.25 : 1.0);
        const g = ball.gravity * pixelsToMeters, steps = 15, sdt = dt / steps;
        for (let i = 0; i < steps; i++) {
            ball.vy += g * sdt;
            ball.x += ball.vx * sdt; ball.y += ball.vy * sdt;
            if (ball.x < ball.radius) { ball.x = ball.radius; ball.vx = Math.abs(ball.vx)*0.5; }
            if (ball.x > width - ball.radius) { ball.x = width - ball.radius; ball.vx = -Math.abs(ball.vx)*0.5; }
            const gy = getBetterSurfaceY(ball.x);
            if (ball.y + ball.radius > gy) {
                const n = getNormal(ball.x); ball.y = gy - ball.radius;
                const vdt = (ball.vx * n.tx + ball.vy * n.ty);
                const ps = Math.abs(vdt), lr = ball.friction * 4 * sdt;
                ball.vx = vdt * n.tx * (1 - lr); ball.vy = vdt * n.ty * (1 - lr);
                ball.thermalEnergy += Math.max(0, 0.5 * ball.mass * (Math.pow(ps/60,2) - Math.pow(Math.abs(vdt*(1-lr))/60,2)));
            }
            // BOUNCE IN FREE FALL
            if (ball.y > height - ball.radius) {
                ball.y = height - ball.radius;
                if (Math.abs(ball.vy) > 20) ball.vy *= -0.75; // 75% Bounce
                else ball.vy = 0;
            }
        }
    }
    stats.pe = ball.mass * 9.8 * Math.max(0, (height - 50 - ball.radius - ball.y) / 60);
    stats.ke = 0.5 * ball.mass * Math.pow(Math.hypot(ball.vx, ball.vy)/60, 2);
    stats.te = stats.pe + stats.ke + ball.thermalEnergy;
    if (stats.te > stats.maxTe) stats.maxTe = stats.te;
    valTeLabel.innerText = stats.te.toFixed(1) + ' J';
    
    ctx.clearRect(0, 0, width, height);
    ctx.beginPath(); ctx.strokeStyle = '#312e81'; ctx.lineWidth = 12; ctx.lineCap = 'round';
    for (let x = 0; x <= width; x += 3) { const y = getBetterSurfaceY(x); x === 0 ? ctx.moveTo(x, y + 4) : ctx.lineTo(x, y + 4); }
    ctx.stroke();
    ctx.beginPath(); ctx.strokeStyle = '#4f46e5'; ctx.lineWidth = 5;
    for (let x = 0; x <= width; x += 3) { const y = getBetterSurfaceY(x); x === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y); }
    ctx.stroke();
    ctx.shadowBlur = 15; ctx.shadowColor = '#6366f1'; ctx.fillStyle = '#6366f1';
    ctx.beginPath(); ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI*2); ctx.fill();
    ctx.shadowBlur = 0;
    if (checkBar.checked) {
        const x = 25, y = 25, w = 150, h = 180;
        ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.roundRect ? (ctx.beginPath(), ctx.roundRect(x,y,w,h,12), ctx.fill()) : ctx.fillRect(x,y,w,h);
        const mv = Math.max(stats.maxTe, 100);
        const db = (v, c, i, l) => {
            const bh = (v/mv) * (h-40); ctx.fillStyle = c; ctx.fillRect(x+15+i*32, y+h-25-bh, 20, bh);
            ctx.fillStyle = 'white'; ctx.font = 'bold 9px Inter'; ctx.fillText(l, x+15+i*32, y+h-10);
        };
        db(stats.ke, Colors.ke, 0, 'Cin'); db(stats.pe, Colors.pe, 1, 'Pot'); db(ball.thermalEnergy, Colors.thermal, 2, 'Tér'); db(stats.te, Colors.te, 3, 'Tot');
    }
    requestAnimationFrame(update);
}
update();
