// ============================================================================
// Configuration Constants
// ============================================================================
const STAR_SCALE = 0.6;
const ROTATION_SPEEDS = {
    default: { x: 0.005, y: 0.007, z: 0.003 },
    stopped: { x: 0, y: 0, z: 0 }
};
const PERSPECTIVE = {
    distance: 1000,
    scale: (z) => PERSPECTIVE.distance / (PERSPECTIVE.distance + z)
};
const DRAG_SENSITIVITY = 0.005;
const MOMENTUM_DECAY = 0.95;
const AUTO_ROTATION_DELAY = 2500;
const ROTATION_LERP_SPEED = 0.05;  // Controls how fast rotation changes occur

// ============================================================================
// Star Structure Definition
// ============================================================================
const points = [
    // Outer points (vertices)
    [0, 250, 0],     // Top (0)
    [0, -250, 0],    // Bottom (1)
    [250, 0, 0],     // Right (2)
    [-250, 0, 0],    // Left (3)
    [0, 0, 250],     // Front (4)
    [0, 0, -250],    // Back (5)

    // Inner points for slim vertices
    [0, 40, 0],      // Top inner (6)
    [0, -40, 0],     // Bottom inner (7)
    [40, 0, 0],      // Right inner (8)
    [-40, 0, 0],     // Left inner (9)
    [0, 0, 40],      // Front inner (10)
    [0, 0, -40]      // Back inner (11)
].map(point => point.map(coord => coord * STAR_SCALE));

const connections = [
    // Top vertex connections
    [0, 8], [0, 9], [0, 10], [0, 11], [8, 6], [9, 6], [10, 6], [11, 6],
    // Bottom vertex connections
    [1, 8], [1, 9], [1, 10], [1, 11], [8, 7], [9, 7], [10, 7], [11, 7],
    // Right vertex connections
    [2, 6], [2, 7], [2, 10], [2, 11],
    // Left vertex connections
    [3, 6], [3, 7], [3, 10], [3, 11],
    // Front vertex connections
    [4, 6], [4, 7], [4, 8], [4, 9],
    // Back vertex connections
    [5, 6], [5, 7], [5, 8], [5, 9],
    // Inner connections (octahedron)
    [6, 8], [8, 10], [10, 6], [7, 8], [8, 10], [10, 7],
    [6, 9], [9, 11], [11, 6], [7, 9], [9, 11], [11, 7]
];

// ============================================================================
// State Variables
// ============================================================================
let canvas, ctx, rect;
let rotationX = 0, rotationY = 0, rotationZ = 0;
let currentRotationSpeed = { ...ROTATION_SPEEDS.default };
let targetRotationSpeed = { ...ROTATION_SPEEDS.default };
let activeVertex = null;
let mouseX = 0, mouseY = 0;
let indicatorOpacity = 0;
let activePoint = null;
let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragVelocityX = 0;
let dragVelocityY = 0;
let lastDragTime = 0;
let lastMouseX = 0;
let lastMouseY = 0;
let autoRotationTimeout = null;
let isAutoRotating = true;
let isTransitioningToStop = false;
let touchStartX = 0;
let touchStartY = 0;

// ============================================================================
// Utility Functions
// ============================================================================
function toRoman(num) {
    const romanNumerals = ['I', 'II', 'III', 'IV', 'V', 'VI'];
    return romanNumerals[num - 1];
}

function rotate3D(point, rx, ry, rz) {
    let [x, y, z] = point;
    
    // Rotate around X
    const cosX = Math.cos(rx), sinX = Math.sin(rx);
    const y1 = y * cosX - z * sinX;
    const z1 = y * sinX + z * cosX;
    
    // Rotate around Y
    const cosY = Math.cos(ry), sinY = Math.sin(ry);
    const x2 = x * cosY + z1 * sinY;
    const z2 = -x * sinY + z1 * cosY;
    
    // Rotate around Z
    const cosZ = Math.cos(rz), sinZ = Math.sin(rz);
    const x3 = x2 * cosZ - y1 * sinZ;
    const y3 = x2 * sinZ + y1 * cosZ;
    
    return [x3, y3, z2];
}

