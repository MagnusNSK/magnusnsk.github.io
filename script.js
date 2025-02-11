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
let activeMenu = null;
let ripples = [];
let wordCloudLocked = false;
let menuItemPositions = [];
let touchMoved = false;

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

function createRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    document.body.appendChild(ripple);
    
    ripples.push(ripple);
    
    ripple.addEventListener('animationend', () => {
        document.body.removeChild(ripple);
        ripples = ripples.filter(r => r !== ripple);
    });
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
        words: ["one-1", "One-1", "ONE-1", "oNE-1", "onE-1"]
    },
    { 
        point: [0, -250, 0].map(x => x * STAR_SCALE),
        words: ["two-2", "Two-2", "TWO-2", "tWOd-2", "twO-2"]
    },
    { 
        point: [250, 0, 0].map(x => x * STAR_SCALE),
        words: ["three-3", "Three-3", "THREE-3", "thREE-3", "thrEE-3"]
    },
    { 
        point: [-250, 0, 0].map(x => x * STAR_SCALE),
        words: ["four-4", "Four-4", "FOUR-4", "foUR-4", "fouR-4"]
    },
    { 
        point: [0, 0, 250].map(x => x * STAR_SCALE),
        words: ["five-5", "Five-5", "FIVE-5", "fiVE-5", "fivE-5"]
    },
    { 
        point: [0, 0, -250].map(x => x * STAR_SCALE),
        words: ["six-6", "Six-6", "SIX-6", "sIX-6", "siX-6"]
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
        this.changeTimer = Math.random() * 200 + 100; // Increased timer for more stability
        this.font = '10px "Space Mono", monospace';
    }

    getRandomWord() {
        return this.availableWords[Math.floor(Math.random() * this.availableWords.length)];
    }

    repositionInSphere() {
        const theta = Math.random() * 2 * Math.PI;
        const phi = Math.acos((Math.random() * 2) - 1);
        
        // Create stronger bias towards the center using a higher power curve
        const radiusBias = Math.pow(Math.random(), 2.5); // Increased power for stronger center bias
        const minRadius = 100 * STAR_SCALE;
        const maxRadius = 500 * STAR_SCALE; // Increased max radius
        const radius = minRadius + (maxRadius - minRadius) * radiusBias;
        
        this.x = radius * Math.sin(phi) * Math.cos(theta);
        this.y = radius * Math.sin(phi) * Math.sin(theta);
        this.z = radius * Math.cos(phi);
        
        // Adjust opacity based on distance from center with sharper falloff
        const distanceFromCenter = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
        const maxDistance = maxRadius;
        const normalizedDistance = distanceFromCenter / maxDistance;
        
        // Sharper opacity falloff
        this.baseOpacity = Math.max(0.1, 0.8 - Math.pow(normalizedDistance, 1.5));
        
        // Slower, more subtle fade
        this.fadeDirection = Math.random() < 0.5 ? -1 : 1;
        this.fadeSpeed = 0.0005 + Math.random() * 0.0005; // Much slower fade
        this.opacity = this.baseOpacity;
    }

    update() {
        this.opacity += this.fadeDirection * this.fadeSpeed;
        const minOpacity = Math.max(0.1, this.baseOpacity - 0.05);
        const maxOpacity = Math.min(0.8, this.baseOpacity + 0.05);
        
        if (this.opacity <= minOpacity || this.opacity >= maxOpacity) {
            this.fadeDirection *= -1;
            this.opacity = Math.max(minOpacity, Math.min(maxOpacity, this.opacity));
        }

        this.changeTimer--;
        if (this.changeTimer <= 0) {
            this.currentWord = this.getRandomWord();
            this.changeTimer = Math.random() * 200 + 100; // Longer word display time
        }
    }

    setAvailableWords(newWords) {
        if (this.availableWords !== newWords) {
            this.availableWords = newWords;
            this.changeTimer = Math.random() * 50;
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
        if (!wordCloudLocked) {
            updateFloatingWords(closestVertex);
        }
    } else if (previousVertex !== null && !wordCloudLocked) {
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
    
    // Clean up active menu on resize
    if (activeMenu) {
        document.body.removeChild(activeMenu);
        activeMenu = null;
    }
}

function handleMenuClick(x, y) {
    if (activeMenu) {
        const clickedItem = menuItemPositions.find(item => {
            const bounds = item.getBounds();
            return x >= bounds.left && 
                   x <= bounds.right && 
                   y >= bounds.top && 
                   y <= bounds.bottom;
        });

        if (clickedItem) {
            clickedItem.action();
            return true;  // Indicate we handled a menu click
        }
    }
    return false;  // No menu item was clicked
}

function handleMouseDown(e) {
    // Check for menu clicks first
    if (handleMenuClick(e.clientX, e.clientY)) {
        return;  // Stop here if we clicked a menu item
    }
    
    // Check for vertex clicks before starting drag
    const localMouseX = e.clientX - rect.left;
    const localMouseY = e.clientY - rect.top;
    
    vertexInfo.forEach((vertex, index) => {
        if (vertex.screenPosition) {
            const dx = localMouseX - vertex.screenPosition.x;
            const dy = localMouseY - vertex.screenPosition.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < vertex.screenPosition.radius) {
                createRipple(vertex.screenPosition.x, vertex.screenPosition.y);
                handleVertexClick(index);
                return;
            }
        }
    });
    
    // If we get here, start dragging
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
    
    // Only start auto-rotation if no menu is active
    if (!activeMenu) {
        autoRotationTimeout = setTimeout(() => {
            if (!isDragging && activeVertex === null) {
                setRotationState(true);
                resetDragState();
            }
        }, AUTO_ROTATION_DELAY);
    }
}

