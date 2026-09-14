const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");

if (!gl) {
  throw new Error("WebGL2 tidak tersedia di browser ini.");
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message);
  }

  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const program = gl.createProgram();
  gl.attachShader(program, createShader(gl.VERTEX_SHADER, vertexSource));
  gl.attachShader(program, createShader(gl.FRAGMENT_SHADER, fragmentSource));
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(program);
    gl.deleteProgram(program);
    throw new Error(message);
  }

  return program;
}

const program = createProgram(
  `#version 300 es
   in vec2 a_position;
   in vec4 a_color;
   out vec4 v_color;
   void main() {
     gl_Position = vec4(a_position, 0.0, 1.0);
     v_color = a_color;
   }`,
  `#version 300 es
   precision mediump float;
   in vec4 v_color;
   out vec4 outColor;
   void main() {
     outColor = v_color;
   }`
);

gl.useProgram(program);

const vao = gl.createVertexArray();
const buffer = gl.createBuffer();
const positionLocation = gl.getAttribLocation(program, "a_position");
const colorLocation = gl.getAttribLocation(program, "a_color");

const vertexSize = 6 * Float32Array.BYTES_PER_ELEMENT;
gl.bindVertexArray(vao);
gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
gl.enableVertexAttribArray(positionLocation);
gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, vertexSize, 0);
gl.enableVertexAttribArray(colorLocation);
gl.vertexAttribPointer(colorLocation, 4, gl.FLOAT, false, vertexSize, 2 * Float32Array.BYTES_PER_ELEMENT);

const hudFps = document.getElementById("hud-fps");
const hudPrimitive = document.getElementById("hud-prim");
const hudMouse = document.getElementById("hud-mouse");
const hudMode = document.getElementById("hud-mode");
const shapeSelect = document.getElementById("shapeSelect");
const pauseText = document.getElementById("pause-text");

const keys = new Set();
const mouse = { x: 0, y: 0 };
const colors = [
  [1, 0.2, 0.3, 1],
  [0.2, 0.9, 0.5, 1],
  [0.2, 0.6, 1, 1],
  [1, 0.75, 0.15, 1],
  [0.8, 0.3, 1, 1]
];
let selectedColor = colors[2];
let colorIndex = 2;
let paused = false;
let spawnedObjects = [];

function vertex(x, y, color) {
  return [x, y, ...color];
}

function makeTriangle(cx, cy, size, triangleColors = colors.slice(0, 3)) {
  return {
    mode: gl.TRIANGLES,
    vertices: new Float32Array([
      ...vertex(cx, cy + size, triangleColors[0]),
      ...vertex(cx - size, cy - size, triangleColors[1]),
      ...vertex(cx + size, cy - size, triangleColors[2])
    ])
  };
}

function makeRectangle(cx, cy, width, height, color) {
  const left = cx - width / 2;
  const right = cx + width / 2;
  const top = cy + height / 2;
  const bottom = cy - height / 2;
  const alternate = [color[0] * 0.65, color[1] * 0.65, color[2] * 0.65, 1];

  return {
    mode: gl.TRIANGLES,
    vertices: new Float32Array([
      ...vertex(left, bottom, color), ...vertex(right, bottom, alternate), ...vertex(left, top, color),
      ...vertex(left, top, color), ...vertex(right, bottom, alternate), ...vertex(right, top, alternate)
    ])
  };
}

function makeLineShape(cx, cy, size, color) {
  return {
    mode: gl.LINE_LOOP,
    vertices: new Float32Array([
      ...vertex(cx - size, cy - size, color),
      ...vertex(cx + size, cy - size, color),
      ...vertex(cx + size, cy + size, color),
      ...vertex(cx - size, cy + size, color)
    ])
  };
}

function makeDiamondLine(cx, cy, width, height, color) {
  return {
    mode: gl.LINE_STRIP,
    vertices: new Float32Array([
      ...vertex(cx, cy + height, color),
      ...vertex(cx + width, cy, color),
      ...vertex(cx, cy - height, color),
      ...vertex(cx - width, cy, color),
      ...vertex(cx, cy + height, color)
    ])
  };
}

function makeCursorSquare(cx, cy) {
  return makeLineShape(cx, cy, 0.025, [0.78, 0.8, 0.84, 1]);
}

const triangle = makeTriangle(-0.62, 0.58, 0.2);
const rectangle = makeRectangle(0.55, 0.58, 0.42, 0.26, [1, 0.55, 0.08, 1]);
const lineShape = makeLineShape(0, 0.55, 0.22, [0.1, 0.95, 0.95, 1]);
const diamondLine = makeDiamondLine(0.52, 0.02, 0.2, 0.13, [0.95, 0.35, 0.75, 1]);

const movingTriangles = [
  { x: -0.05, y: -0.42, size: 0.08, dx: 0.00055, dy: 0.0002, colors: [[1, 0.1, 0.2, 1], [1, 0.8, 0.1, 1], [0.8, 0.2, 0.1, 1]] },
  { x: 0.28, y: -0.22, size: 0.12, dx: -0.00035, dy: 0.0006, colors: [[0.2, 0.9, 0.5, 1], [0.1, 0.7, 1, 1], [0.1, 0.3, 0.8, 1]] },
  { x: -0.42, y: -0.12, size: 0.055, dx: 0.0008, dy: -0.00045, colors: [[1, 0.3, 0.8, 1], [0.7, 0.2, 1, 1], [1, 0.5, 0.2, 1]] },
  { x: 0.58, y: -0.4, size: 0.07, dx: -0.0007, dy: -0.0003, colors: [[0.3, 1, 0.9, 1], [0.1, 0.6, 0.9, 1], [0.2, 0.9, 0.4, 1]] },
  { x: -0.7, y: -0.38, size: 0.1, dx: 0.00025, dy: 0.00075, colors: [[1, 0.7, 0.1, 1], [1, 0.25, 0.1, 1], [0.8, 0.1, 0.4, 1]] }
];

