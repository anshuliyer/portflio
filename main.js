
// --- Sound Engine ---
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSound(type, freq, duration, vol = 0.1) {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(vol, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
}

const sounds = {
    blip: () => playSound('square', 880, 0.05, 0.05),
    tick: () => playSound('sine', 440, 0.03, 0.03),
    select: () => {
        playSound('square', 220, 0.1, 0.1);
        setTimeout(() => playSound('square', 440, 0.2, 0.1), 50);
    },
    boot: () => {
        const noise = audioCtx.createBufferSource();
        const bufferSize = audioCtx.sampleRate * 0.5;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
        noise.buffer = buffer;
        const filter = audioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1000;
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
        gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.5);
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(audioCtx.destination);
        noise.start();
        noise.stop(audioCtx.currentTime + 0.5);
    }
};

// --- Game Logic ---
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const loader = document.getElementById('loader');
const bootLog = document.getElementById('boot-log');
const bootMenu = document.getElementById('boot-menu');
const gameContainer = document.getElementById('game-container');
const interactionPrompt = document.getElementById('interaction-prompt');
const modal = document.getElementById('content-modal');
const modalBody = document.getElementById('modal-body');
const closeModal = document.querySelector('.close-modal');

let width, height;
let keys = {};
let mouse = { x: 0, y: 0 };
let player = { x: 1000, y: 1000, size: 20, speed: 4, color: '#4A9EFF', trail: [] };
const WORLD_SIZE = 2000;
let camera = { x: 0, y: 0 };
let gameState = 'boot';
let currentMenuIndex = 0;

const menuOptions = document.querySelectorAll('.menu-item');

const logMessages = [
    "[    0.000000] Booting ENGINEIYER.OS (v2.0.24) on ARMv8-A",
    "[    0.124510] SoC: ALLWINNER H616 (1.5GHz) | 4GB DDR4 (OK)",
    "[    0.456231] FPGA: Fabric calibration successful (feeling silky)",
    "[    0.892341] GPU: Loading shaders... Neural Synapse Mapped",
    "[    1.562310] insmod haha_hihi.ko... [ WARNING: Excessive wit detected ]",
    "[    2.124512] USER: AN_SHUL_IYER (Coffee Level: Critical)",
    "> READY."
];

const content = {
    about: `
        <div class="embedded">
            <h1 class="modal-title">> WHOAMI.md</h1>
            <div class="dino-container">
                <img src="dino-mascot.png" alt="Google Dino Mascot" class="dino-image">
            </div>
            <div class="terminal-text">
                <p>I am an Embedded Engineer currently working on <strong>Embedded RPCs at Google</strong>.</p>
                <p style="margin-top:15px">I like to understand how things work not just at the surface, but all the way down to electrons politely doing their job.</p>
                <p style="margin-top:15px">I spend most of my time somewhere between analog signals, digital logic, and embedded systems, occasionally questioning why a register behaves like it has trust issues.</p>
                <p style="margin-top:15px">Big fan of first principles—if I can’t explain it from scratch, I probably don’t understand it yet.</p>
            </div>
        </div>
    `,
    connect: `
        <div class="embedded">
            <h1 class="modal-title">> CONNECT.md</h1>
            <div class="dino-container">
                <img src="soldering-dino.png" alt="Soldering Dino Mascot" class="dino-image soldering">
            </div>
            <div style="margin-top:30px; line-height:2">
                <p>> EMAIL: <a href="mailto:anshul.iyer@gmail.com" style="color:var(--accent)">anshul.iyer@gmail.com</a></p>
                <p>> LINKEDIN: <a href="https://www.linkedin.com/in/anshul-iyer" target="_blank" style="color:var(--accent)">linkedin.com/in/anshul-iyer</a></p>
                <p style="margin-top:20px; color:var(--text-secondary)">// CHANNEL_ESTABLISHED //</p>
            </div>
        </div>
    `
};