function handleTouchStart(e) {
    e.preventDefault();
    const touch = e.touches[0];
    
    touchMoved = false;
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
    e.preventDefault();
    const touch = e.touches[0];
    
    // Calculate movement distance
    const moveDistance = Math.sqrt(
        Math.pow(touch.clientX - touchStartX, 2) + 
        Math.pow(touch.clientY - touchStartY, 2)
    );
    
    // If we've moved more than a small threshold, mark as dragging
    if (moveDistance > 5) {
        touchMoved = true;
    }
    
    if (!isDragging) return;
    
    const currentTime = Date.now();
    const deltaTime = currentTime - lastDragTime;
    
    if (deltaTime > 0) {
        dragVelocityX = (touch.clientX - lastMouseX) / deltaTime;
        dragVelocityY = (touch.clientY - lastMouseY) / deltaTime;
    }
    
    rotationY += (touch.clientX - lastMouseX) * DRAG_SENSITIVITY * 0.8;
    rotationX += (touch.clientY - lastMouseY) * DRAG_SENSITIVITY * 0.8;
    
    lastMouseX = touch.clientX;
    lastMouseY = touch.clientY;
    lastDragTime = currentTime;
}

function handleTouchEnd(e) {
    if (!touchMoved) {
        // Only handle click if we haven't dragged
        const localX = lastMouseX - rect.left;
        const localY = lastMouseY - rect.top;
        
        // Check for menu clicks first
        if (handleMenuClick(lastMouseX, lastMouseY)) {
            isDragging = false;
            return;
        }
        
        // Check for vertex clicks
        vertexInfo.forEach((vertex, index) => {
            if (vertex.screenPosition) {
                const dx = localX - vertex.screenPosition.x;
                const dy = localY - vertex.screenPosition.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < vertex.screenPosition.radius * 1.5) {
                    createRipple(vertex.screenPosition.x, vertex.screenPosition.y);
                    handleVertexClick(index);
                }
            }
        });
    }
    
    isDragging = false;
    setRotationState(false);
    
    if (activeVertex === null) {
        startAutoRotationTimer();
    }
}

// Add this new function to handle touch hover simulation
function handleTouchHover(x, y) {
    const localX = x - rect.left;
    const localY = y - rect.top;
    const closestVertex = findClosestVertex(localX, localY);
    handleVertexHover(closestVertex);
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
    
    // Create more words but they'll be more concentrated in the center
    floatingWords = Array(200).fill(null).map(() => new FloatingWord());
    
    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseleave', handleMouseUp);
    
    // Update touch event listeners
    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);
    canvas.addEventListener('touchcancel', handleTouchEnd);
    
    // Prevent default touch behaviors on the canvas
    canvas.style.touchAction = 'none';
    
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

function updateMenuPosition() {
    if (activeMenu) {
        const vertexIndex = parseInt(activeMenu.dataset.vertexIndex);
        const vertex = vertexInfo[vertexIndex];
        const rotated = rotate3D(vertex.point, rotationX, rotationY, rotationZ);
        const scale = PERSPECTIVE.scale(rotated[2]);
        
        // Calculate direction vector from center to point
        const dx = rotated[0];
        const dy = rotated[1];
        const length = Math.sqrt(dx * dx + dy * dy);
        
        // Position menu along this vector
        const menuDistance = 60; // Same distance as in handleClick
        const screenX = (rotated[0] + (dx / length) * menuDistance) * scale + canvas.width / 2;
        const screenY = (rotated[1] + (dy / length) * menuDistance) * scale + canvas.height / 2;
        
        activeMenu.style.left = `${screenX}px`;
        activeMenu.style.top = `${screenY}px`;
    }
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    drawConnections();
    drawFloatingWords();
    drawVertexNumbers();
    drawVertexIndicator();
    updateMenuPosition();
    
    updateRotation();
    requestAnimationFrame(draw);
}