function distanceToLine(point, lineStart, lineEnd) {
    const [x, y, z] = point;
    const [x1, y1, z1] = lineStart;
    const [x2, y2, z2] = lineEnd;
    
    const dx = x2 - x1;
    const dy = y2 - y1;
    const dz = z2 - z1;
    
    const lenSq = dx * dx + dy * dy + dz * dz;
    let t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy + (z - z1) * dz) / lenSq));
    
    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const closestZ = z1 + t * dz;
    
    return Math.sqrt(
        Math.pow(x - closestX, 2) +
        Math.pow(y - closestY, 2) +
        Math.pow(z - closestZ, 2)
    );
}

function unprojectPoint(screenX, screenY, depth) {
    const scale = PERSPECTIVE.scale(depth);
    return [
        (screenX - canvas.width / 2) / scale,
        (screenY - canvas.height / 2) / scale,
        depth
    ];
}

// ============================================================================
// Word Management
// ============================================================================
const words = [
    // AI & Consciousness
    "neural", "cognition", "sentient", "quantum", "algorithm",
    "synaptic", "cortical", "protocol", "binary", "synthetic",
    "autonomous", "recursive", "heuristic", "cybernetic", "biometric",
    
    // Technology & Systems
    "nexus", "matrix", "cipher", "proxy", "vertex",
    "kernel", "vector", "tensor", "daemon", "codec",
    
    // System Operations
    "runtime", "process", "thread", "buffer", "cache",
    "compile", "execute", "decrypt", "encode", "parse",
    
    // Cyberpunk Elements
    "synapse", "cortex", "neural", "cyber", "quantum",
    "matrix", "vector", "proxy", "nexus", "cipher"
];

// Vertex information with themed words
const vertexInfo = [
    { 
        point: [0, 250, 0].map(x => x * STAR_SCALE),
        words: ["neural-1", "synapse-1", "cortex-1", "brain-1", "mind-1"]
    },
    { 
        point: [0, -250, 0].map(x => x * STAR_SCALE),
        words: ["quantum-2", "particle-2", "wave-2", "field-2", "energy-2"]
    },
    { 
        point: [250, 0, 0].map(x => x * STAR_SCALE),
        words: ["data-3", "stream-3", "flow-3", "process-3", "compute-3"]
    },
    { 
        point: [-250, 0, 0].map(x => x * STAR_SCALE),
        words: ["cyber-4", "network-4", "matrix-4", "grid-4", "mesh-4"]
    },
    { 
        point: [0, 0, 250].map(x => x * STAR_SCALE),
        words: ["bio-5", "synth-5", "hybrid-5", "fusion-5", "merge-5"]
    },
    { 
        point: [0, 0, -250].map(x => x * STAR_SCALE),
        words: ["void-6", "deep-6", "space-6", "null-6", "zero-6"]
    }
].map(info => ({
    ...info,
    opacity: 0,
    targetOpacity: 0
}));

// ============================================================================
// Floating Word Class
// ============================================================================
class FloatingWord {
    constructor() {
        this.availableWords = words;
        this.word = this.getRandomWord();
        this.repositionInSphere();
        this.changeTimer = Math.random() * 100;
        this.opacity = Math.random() * 0.3 + 0.4;
        this.font = '10px "Space Mono", monospace';
    }

    getRandomWord() {
        return this.availableWords[Math.floor(Math.random() * this.availableWords.length)];
    }

    repositionInSphere() {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        const radius = (Math.random() * 0.3 + 0.7) * 150 * STAR_SCALE;
        
        this.x = radius * Math.sin(phi) * Math.cos(theta);
        this.y = radius * Math.sin(phi) * Math.sin(theta);
        this.z = radius * Math.cos(phi);
        
        this.fadeDirection = Math.random() < 0.5 ? -1 : 1;
        this.fadeSpeed = 0.002 + Math.random() * 0.002;
    }

    update() {
        this.opacity += this.fadeDirection * this.fadeSpeed;
        if (this.opacity <= 0.4 || this.opacity >= 0.7) {
            this.fadeDirection *= -1;
            if (this.opacity <= 0.4) {
                this.currentWord = this.getRandomWord();
            }
        }

        this.changeTimer--;
        if (this.changeTimer <= 0) {
            this.currentWord = this.getRandomWord();
            this.changeTimer = Math.random() * 100 + 50;
        }
    }

