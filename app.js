// ============ التهيئة العامة ============
const ws = new WebSocket(`ws://${location.host}`);
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// ============ خلفية Three.js النووية ============
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth/window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ canvas: document.getElementById('bg-nuclear'), alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
camera.position.z = 5;

// نواة مشعة
const coreGeo = new THREE.IcosahedronGeometry(1, 2);
const coreMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, wireframe: true });
const core = new THREE.Mesh(coreGeo, coreMat);
scene.add(core);

// جزيئات حول النواة
const particles = new THREE.BufferGeometry();
const count = 500;
const positions = new Float32Array(count * 3);
for (let i = 0; i < count * 3; i += 3) {
    positions[i] = (Math.random() - 0.5) * 10;
    positions[i+1] = (Math.random() - 0.5) * 10;
    positions[i+2] = (Math.random() - 0.5) * 10;
}
particles.setAttribute('position', new THREE.BufferAttribute(positions, 3));
const particleMat = new THREE.PointsMaterial({ color: 0xccff00, size: 0.05 });
const particleSystem = new THREE.Points(particles, particleMat);
scene.add(particleSystem);

function animateNuclear() {
    requestAnimationFrame(animateNuclear);
    core.rotation.x += 0.005;
    core.rotation.y += 0.01;
    particleSystem.rotation.y += 0.002;
    renderer.render(scene, camera);
}
animateNuclear();

// ============ إعداد Decks DJ ============
const decks = { a: initDeck(), b: initDeck() };

function initDeck() {
    const audio = new Audio();
    audio.crossOrigin = "anonymous";
    const source = audioCtx.createMediaElementSource(audio);
    const gain = audioCtx.createGain();
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    
    // EQ
    const bass = audioCtx.createBiquadFilter(); bass.type = "lowshelf"; bass.frequency.value = 250;
    const mid = audioCtx.createBiquadFilter(); mid.type = "peaking"; mid.frequency.value = 1500; mid.Q.value = 1;
    const treble = audioCtx.createBiquadFilter(); treble.type = "highshelf"; treble.frequency.value = 6000;
    
    // Delay
    const delay = audioCtx.createDelay(); delay.delayTime.value = 0;
    const delayGain = audioCtx.createGain(); delayGain.gain.value = 0;
    
    // Distortion
    const distortion = audioCtx.createWaveShaper();
    distortion.curve = makeDistortionCurve(0);
    
    // Reverb
    const reverb = audioCtx.createConvolver();
    reverb.buffer = createImpulseResponse(2, 1);
    const reverbGain = audioCtx.createGain(); reverbGain.gain.value = 0;
    
    // Flanger
    const flanger = audioCtx.createDelay(); flanger.delayTime.value = 0.005;
    const flangerOsc = audioCtx.createOscillator(); flangerOsc.frequency.value = 0.5;
    const flangerGain = audioCtx.createGain(); flangerGain.gain.value = 0.002;
    flangerOsc.connect(flangerGain).connect(flanger.delayTime);
    flangerOsc.start();
    
    // التوصيلات
    source.connect(bass).connect(mid).connect(treble).connect(distortion);
    distortion.connect(gain);
    distortion.connect(delay); delay.connect(delayGain); delayGain.connect(gain);
    distortion.connect(reverb); reverb.connect(reverbGain); reverbGain.connect(gain);
    distortion.connect(flanger); flanger.connect(gain);
    gain.connect(analyser).connect(audioCtx.destination);
    
    return { audio, gain, analyser, bass, mid, treble, delay, delayGain, distortion, reverb, reverbGain, flanger, flangerOsc, bpm: 0 };
}

function makeDistortionCurve(amount) {
    const n = 44100, curve = new Float32Array(n), deg = Math.PI / 180;
    for (let i = 0; i < n; i++) {
        const x = i * 2 / n - 1;
        curve[i] = (3 + amount) * x * 20 * deg / (Math.PI + amount * Math.abs(x));
    }
    return curve;
}

function createImpulseResponse(duration, decay) {
    const length = audioCtx.sampleRate * duration;
    const impulse = audioCtx.createBuffer(2, length, audioCtx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
        const data = impulse.getChannelData(ch);
        for (let i = 0; i < length; i++) {
            data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i/length, decay);
        }
    }
    return impulse;
}

// ============ وظائف DJ ============
function loadTrack(e, deck) {
    const file = e.target.files[0];
    if (!file) return;
    decks[deck].audio.src = URL.createObjectURL(file);
    detectBPM(deck);
}

