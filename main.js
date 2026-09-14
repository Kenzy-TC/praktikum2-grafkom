/**
 * SETUP WEBGL2
 */
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2", { preserveDrawingBuffer: false });
if (!gl) throw new Error("WebGL2 tidak tersedia");

// Menggunakan NDC langsung (-1.0 s/d 1.0)
const vertexShaderSource = `#version 300 es
in vec2 a_position;
in vec4 a_color;
out vec4 v_color; // Kirim warna ke fragment shader untuk interpolasi

void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
    v_color = a_color;
}
`;

const fragmentShaderSource = `#version 300 es
precision highp float;
in vec4 v_color;
out vec4 outColor;

void main() {
    outColor = v_color;
}
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
    }
    return shader;
}

const program = gl.createProgram();
gl.attachShader(program, createShader(gl, gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
gl.useProgram(program);

// Buffer Setup (Interleaved: x, y, r, g, b, a)
const vao = gl.createVertexArray();
gl.bindVertexArray(vao);
const buffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);

const aPosition = gl.getAttribLocation(program, "a_position");
gl.enableVertexAttribArray(aPosition);
gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 24, 0); // 24 bytes per vertex (6 * 4)

const aColor = gl.getAttribLocation(program, "a_color");
gl.enableVertexAttribArray(aColor);
gl.vertexAttribPointer(aColor, 4, gl.FLOAT, false, 24, 8); // Offset 8 bytes (2 * 4)

/**
 * STATE VARIABLES & DATA
 */
let spawnColor = [0.0, 1.0, 1.0, 1.0]; // Default Cyan
let spawnMode = gl.TRIANGLES;
let mouseNDC = { x: 0, y: 0 };
let keys = {}; // State-based keyboard input
let spawnedObjects = [];

// Data Format: { mode: gl.ENUM, vertices: Float32Array, dx: float, dy: float, isDynamic: boolean }

// Challenge E: Procedural Pattern (Grid Latar Belakang)
const patternObj = { mode: gl.LINES, vertices: [], isDynamic: false };
for (let i = -1.0; i <= 1.0; i += 0.2) {
    // Vertikal
    patternObj.vertices.push(i, -1.0, 0.2, 0.2, 0.2, 1.0);
    patternObj.vertices.push(i, 1.0, 0.2, 0.2, 0.2, 1.0);
    // Horizontal
    patternObj.vertices.push(-1.0, i, 0.2, 0.2, 0.2, 1.0);
    patternObj.vertices.push(1.0, i, 0.2, 0.2, 0.2, 1.0);
}
patternObj.vertices = new Float32Array(patternObj.vertices);

// Tugas Inti 1 & 2: Static Multiple Colored Primitives
const staticObjects = [
    // 1. Triangle (Vertex Color: Merah, Hijau, Biru -> Interpolasi 3 Warna)
    {
        mode: gl.TRIANGLES,
        isDynamic: false,
        vertices: new Float32Array([
            -0.8, 0.8,   1.0, 0.0, 0.0, 1.0, // Red
            -0.6, 0.8,   0.0, 1.0, 0.0, 1.0, // Green
            -0.7, 0.95,  0.0, 0.0, 1.0, 1.0  // Blue
        ])
    },
    // 2. Rectangle (Solid Color / Dual Color Interpolation)
    {
        mode: gl.TRIANGLES,
        isDynamic: false,
        vertices: new Float32Array([
            -0.9, 0.5,   1.0, 1.0, 0.0, 1.0, 
            -0.5, 0.5,   1.0, 1.0, 0.0, 1.0, 
            -0.9, 0.7,   1.0, 0.5, 0.0, 1.0, 
            -0.9, 0.7,   1.0, 0.5, 0.0, 1.0, 
            -0.5, 0.5,   1.0, 1.0, 0.0, 1.0, 
            -0.5, 0.7,   1.0, 0.5, 0.0, 1.0  
        ])
    },
    // 3. Line Based Shape (Cross)
    {
        mode: gl.LINES,
        isDynamic: false,
        vertices: new Float32Array([
            -0.3, 0.6,   1.0, 0.0, 1.0, 1.0,
            -0.1, 0.6,   1.0, 0.0, 1.0, 1.0,
            -0.2, 0.5,   0.0, 1.0, 1.0, 1.0,
            -0.2, 0.7,   0.0, 1.0, 1.0, 1.0
        ])
    }
];

// Tugas Inti 3 & Challenge D: Multiple Moving Objects memantul
const movingObjects = [
    createMovingShape(0.0, 0.0, 0.1, gl.TRIANGLES, [1,0,0,1], 0.005, 0.01),
    createMovingShape(0.5, 0.5, 0.08, gl.TRIANGLES, [0,1,0,1], -0.008, 0.006),
    createMovingShape(0.2, -0.4, 0.12, gl.TRIANGLE_FAN, [0.5,0.5,1,1], 0.007, -0.009)
];

// Tugas Inti 4: Player Object (Digerakkan keyboard state-based)
const playerOriginVertices = [
    -0.05, -0.05, 1,1,1,1,
     0.05, -0.05, 1,1,1,1,
    -0.05,  0.05, 1,1,1,1,
    -0.05,  0.05, 1,1,1,1,
     0.05, -0.05, 1,1,1,1,
     0.05,  0.05, 1,1,1,1,
];
const playerObject = {
    mode: gl.TRIANGLES,
    vertices: new Float32Array(playerOriginVertices),
    dx: 0, dy: -0.8 // Start di bawah
};

/**
 * HELPER FUNCTIONS
 */
function createMovingShape(x, y, size, mode, color, dx, dy) {
    // Membuat sebuah kotak kecil
    let v = [
        x-size, y-size, ...color,
        x+size, y-size, ...color,
        x-size, y+size, ...color,
        x-size, y+size, ...color,
        x+size, y-size, ...color,
        x+size, y+size, ...color
    ];
    return { mode: mode, vertices: new Float32Array(v), dx: dx, dy: dy };
}

function updateMovingVertices(obj) {
    // Menghitung bounding box untuk pantulan
    let minX = 2, maxX = -2, minY = 2, maxY = -2;
    for(let i=0; i<obj.vertices.length; i+=6) {
        if (obj.vertices[i] < minX) minX = obj.vertices[i];
        if (obj.vertices[i] > maxX) maxX = obj.vertices[i];
        if (obj.vertices[i+1] < minY) minY = obj.vertices[i+1];
        if (obj.vertices[i+1] > maxY) maxY = obj.vertices[i+1];
    }

    // Pantulan Batas NDC (-1.0 s/d 1.0)
    if (maxX + obj.dx > 1.0 || minX + obj.dx < -1.0) obj.dx *= -1;
    if (maxY + obj.dy > 1.0 || minY + obj.dy < -1.0) obj.dy *= -1;

    // Translasi dengan memodifikasi Vertex (Tugas Inti 3: Tanpa Matrix)
    for(let i=0; i<obj.vertices.length; i+=6) {
        obj.vertices[i] += obj.dx;
        obj.vertices[i+1] += obj.dy;
    }
}

function updatePlayer() {
    const speed = 0.015;
    let moveX = 0, moveY = 0;
    
    // State-based keyboard check
    if (keys["ArrowLeft"] || keys["a"]) moveX = -speed;
    if (keys["ArrowRight"] || keys["d"]) moveX = speed;
    if (keys["ArrowUp"] || keys["w"]) moveY = speed;
    if (keys["ArrowDown"] || keys["s"]) moveY = -speed;

    if (moveX !== 0 || moveY !== 0) {
        // Cek batasan (Collision) agar player tidak keluar layar
        let minX = 2, maxX = -2, minY = 2, maxY = -2;
        for(let i=0; i<playerObject.vertices.length; i+=6) {
            if (playerObject.vertices[i] < minX) minX = playerObject.vertices[i];
            if (playerObject.vertices[i] > maxX) maxX = playerObject.vertices[i];
            if (playerObject.vertices[i+1] < minY) minY = playerObject.vertices[i+1];
            if (playerObject.vertices[i+1] > maxY) maxY = playerObject.vertices[i+1];
        }

        if (maxX + moveX > 1.0 || minX + moveX < -1.0) moveX = 0;
        if (maxY + moveY > 1.0 || minY + moveY < -1.0) moveY = 0;

        // Apply
        for(let i=0; i<playerObject.vertices.length; i+=6) {
            playerObject.vertices[i] += moveX;
            playerObject.vertices[i+1] += moveY;
        }
    }
}

/**
 * INTERAKSI & EVENTS
 */
// UI BUttons
window.setCurrentColor = (r, g, b, a) => spawnColor = [r, g, b, a];
window.setRandomColor = () => spawnColor = [Math.random(), Math.random(), Math.random(), 1.0];
document.getElementById('shapeSelect').addEventListener('change', (e) => {
    document.getElementById('hud-mode').innerText = e.target.value;
    spawnMode = gl[e.target.value]; 
});

// Event-based dan State-based Keyboard
window.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    
    // Event-Based actions (Sekali tekan)
    const key = e.key.toLowerCase();
    if (key === 'r') {
        // Reset Player
        playerObject.vertices = new Float32Array(playerOriginVertices);
        // Reset Spawn
        spawnedObjects = [];
    }
    if (key === 'c') {
        // Ganti warna Player
        const rc = [Math.random(), Math.random(), Math.random(), 1.0];
        for(let i=2; i<playerObject.vertices.length; i+=6) {
            playerObject.vertices[i] = rc[0];
            playerObject.vertices[i+1] = rc[1];
            playerObject.vertices[i+2] = rc[2];
        }
    }
});
window.addEventListener('keyup', (e) => keys[e.key] = false);

// Mouse Track & Click Spawn (Challenge C)
canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    // Konversi Pixel Canvas ke NDC (-1.0 s/d 1.0)
    mouseNDC.x = ((e.clientX - rect.left) / canvas.width) * 2 - 1;
    mouseNDC.y = ((canvas.height - (e.clientY - rect.top)) / canvas.height) * 2 - 1;
    document.getElementById('hud-mouse').innerText = `(${mouseNDC.x.toFixed(2)}, ${mouseNDC.y.toFixed(2)})`;
});

canvas.addEventListener('mousedown', (e) => {
    const s = 0.08; // Ukuran standar spawn
    let verts = [];
    const [r, g, b, a] = spawnColor;

    if (spawnMode === gl.TRIANGLES) {
        verts = [
            mouseNDC.x, mouseNDC.y + s, r, g, b, a,
            mouseNDC.x - s, mouseNDC.y - s, r, g, b, a,
            mouseNDC.x + s, mouseNDC.y - s, r, g, b, a
        ];
    } else if (spawnMode === gl.LINE_LOOP) {
        // Hexagon
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            verts.push(mouseNDC.x + Math.cos(angle) * s, mouseNDC.y + Math.sin(angle) * s, r, g, b, a);
        }
    } else {
        // RECTANGLE (via 2 Triangles)
        spawnMode = gl.TRIANGLES;
        verts = [
            mouseNDC.x-s, mouseNDC.y-s, r, g, b, a,
            mouseNDC.x+s, mouseNDC.y-s, r, g, b, a,
            mouseNDC.x-s, mouseNDC.y+s, r, g, b, a,
            mouseNDC.x-s, mouseNDC.y+s, r, g, b, a,
            mouseNDC.x+s, mouseNDC.y-s, r, g, b, a,
            mouseNDC.x+s, mouseNDC.y+s, r, g, b, a
        ];
    }

    spawnedObjects.push({
        mode: spawnMode,
        vertices: new Float32Array(verts)
    });
});

/**
 * ANIMATION & RENDER LOOP
 */
let lastTime = 0, fpsCount = 0, primitiveCount = 0;

function drawObject(obj) {
    gl.bufferData(gl.ARRAY_BUFFER, obj.vertices, gl.DYNAMIC_DRAW);
    
    const vertexCount = obj.vertices.length / 6;
    gl.drawArrays(obj.mode, 0, vertexCount);
    
    // Kalkulasi jumlah primitive aktual yang di-render WebGL
    if (obj.mode === gl.TRIANGLES) primitiveCount += vertexCount / 3;
    else if (obj.mode === gl.LINES) primitiveCount += vertexCount / 2;
    else if (obj.mode === gl.LINE_LOOP || obj.mode === gl.TRIANGLE_FAN) primitiveCount += vertexCount; 
}

function render(time) {
    // 1. Calculate FPS
    const deltaTime = time - lastTime;
    if (deltaTime > 0) {
        fpsCount = Math.round(1000 / deltaTime);
    }
    lastTime = time;
    primitiveCount = 0; // Reset counter

    // 2. Logic Update
    updatePlayer();
    movingObjects.forEach(updateMovingVertices);

    // 3. Clear Screen (Tugas Utama: Background Non-default)
    gl.clearColor(0.08, 0.08, 0.12, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // 4. Render All
    drawObject(patternObj);
    staticObjects.forEach(drawObject);
    movingObjects.forEach(drawObject);
    spawnedObjects.forEach(drawObject);
    drawObject(playerObject); // Render player paling atas

    // 5. Update HUD
    document.getElementById('hud-fps').innerText = fpsCount;
    document.getElementById('hud-prim').innerText = Math.round(primitiveCount);

    requestAnimationFrame(render);
}

// Mulai Loop
requestAnimationFrame(render);