// --- Background Vias & Traces ---
const vias = [];
const traces = [];
function generatePCB() {
    for (let i = 0; i < 100; i++) {
        vias.push({
            x: Math.random() * WORLD_SIZE,
            y: Math.random() * WORLD_SIZE,
            size: 2 + Math.random() * 4,
            pulse: Math.random() * Math.PI
        });
    }
    for (let i = 0; i < 30; i++) {
        let x = Math.random() * WORLD_SIZE;
        let y = Math.random() * WORLD_SIZE;
        let points = [{ x, y }];
        for (let j = 0; j < 4; j++) {
            x += (Math.random() - 0.5) * 400;
            y += (Math.random() - 0.5) * 400;
            points.push({ x, y });
        }
        traces.push({ points, active: 0 });
    }
}

// --- Initialization ---
function init() {
    window.addEventListener('resize', resize);
    resize();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', e => keys[e.code] = false);

    // Mouse Interaction
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Touch Interaction
    window.addEventListener('touchstart', e => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        if (gameState === 'boot') return; 

        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    });

    window.addEventListener('touchmove', e => {
        mouse.x = e.touches[0].clientX;
        mouse.y = e.touches[0].clientY;
    }, { passive: false });

    // Menu Item Interaction (Touch & Click)
    menuOptions.forEach((opt, index) => {
        opt.addEventListener('click', () => {
            if (audioCtx.state === 'suspended') audioCtx.resume();
            currentMenuIndex = index;
            updateMenuSelection();
            selectOption(opt.dataset.option);
        });
    });

    window.addEventListener('mousedown', () => {
        if (audioCtx.state === 'suspended') audioCtx.resume();
    });

    closeModal.addEventListener('click', () => modal.classList.add('hidden'));

    generatePCB();
    setTimeout(runBootSequence, 1000);
    setInterval(updateHUD, 1000);
}

function resize() {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width;
    canvas.height = height;
}

function updateHUD() {
    const tempVal = document.querySelector('.status-panel:nth-child(1) .value');
    const signalVal = document.querySelector('.status-panel:nth-child(2) .value');

    if (tempVal) {
        const temp = 38 + Math.random() * 10;
        tempVal.textContent = temp.toFixed(1) + "°C";
        tempVal.classList.toggle('critical', temp > 45);
    }
    if (signalVal) {
        signalVal.textContent = (95 + Math.random() * 5).toFixed(1) + "%";
    }
}

async function runBootSequence() {
    const splash = document.getElementById('boot-splash');
    const flashBtn = document.getElementById('flash-button');
    const mockup = document.querySelector('.phone-mockup');

    return new Promise((resolve) => {
        flashBtn.addEventListener('click', async () => {
            const guide = document.querySelector('.click-guide');
            if (guide) guide.style.display = 'none';

            flashBtn.classList.add('clicked');
            sounds.blip();

            await new Promise(r => setTimeout(r, 600));
            mockup.classList.add('zooming');

            await new Promise(r => setTimeout(r, 1000));
            splash.classList.add('hidden');

            sounds.boot();

            for (const msg of logMessages) {
                const p = document.createElement('p');
                p.textContent = "";
                bootLog.appendChild(p);
                for (let i = 0; i < msg.length; i++) {
                    p.textContent += msg[i];
                    if (i % 4 === 0) sounds.blip();
                    await new Promise(r => setTimeout(r, 25));
                }
                await new Promise(r => setTimeout(r, 100));
            }

            await new Promise(r => setTimeout(r, 300));
            bootLog.style.opacity = '0.3';
            bootLog.style.transition = 'opacity 1s ease';

            bootMenu.classList.remove('hidden');
            bootMenu.offsetHeight;
            bootMenu.classList.add('visible');

            menuOptions.forEach((opt, i) => {
                setTimeout(() => opt.classList.add('slide-in'), i * 100);
            });
            resolve();
        }, { once: true });
    });
}