// ============================================================================
// Start Application
// ============================================================================
initialize();
draw();

// ============================================================================
// Menu Configuration
// ============================================================================
const menuConfigs = {
    tools: {
        title: 'TOOLS',
        items: [
            { 
                label: 'nsk utility', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://github.com/MagnusNSK/nsk-utility';
                    }
                }
            }
        ]
    },
    about: {
        title: 'ABOUT',
        items: [
            { 
                label: 'documents', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://github.com/MagnusNSK/documents';
                    }
                }
            },
            { label: 'incomplete', action: () => console.log('Not complete...') }
        ]
    },
    config: {
        title: 'CONFIG',
        items: [
            { 
                label: 'dot files', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://github.com/MagnusNSK/documents/tree/main/dot-files';
                    }
                }
            }
        ]
    },
    media: {
        title: 'MEDIA',
        items: [
            { label: 'incomplete', action: () => console.log('Not complete...') },
            { label: 'incomplete', action: () => console.log('Not complete...') }
        ]
    },
    links: {
        title: 'LINKS',
        items: [
            { 
                label: 'x.com', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://x.com/MagnusNSK';
                    }
                }
            },
            { 
                label: 'itch.io', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://magnusnsk.itch.io/';
                    }
                }
            },
            { 
                label: 'youtube.com', 
                action: () => {
                    const win = window.open();
                    if (win) {
                        win.opener = null;
                        win.location = 'https://www.youtube.com/@oloffnsk';
                    }
                }
            }
        ]
    },
    null: {
        title: 'NULL',
        items: [
            { label: 'incomplete', action: () => console.log('Not complete...') },
            { label: 'incomplete', action: () => console.log('Not complete...') },
            { label: 'incomplete', action: () => console.log('Not complete...') }
        ]
    }
};

function getMenuConfig(index) {
    const configKeys = ['tools', 'about', 'config', 'media', 'links', 'null'];
    return menuConfigs[configKeys[index]];
}

function createVertexMenu(index) {
    const menu = document.createElement('div');
    menu.className = 'vertex-menu';
    menu.id = `vertex-menu-${index}`;
    menuItemPositions = [];  // Reset positions array
    
    const config = getMenuConfig(index);
    
    const header = document.createElement('div');
    header.className = 'vertex-menu-header';
    header.textContent = config.title;
    menu.appendChild(header);
    
    config.items.forEach((item, itemIndex) => {
        const menuItem = document.createElement('div');
        menuItem.className = 'vertex-menu-item';
        menuItem.textContent = item.label;
        menuItem.dataset.index = itemIndex;
        menu.appendChild(menuItem);
        
        // Store the item's action for later use
        menuItemPositions.push({
            action: item.action,
            getBounds: () => {
                const rect = menuItem.getBoundingClientRect();
                return {
                    left: rect.left,
                    right: rect.right,
                    top: rect.top,
                    bottom: rect.bottom
                };
            }
        });
    });
    
    document.body.appendChild(menu);
    return menu;
}

function handleVertexClick(index) {
    if (activeMenu) {
        if (activeMenu.dataset.vertexIndex === index.toString()) {
            activeMenu.classList.add('removing');
            activeMenu.addEventListener('transitionend', () => {
                if (activeMenu && activeMenu.parentNode) {
                    try {
                        document.body.removeChild(activeMenu);
                    } catch (e) {
                        console.log('Menu already removed');
                    }
                }
            }, { once: true });
            activeMenu = null;
            wordCloudLocked = false;
            menuItemPositions = [];
            return;
        } else {
            try {
                if (activeMenu.parentNode) {
                    document.body.removeChild(activeMenu);
                }
            } catch (e) {
                console.log('Menu already removed');
            }
            menuItemPositions = [];
        }
    }
    
    const menu = createVertexMenu(index);
    menu.dataset.vertexIndex = index;
    
    wordCloudLocked = true;
    updateFloatingWords(index);
    
    const vertex = vertexInfo[index];
    const rotated = rotate3D(vertex.point, rotationX, rotationY, rotationZ);
    const scale = PERSPECTIVE.scale(rotated[2]);
    
    const dx = rotated[0];
    const dy = rotated[1];
    const length = Math.sqrt(dx * dx + dy * dy);
    
    const menuDistance = 60;
    const screenX = (rotated[0] + (dx / length) * menuDistance) * scale + canvas.width / 2;
    const screenY = (rotated[1] + (dy / length) * menuDistance) * scale + canvas.height / 2;
    
    menu.style.left = `${screenX}px`;
    menu.style.top = `${screenY}px`;
    
    requestAnimationFrame(() => {
        menu.classList.add('active');
    });
    
    activeMenu = menu;
    activatePoint(index);
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