    setAvailableWords(newWords) {
        if (this.availableWords !== newWords) {
            this.availableWords = newWords;
            this.changeTimer = Math.random() * 30;
        }
    }
}

// ============================================================================
// Drawing Functions
// ============================================================================
function drawConnections() {
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 1;
    
    connections.forEach(([i, j]) => {
        const p1 = rotate3D(points[i], rotationX, rotationY, rotationZ);
        const p2 = rotate3D(points[j], rotationX, rotationY, rotationZ);
        
        const scale1 = PERSPECTIVE.scale(p1[2]);
        const scale2 = PERSPECTIVE.scale(p2[2]);
        
        const x1 = p1[0] * scale1 + canvas.width / 2;
        const y1 = p1[1] * scale1 + canvas.height / 2;
        const x2 = p2[0] * scale2 + canvas.width / 2;
        const y2 = p2[1] * scale2 + canvas.height / 2;
        
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    });
}

function drawVertexNumbers() {
    ctx.font = '10px "Space Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    vertexInfo.forEach((vertex, index) => {
        const rotated = rotate3D(vertex.point, rotationX, rotationY, rotationZ);
        const scale = PERSPECTIVE.scale(rotated[2]);
        
        // Calculate direction vector from center to point
        const dx = rotated[0];
        const dy = rotated[1];
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Extend position outward
        const extension = 20 * scale;
        const x = (rotated[0] + (dx / length) * extension) * scale + canvas.width / 2;
        const y = (rotated[1] + (dy / length) * extension) * scale + canvas.height / 2;
        
        const depthOpacity = ((1000 + rotated[2]) / 2000) * 0.9 + 0.1;
        ctx.fillStyle = `rgba(255, 255, 255, ${depthOpacity})`;
        ctx.fillText(toRoman(index + 1), x, y);
    });
}