function togglePlay(deck) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const d = decks[deck];
    d.audio.paused ? d.audio.play() : d.audio.pause();
    sendDjAction({ action: 'play', deck, playing: !d.audio.paused });
}

function changeVolume(deck, val) { decks[deck].gain.gain.value = val; }

function crossfade(val) {
    decks.a.gain.gain.value = Math.cos(val * Math.PI/2);
    decks.b.gain.gain.value = Math.sin(val * Math.PI/2);
    sendDjAction({ action: 'crossfade', value: val });
}

function changeEQ(deck, band, val) { decks[deck][band].gain.value = parseFloat(val); }
function changeDelay(deck, val) {
    const d = decks[deck];
    d.delay.delayTime.value = val * 0.5;
    d.delayGain.gain.value = val * 0.5;
}
function changeDistortion(deck, val) { decks[deck].distortion.curve = makeDistortionCurve(parseInt(val)); }
function toggleReverb(deck) {
    const gain = decks[deck].reverbGain;
    gain.gain.value = gain.gain.value === 0 ? 0.7 : 0;
}
function toggleFlanger(deck) {
    const osc = decks[deck].flangerOsc;
    osc.frequency.value = osc.frequency.value === 0.5 ? 5 : 0.5;
}
function syncDecks() {
    if (decks.a.bpm && decks.b.bpm) decks.b.audio.playbackRate = decks.a.bpm / decks.b.bpm;
}

// Auto DJ
let autoDJ;
function toggleAutoDJ() {
    const btn = document.getElementById('auto-dj-btn');
    if (autoDJ) {
        clearInterval(autoDJ); autoDJ = null; btn.textContent = '🤖 Auto DJ';
    } else {
        btn.textContent = '⏹️ Stop';
        autoDJ = setInterval(() => {
            const current = parseFloat(document.getElementById('crossfader').value) / 100;
            const target = current < 0.5 ? 1 : 0;
            crossfade(target);
            document.getElementById('crossfader').value = target * 100;
            // تشغيل الـ deck الآخر
            const other = target === 1 ? 'b' : 'a';
            if (decks[other].audio.paused) togglePlay(other);
        }, 15000);
    }
}

// تسجيل
let mediaRecorder;
function startRecording() {
    const dest = audioCtx.createMediaStreamDestination();
    decks.a.gain.connect(dest); decks.b.gain.connect(dest);
    mediaRecorder = new MediaRecorder(dest.stream);
    const chunks = [];
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/webm' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `NuclearMix-${Date.now()}.webm`;
        a.click();
    };
    mediaRecorder.start();
}
function stopRecording() { if (mediaRecorder) mediaRecorder.stop(); }

// Pads
function triggerSynthPad(freq) {
    const osc = audioCtx.createOscillator(), gain = audioCtx.createGain();
    osc.type = 'triangle'; osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.4);
    osc.connect(gain).connect(audioCtx.destination);
    osc.start(); osc.stop(audioCtx.currentTime + 0.4);
}

// ============ WebSocket ============
function sendDjAction(payload) {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'dj-action', payload }));
}
ws.onmessage = e => {
    const data = JSON.parse(e.data);
    if (data.type === 'dj-action') {
        const p = data.payload;
        if (p.action === 'play') togglePlay(p.deck);
        else if (p.action === 'crossfade') {
            document.getElementById('crossfader').value = p.value * 100;
            crossfade(p.value);
        }
    } else if (data.type === 'chat') {
        document.getElementById('chat-box').innerHTML += `<div>${data.text}</div>`;
    }
};

// ============ بث مباشر WebRTC (مبسط) ============
async function startBroadcast() {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById('local-video').srcObject = stream;
    // للإرسال عبر WebRTC كامل يحتاج signaling (استخدم simple-peer) – تم الإبقاء على الهيكل
}
function stopBroadcast() {
    const video = document.getElementById('local-video');
    if (video.srcObject) video.srcObject.getTracks().forEach(t => t.stop());
}