function rebuildMovingTriangles() {
  for (const movingTriangle of movingTriangles) {
    movingTriangle.object = makeTriangle(
      movingTriangle.x,
      movingTriangle.y,
      movingTriangle.size,
      movingTriangle.colors
    );
  }
}

rebuildMovingTriangles();

const player = {
  x: -0.45,
  y: -0.55,
  width: 0.22,
  height: 0.16,
  color: [0.95, 0.2, 0.25, 1]
};

function updatePlayer() {
  const speed = 0.012;
  if (keys.has("a") || keys.has("arrowleft")) player.x -= speed;
  if (keys.has("d") || keys.has("arrowright")) player.x += speed;
  if (keys.has("w") || keys.has("arrowup")) player.y += speed;
  if (keys.has("s") || keys.has("arrowdown")) player.y -= speed;
  player.x = Math.max(-1 + player.width / 2, Math.min(1 - player.width / 2, player.x));
  player.y = Math.max(-1 + player.height / 2, Math.min(1 - player.height / 2, player.y));
}

function updateMoving() {
  for (const movingTriangle of movingTriangles) {
    movingTriangle.x += movingTriangle.dx;
    movingTriangle.y += movingTriangle.dy;

    if (movingTriangle.x + movingTriangle.size >= 1 || movingTriangle.x - movingTriangle.size <= -1) {
      movingTriangle.dx *= -1;
    }
    if (movingTriangle.y + movingTriangle.size >= 1 || movingTriangle.y - movingTriangle.size <= -1) {
      movingTriangle.dy *= -1;
    }
  }

  rebuildMovingTriangles();
}

function drawObject(object) {
  gl.bufferData(gl.ARRAY_BUFFER, object.vertices, gl.DYNAMIC_DRAW);
  gl.drawArrays(object.mode, 0, object.vertices.length / 6);
}

function drawPlayer() {
  drawObject(makeRectangle(player.x, player.y, player.width, player.height, player.color));
}

function spawnAtMouse() {
  const size = 0.09;
  if (shapeSelect.value === "TRIANGLES") {
    spawnedObjects.push(makeTriangle(mouse.x, mouse.y, size, [selectedColor, colors[(colorIndex + 1) % colors.length], colors[(colorIndex + 2) % colors.length]]));
  } else if (shapeSelect.value === "RECTANGLE") {
    spawnedObjects.push(makeRectangle(mouse.x, mouse.y, size * 2.1, size * 1.5, selectedColor));
  } else {
    spawnedObjects.push(makeLineShape(mouse.x, mouse.y, size, selectedColor));
  }

  selectedColor = colors[(colorIndex + 1) % colors.length];
  colorIndex = (colorIndex + 1) % colors.length;
}

function reset() {
  player.x = -0.45;
  player.y = -0.55;
  player.color = [0.95, 0.2, 0.25, 1];
  const initialPositions = [
    [-0.05, -0.42], [0.28, -0.22], [-0.42, -0.12], [0.58, -0.4], [-0.7, -0.38]
  ];
  movingTriangles.forEach((movingTriangle, index) => {
    movingTriangle.x = initialPositions[index][0];
    movingTriangle.y = initialPositions[index][1];
  });
  rebuildMovingTriangles();
  spawnedObjects = [];
  paused = false;
}

function setColor(color) {
  selectedColor = color;
  player.color = color;
}

window.setCurrentColor = (r, g, b, a) => setColor([r, g, b, a]);
window.setRandomColor = () => setColor([Math.random(), Math.random(), Math.random(), 1]);

shapeSelect.addEventListener("change", () => {
  hudMode.textContent = shapeSelect.value;
});

canvas.addEventListener("mousemove", (event) => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = 1 - ((event.clientY - rect.top) / rect.height) * 2;
  hudMouse.textContent = `(${mouse.x.toFixed(2)}, ${mouse.y.toFixed(2)})`;
});

canvas.addEventListener("click", spawnAtMouse);

window.addEventListener("keydown", (event) => {
  const key = event.key.toLowerCase();
  if ([" ", "w", "a", "s", "d", "arrowup", "arrowdown", "arrowleft", "arrowright"].includes(key)) {
    event.preventDefault();
  }
  keys.add(key);

  if (key === "c" && !event.repeat) {
    colorIndex = (colorIndex + 1) % colors.length;
    setColor(colors[colorIndex]);
  }
  if (key === "r" && !event.repeat) reset();
  if (key === " " && !event.repeat) paused = !paused;
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key.toLowerCase());
});

let previousTime = 0;
let fps = 0;

function render(time) {
  const delta = time - previousTime;
  previousTime = time;
  if (delta > 0) fps = Math.round(1000 / delta);

  if (!paused) {
    updatePlayer();
    updateMoving();
  }

  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clearColor(0.035, 0.055, 0.12, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.bindVertexArray(vao);

  drawObject(triangle);
  drawObject(rectangle);
  drawObject(lineShape);
  drawObject(diamondLine);
  for (const movingTriangle of movingTriangles) drawObject(movingTriangle.object);
  drawPlayer();
  drawObject(makeCursorSquare(mouse.x, mouse.y));
  for (const object of spawnedObjects) drawObject(object);

  hudFps.textContent = String(fps);
  hudPrimitive.textContent = String(4 + movingTriangles.length + 2 + spawnedObjects.length);
  pauseText.textContent = paused ? "PAUSED" : "RUNNING";
  pauseText.classList.toggle("is-paused", paused);

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