function drawVertexIndicator() {
    const targetOpacity = activeVertex !== null ? 1 : 0;
    indicatorOpacity += (targetOpacity - indicatorOpacity) * 0.1;

    vertexInfo.forEach((vertex, index) => {
        const rotated = rotate3D(vertex.point, rotationX, rotationY, rotationZ);
        const scale = PERSPECTIVE.scale(rotated[2]);
        const screenX = rotated[0] * scale + canvas.width / 2;
        const screenY = rotated[1] * scale + canvas.height / 2;
        
        // Store point data for click detection
        vertex.screenPosition = { x: screenX, y: screenY, radius: 20 * scale };
        
        // Draw indicator circle for active vertex
        if (index === activeVertex && indicatorOpacity > 0.01) {
            const depthOpacity = ((1000 + rotated[2]) / 2000) * 0.9 + 0.1;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 10, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(255, 255, 255, ${depthOpacity * indicatorOpacity * 0.95})`;
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}

function drawFloatingWords() {
    ctx.textAlign = 'center';
    ctx.font = '10px "Space Mono", monospace';
    
    const sortedWords = floatingWords.map(fw => {
        const rotated = rotate3D([fw.x, fw.y, fw.z], rotationX, rotationY, rotationZ);
        return { fw, rotated };
    }).sort((a, b) => b.rotated[2] - a.rotated[2]);
    
    sortedWords.forEach(({ fw, rotated }) => {
        const scale = PERSPECTIVE.scale(rotated[2]);
        const x = rotated[0] * scale + canvas.width / 2;
        const y = rotated[1] * scale + canvas.height / 2;
        
        const depthOpacity = ((1000 + rotated[2]) / 2000) * 0.9 + 0.1;
        ctx.fillStyle = `rgba(255, 255, 255, ${fw.opacity * depthOpacity})`;
        ctx.fillText(fw.currentWord, x, y);
        
        fw.update();
    });
}

// ============================================================================
// State Management Functions
// ============================================================================
function setRotationState(isRotating) {
    isAutoRotating = isRotating;
    isTransitioningToStop = !isRotating;
    targetRotationSpeed = { ...ROTATION_SPEEDS[isRotating ? 'default' : 'stopped'] };
}

function resetDragState() {
    dragVelocityX = 0;
    dragVelocityY = 0;
}

function updateRotationSpeeds() {
    currentRotationSpeed.x += (targetRotationSpeed.x - currentRotationSpeed.x) * ROTATION_LERP_SPEED;
    currentRotationSpeed.y += (targetRotationSpeed.y - currentRotationSpeed.y) * ROTATION_LERP_SPEED;
    currentRotationSpeed.z += (targetRotationSpeed.z - currentRotationSpeed.z) * ROTATION_LERP_SPEED;
}

function findClosestVertex(mouseX, mouseY) {
    const nearPoint = unprojectPoint(mouseX, mouseY, -500);
    const farPoint = unprojectPoint(mouseX, mouseY, 500);
    
    let closestVertex = null;
    let closestDistance = Infinity;
    
    vertexInfo.forEach((vertex, index) => {
        const rotated = rotate3D(vertex.point, rotationX, rotationY, rotationZ);
        const distance = distanceToLine(rotated, nearPoint, farPoint);
        const zScale = PERSPECTIVE.scale(rotated[2]);
        const detectionRadius = 40 * zScale;
        
        if (distance < detectionRadius && distance < closestDistance) {
            closestDistance = distance;
            if (distance < detectionRadius * 0.7) {
                closestVertex = index;
            }
        }
    });
    
    return closestVertex;
}

function updateFloatingWords(vertexIndex = null) {
    floatingWords.forEach(fw => {
        fw.setAvailableWords(vertexIndex !== null ? vertexInfo[vertexIndex].words : words);
    });
}

function updateLegendHighlight(vertexIndex) {
    document.querySelectorAll('.legend-item').forEach((item, i) => {
        item.classList.toggle('active', i === vertexIndex);
    });
}

// ============================================================================
// Event Handlers
// ============================================================================
function handleMouseMove(e) {
    mouseX = e.clientX - rect.left;
    mouseY = e.clientY - rect.top;
    
    if (isDragging) {
        handleDragging(e);
        return;
    }
    
    const closestVertex = findClosestVertex(mouseX, mouseY);
    handleVertexHover(closestVertex);
}

function handleDragging(e) {
    const currentTime = Date.now();
    const deltaTime = currentTime - lastDragTime;
    
    if (deltaTime > 0) {
        dragVelocityX = (e.clientX - lastMouseX) / deltaTime;
        dragVelocityY = (e.clientY - lastMouseY) / deltaTime;
    }
    
    rotationY += (e.clientX - lastMouseX) * DRAG_SENSITIVITY;
    rotationX += (e.clientY - lastMouseY) * DRAG_SENSITIVITY;
    
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    lastDragTime = currentTime;
}

function handleVertexHover(closestVertex) {
    const previousVertex = activeVertex;
    activeVertex = closestVertex;
    
    if (closestVertex !== null) {
        setRotationState(false);
        clearTimeout(autoRotationTimeout);
        updateFloatingWords(closestVertex);
    } else if (previousVertex !== null) {
        setRotationState(false);
        startAutoRotationTimer();
        updateFloatingWords();
    }
    
    updateLegendHighlight(closestVertex);
}

function handleResize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    rect = canvas.getBoundingClientRect();
}

function handleClick(e) {
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    vertexInfo.forEach((vertex, index) => {
        if (vertex.screenPosition) {
            const dx = mouseX - vertex.screenPosition.x;
            const dy = mouseY - vertex.screenPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < vertex.screenPosition.radius) {
                activatePoint(index);
            }
        }
    });
}

function activatePoint(index) {
    activeVertex = index;
    targetRotationSpeed = { ...ROTATION_SPEEDS.stopped };
    floatingWords.forEach(fw => {
        fw.setAvailableWords(vertexInfo[index].words);
    });
    
    document.querySelectorAll('.legend-item').forEach((item, i) => {
        item.classList.toggle('active', i === index);
    });
}

function handleMouseDown(e) {
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    lastDragTime = Date.now();
    dragVelocityX = 0;
    dragVelocityY = 0;
    isAutoRotating = false;
    
    if (autoRotationTimeout) {
        clearTimeout(autoRotationTimeout);
    }
}

function handleMouseUp() {
    isDragging = false;
    setRotationState(false);
    
    if (activeVertex === null) {
        startAutoRotationTimer();
    }
}

function startAutoRotationTimer() {
    if (autoRotationTimeout) {
        clearTimeout(autoRotationTimeout);
    }
    
    autoRotationTimeout = setTimeout(() => {
        if (!isDragging && activeVertex === null) {
            setRotationState(true);
            resetDragState();
        }
    }, AUTO_ROTATION_DELAY);
}

function handleTouchStart(e) {
    e.preventDefault(); // Prevent scrolling while dragging
    const touch = e.touches[0];
    isDragging = true;
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
    lastDragTime = Date.now();
    dragVelocityX = 0;
    dragVelocityY = 0;
    isAutoRotating = false;
    
    if (autoRotationTimeout) {
        clearTimeout(autoRotationTimeout);
    }
}

function handleTouchMove(e) {
    e.preventDefault(); // Prevent scrolling while dragging
    const touch = e.touches[0];
    mouseX = touch.clientX - rect.left;
    mouseY = touch.clientY - rect.top;
    
    if (isDragging) {
        const currentTime = Date.now();
        const deltaTime = currentTime - lastDragTime;
        
        if (deltaTime > 0) {
            dragVelocityX = (touch.clientX - lastMouseX) / deltaTime;
            dragVelocityY = (touch.clientY - lastMouseY) / deltaTime;
        }
        
        rotationY += (touch.clientX - lastMouseX) * DRAG_SENSITIVITY;
        rotationX += (touch.clientY - lastMouseY) * DRAG_SENSITIVITY;
        
        lastMouseX = touch.clientX;
        lastMouseY = touch.clientY;
        lastDragTime = currentTime;
    }
}

function handleTouchEnd(e) {
    isDragging = false;
    setRotationState(false);
    
    if (activeVertex === null) {
        startAutoRotationTimer();
    }
}

// ============================================================================
// Initialization
// ============================================================================
function createLegend() {
    const legend = document.createElement('div');
    legend.className = 'legend';
    
    vertexInfo.forEach((vertex, index) => {
        const item = document.createElement('div');
        item.className = 'legend-item';
        
        const number = document.createElement('span');
        number.className = 'legend-number';
        number.textContent = toRoman(index + 1);
        
        const dash = document.createElement('span');
        dash.className = 'legend-dash';
        dash.textContent = '—';
        
        const text = document.createElement('span');
        text.className = 'legend-text';
        text.textContent = vertex.words[0].split('-')[0].toUpperCase();
        
        item.appendChild(number);
        item.appendChild(dash);
        item.appendChild(text);
        
        item.addEventListener('click', () => activatePoint(index));
        
        legend.appendChild(item);
    });
    
    document.body.appendChild(legend);
}

function initialize() {
    canvas = document.getElementById('starCanvas');
    ctx = canvas.getContext('2d');
    handleResize();
    
    floatingWords = Array(100).fill(null).map(() => new FloatingWord());
    
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    
    createLegend();
}

// ============================================================================
// Animation Loop
// ============================================================================
function updateRotation() {
    if (isAutoRotating && activeVertex === null) {
        updateRotationSpeeds();
        applyRotation();
    } else if (!isDragging) {
        if (activeVertex !== null || isTransitioningToStop) {
            updateRotationSpeeds();
        }
        
        applyMomentum();
        applyRotation();
    }
}

function applyMomentum() {
    rotationY += dragVelocityX * 0.1;
    rotationX += dragVelocityY * 0.1;
    
    dragVelocityX *= MOMENTUM_DECAY;
    dragVelocityY *= MOMENTUM_DECAY;
    
    if (Math.abs(dragVelocityX) < 0.001 && Math.abs(dragVelocityY) < 0.001) {
        if (!autoRotationTimeout && !isAutoRotating && activeVertex === null) {
            startAutoRotationTimer();
        }
    }
}

function applyRotation() {
    rotationX += currentRotationSpeed.x;
    rotationY += currentRotationSpeed.y;
    rotationZ += currentRotationSpeed.z;
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawConnections();
    drawFloatingWords();
    drawVertexNumbers();
    drawVertexIndicator();
    
    updateRotation();
    requestAnimationFrame(draw);
}

// ============================================================================
// Start Application
// ============================================================================
initialize();
draw();