function handleKeyDown(e) {
    keys[e.code] = true;

    if (gameState === 'menu') {
        if (e.code === 'ArrowUp' || e.code === 'KeyW') {
            currentMenuIndex = (currentMenuIndex - 1 + menuOptions.length) % menuOptions.length;
            updateMenuSelection();
            sounds.tick();
        }
        if (e.code === 'ArrowDown' || e.code === 'KeyS') {
            currentMenuIndex = (currentMenuIndex + 1) % menuOptions.length;
            updateMenuSelection();
            sounds.tick();
        }
        if (e.code === 'Enter' || e.code === 'Space') {
            const option = menuOptions[currentMenuIndex].dataset.option;
            selectOption(option);
        }
    } else if (gameState === 'game') {
        if (e.code === 'Escape') exitGame();
    }
}

function updateMenuSelection() {
    menuOptions.forEach((opt, i) => {
        opt.classList.toggle('active', i === currentMenuIndex);
    });
}

function selectOption(option) {
    sounds.select();
    if (option === 'game') {
        loader.classList.add('hidden');
        gameContainer.classList.remove('hidden');
        gameState = 'game';
        requestAnimationFrame(animate);
    } else if (option === 'about' || option === 'connect') {
        modalBody.innerHTML = content[option];
        modal.classList.remove('hidden');
    } else if (option === 'github') {
        window.open('https://github.com/engineiyer', '_blank');
    } else if (option === 'blogs') {
        window.open('https://medium.com/@anshuliyer', '_blank'); 
    }
}

function exitGame() {
    gameContainer.classList.add('hidden');
    loader.classList.remove('hidden');
    gameState = 'menu';
}

function update() {
    if (gameState !== 'game') return;

    let moveX = 0, moveY = 0;
    if (keys['KeyW'] || keys['ArrowUp']) moveY -= player.speed;
    if (keys['KeyS'] || keys['ArrowDown']) moveY += player.speed;
    if (keys['KeyA'] || keys['ArrowLeft']) moveX -= player.speed;
    if (keys['KeyD'] || keys['ArrowRight']) moveX += player.speed;

    player.x += moveX;
    player.y += moveY;
    player.x = Math.max(0, Math.min(WORLD_SIZE, player.x));
    player.y = Math.max(0, Math.min(WORLD_SIZE, player.y));

    camera.x = player.x - width / 2;
    camera.y = player.y - height / 2;

    player.trail.push({ x: player.x, y: player.y });
    if (player.trail.length > 30) player.trail.shift();

    vias.forEach(v => v.pulse += 0.035);
}

function draw() {
    if (gameState !== 'game') return;

    ctx.fillStyle = '#0D0D0F';
    ctx.fillRect(0, 0, width, height);

    ctx.save();
    ctx.translate(-camera.x, -camera.y);

    ctx.lineWidth = 1.5;
    traces.forEach(t => {
        const dx = (t.points[0].x - camera.x) - mouse.x;
        const dy = (t.points[0].y - camera.y) - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        ctx.strokeStyle = dist < 200 ? '#4A9EFF' : '#1A1C23';
        ctx.beginPath();
        ctx.moveTo(t.points[0].x, t.points[0].y);
        for (let i = 1; i < t.points.length; i++) ctx.lineTo(t.points[i].x, t.points[i].y);
        ctx.stroke();
    });

    vias.forEach(v => {
        const p = (Math.sin(v.pulse) + 1) / 2;
        ctx.fillStyle = `rgba(74, 158, 255, ${0.1 + p * 0.2})`;
        ctx.beginPath();
        ctx.arc(v.x, v.y, v.size, 0, Math.PI * 2);
        ctx.fill();
        if (p > 0.8) {
            ctx.strokeStyle = `rgba(74, 158, 255, ${p - 0.8})`;
            ctx.beginPath(); ctx.arc(v.x, v.y, v.size * 2, 0, Math.PI * 2); ctx.stroke();
        }
    });

    ctx.beginPath();
    ctx.strokeStyle = player.color;
    ctx.lineWidth = 3;
    player.trail.forEach((p, i) => {
        ctx.globalAlpha = i / player.trail.length;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
    });
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.shadowBlur = 20;
    ctx.shadowColor = player.color;
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.arc(player.x, player.y, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.restore();
}

function animate() {
    if (gameState === 'game') {
        update();
        draw();
        requestAnimationFrame(animate);
    }
}

init();