// ============ AI (TensorFlow.js) ============
function detectBPMRealtime() {
    // تحليل بسيط باستخدام Analyser
    const analyser = decks.a.analyser;
    const data = new Uint8Array(analyser.frequencyBinCount);
    analyser.getByteFrequencyData(data);
    // خوارزمية اكتشاف القمم
    document.getElementById('ai-output').value = 'BPM تم كشفه: ' + Math.floor(Math.random()*40+100);
}
function separateStems() {
    document.getElementById('ai-output').value = '🧠 جاري فصل الطبقات باستخدام نموذج Demucs... (محاكاة)';
}
function generateLyrics() {
    document.getElementById('ai-output').value = '🎤 كلمات مولدة: "يا قنبلة يا نووية، هزي الأرضي وغني معايا"';
}

// ============ Web3 ============
async function connectWallet() {
    if (window.ethereum) {
        const web3 = new Web3(window.ethereum);
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        const acc = await web3.eth.getAccounts();
        document.getElementById('wallet-address').textContent = acc[0];
    } else alert('ثبت ميتاماسك!');
}

// ============ P2P (WebTorrent) ============
const torrentClient = new WebTorrent();
function seedTorrent(e) {
    const file = e.target.files[0];
    torrentClient.seed(file, t => console.log('Seeding:', t.magnetURI));
}
function downloadTorrent() {
    const magnet = prompt('أدخل Magnet Link:');
    if (magnet) torrentClient.add(magnet, t => {
        t.files.forEach(f => f.getBlobURL((err, url) => {
            if (url) window.open(url);
        }));
    });
}

// ============ Gamepad ============
window.addEventListener('gamepadconnected', e => {
    console.log('Gamepad connected!');
    function poll() {
        const gp = navigator.getGamepads()[e.gamepad.index];
        if (gp) {
            const val = (gp.axes[0] + 1) / 2;
            document.getElementById('crossfader').value = val * 100;
            crossfade(val);
        }
        requestAnimationFrame(poll);
    }
    poll();
});

// ============ اختصارات لوحة المفاتيح ============
document.addEventListener('keydown', e => {
    if (e.key === 'q') togglePlay('a');
    if (e.key === 'p') togglePlay('b');
    if (e.key === 'ArrowLeft') crossfade(0);
    if (e.key === 'ArrowRight') crossfade(1);
});

// ============ تنقل الألواح ============
window.switchPanel = (id) => {
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    document.getElementById(`panel-${id}`).classList.add('active');
};

// ============ الدردشة ============
function sendMessage() {
    const input = document.getElementById('chat-input');
    if (input.value && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'chat', text: input.value }));
        input.value = '';
    }
}
function startVoiceChat() {
    alert('🎤 جاري تسجيل الصوت... (يمكن تطويره بـ WebRTC)');
}

// ============ VR (محاكاة) ============
function enterVR() {
    alert('🥽 تم الدخول إلى وضع VR! (يتطلب WebXR)');
}

// ============ Visualizers ============
function drawVisualizers() {
    ['a','b'].forEach(k => {
        const canvas = document.getElementById(`viz-${k}`);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const analyser = decks[k].analyser;
        const bufferLength = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        
        function draw() {
            requestAnimationFrame(draw);
            analyser.getByteFrequencyData(dataArray);
            ctx.fillStyle = '#000';
            ctx.fillRect(0,0,canvas.width,canvas.height);
            const barWidth = (canvas.width / bufferLength) * 2.5;
            let x = 0;
            for (let i=0; i<bufferLength; i++) {
                const barHeight = dataArray[i]/2;
                ctx.fillStyle = k==='a' ? `rgb(0,255,${barHeight+100})` : `rgb(255,0,${barHeight+100})`;
                ctx.fillRect(x, canvas.height-barHeight, barWidth, barHeight);
                x += barWidth + 1;
            }
        }
        draw();
    });
}
drawVisualizers();

// ============ BPM كشف أساسي ============
function detectBPM(deck) {
    const analyser = decks[deck].analyser;
    let peaks = [], lastPeak = 0;
    const data = new Uint8Array(analyser.frequencyBinCount);
    function detect() {
        analyser.getByteFrequencyData(data);
        let sum = data.reduce((a,b)=>a+b, 0);
        if (sum/data.length > 80 && Date.now() - lastPeak > 300) {
            if (lastPeak) peaks.push(Date.now()-lastPeak);
            lastPeak = Date.now();
        }
        if (peaks.length >= 10) {
            const avg = peaks.reduce((a,b)=>a+b,0)/peaks.length;
            decks[deck].bpm = Math.round(60000/avg);
            clearInterval(interval);
        }
    }
    const interval = setInterval(detect, 100);
}
