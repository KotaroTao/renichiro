// 3D Cube Viewer - Main JavaScript

const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// State
const state = {
    rotationX: 0.5,
    rotationY: 0.5,
    rotationZ: 0,
    scale: 120,
    autoRotate: true,
    wireframe: false,
    cubeColor: '#4ecdc4',
    isDragging: false,
    lastMouseX: 0,
    lastMouseY: 0
};

// Cube vertices (unit cube centered at origin)
const vertices = [
    [-1, -1, -1], // 0: back-bottom-left
    [ 1, -1, -1], // 1: back-bottom-right
    [ 1,  1, -1], // 2: back-top-right
    [-1,  1, -1], // 3: back-top-left
    [-1, -1,  1], // 4: front-bottom-left
    [ 1, -1,  1], // 5: front-bottom-right
    [ 1,  1,  1], // 6: front-top-right
    [-1,  1,  1]  // 7: front-top-left
];

// Cube faces (indices into vertices array, ordered for proper face culling)
const faces = [
    { indices: [0, 1, 2, 3], color: '#ff6b6b', name: '背面' },   // Back
    { indices: [4, 7, 6, 5], color: '#4ecdc4', name: '前面' },   // Front
    { indices: [0, 3, 7, 4], color: '#ffe66d', name: '左面' },   // Left
    { indices: [1, 5, 6, 2], color: '#95e1d3', name: '右面' },   // Right
    { indices: [3, 2, 6, 7], color: '#f38181', name: '上面' },   // Top
    { indices: [0, 4, 5, 1], color: '#aa96da', name: '下面' }    // Bottom
];

// Edge connections for wireframe mode
const edges = [
    [0, 1], [1, 2], [2, 3], [3, 0], // Back face
    [4, 5], [5, 6], [6, 7], [7, 4], // Front face
    [0, 4], [1, 5], [2, 6], [3, 7]  // Connecting edges
];

// Matrix multiplication for 3D transformations
function multiplyMatrixVector(matrix, vector) {
    return [
        matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
        matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
        matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2]
    ];
}

// Rotation matrices
function rotateX(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [1, 0, 0],
        [0, cos, -sin],
        [0, sin, cos]
    ];
}

function rotateY(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [cos, 0, sin],
        [0, 1, 0],
        [-sin, 0, cos]
    ];
}

function rotateZ(angle) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return [
        [cos, -sin, 0],
        [sin, cos, 0],
        [0, 0, 1]
    ];
}

// Transform a vertex with current rotation
function transformVertex(vertex) {
    let result = [...vertex];
    result = multiplyMatrixVector(rotateX(state.rotationX), result);
    result = multiplyMatrixVector(rotateY(state.rotationY), result);
    result = multiplyMatrixVector(rotateZ(state.rotationZ), result);
    return result;
}

// Project 3D point to 2D screen coordinates
function project(vertex) {
    const fov = 400;
    const z = vertex[2] + 4; // Move cube away from camera
    const factor = fov / z;
    return {
        x: vertex[0] * factor * (state.scale / 100) + canvas.width / 2,
        y: -vertex[1] * factor * (state.scale / 100) + canvas.height / 2,
        z: vertex[2]
    };
}

// Calculate face normal for backface culling and shading
function calculateFaceNormal(face, transformedVertices) {
    const v0 = transformedVertices[face.indices[0]];
    const v1 = transformedVertices[face.indices[1]];
    const v2 = transformedVertices[face.indices[2]];

    // Two edge vectors
    const edge1 = [v1[0] - v0[0], v1[1] - v0[1], v1[2] - v0[2]];
    const edge2 = [v2[0] - v0[0], v2[1] - v0[1], v2[2] - v0[2]];

    // Cross product for normal
    return [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0]
    ];
}

// Adjust color brightness based on lighting
function shadeColor(color, factor) {
    const hex = color.replace('#', '');
    const r = Math.min(255, Math.max(0, Math.floor(parseInt(hex.substr(0, 2), 16) * factor)));
    const g = Math.min(255, Math.max(0, Math.floor(parseInt(hex.substr(2, 2), 16) * factor)));
    const b = Math.min(255, Math.max(0, Math.floor(parseInt(hex.substr(4, 2), 16) * factor)));
    return `rgb(${r}, ${g}, ${b})`;
}

// Main render function
function render() {
    // Clear canvas
    ctx.fillStyle = 'rgba(26, 26, 46, 0.3)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Transform all vertices
    const transformedVertices = vertices.map(v => transformVertex(v));
    const projectedVertices = transformedVertices.map(v => project(v));

    if (state.wireframe) {
        // Wireframe mode
        ctx.strokeStyle = state.cubeColor;
        ctx.lineWidth = 2;

        edges.forEach(edge => {
            const p1 = projectedVertices[edge[0]];
            const p2 = projectedVertices[edge[1]];

            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.stroke();
        });

        // Draw vertices as dots
        ctx.fillStyle = '#fff';
        projectedVertices.forEach(p => {
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    } else {
        // Solid mode with face sorting and shading
        const lightDir = [0.5, 0.8, 1]; // Light direction
        const lightMag = Math.sqrt(lightDir[0]**2 + lightDir[1]**2 + lightDir[2]**2);
        const normalizedLight = lightDir.map(v => v / lightMag);

        // Calculate face data for sorting and rendering
        const faceData = faces.map((face, index) => {
            const normal = calculateFaceNormal(face, transformedVertices);
            const normalMag = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
            const normalizedNormal = normal.map(v => v / normalMag);

            // Dot product with view direction (0, 0, 1) for backface culling
            const viewDot = normalizedNormal[2];

            // Dot product with light for shading
            const lightDot = normalizedNormal[0] * normalizedLight[0] +
                           normalizedNormal[1] * normalizedLight[1] +
                           normalizedNormal[2] * normalizedLight[2];

            // Calculate average Z for depth sorting
            const avgZ = face.indices.reduce((sum, i) => sum + transformedVertices[i][2], 0) / 4;

            return {
                face,
                index,
                viewDot,
                lightDot,
                avgZ,
                projectedPoints: face.indices.map(i => projectedVertices[i])
            };
        });

        // Sort faces by depth (painter's algorithm)
        faceData.sort((a, b) => a.avgZ - b.avgZ);

        // Render visible faces
        faceData.forEach(data => {
            // Backface culling - skip faces pointing away from camera
            if (data.viewDot < 0) return;

            const points = data.projectedPoints;
            const brightness = 0.4 + 0.6 * Math.max(0, data.lightDot);
            const color = shadeColor(data.face.color, brightness);

            // Draw filled face
            ctx.fillStyle = color;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(points[0].x, points[0].y);
            for (let i = 1; i < points.length; i++) {
                ctx.lineTo(points[i].x, points[i].y);
            }
            ctx.closePath();
            ctx.fill();
            ctx.stroke();

            // Draw face label
            const centerX = points.reduce((sum, p) => sum + p.x, 0) / 4;
            const centerY = points.reduce((sum, p) => sum + p.y, 0) / 4;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(data.face.name, centerX, centerY);
        });
    }

    // Update stats display
    updateStats();
}

function updateStats() {
    const rotXDeg = Math.round((state.rotationX * 180 / Math.PI) % 360);
    const rotYDeg = Math.round((state.rotationY * 180 / Math.PI) % 360);
    document.getElementById('rotX').textContent = rotXDeg;
    document.getElementById('rotY').textContent = rotYDeg;
    document.getElementById('zoom').textContent = state.scale;
}

// Animation loop
function animate() {
    if (state.autoRotate) {
        state.rotationY += 0.01;
        state.rotationX += 0.005;
    }
    render();
    requestAnimationFrame(animate);
}

// Event handlers
canvas.addEventListener('mousedown', (e) => {
    state.isDragging = true;
    state.lastMouseX = e.clientX;
    state.lastMouseY = e.clientY;
    state.autoRotate = false;
});

canvas.addEventListener('mousemove', (e) => {
    if (state.isDragging) {
        const deltaX = e.clientX - state.lastMouseX;
        const deltaY = e.clientY - state.lastMouseY;
        state.rotationY += deltaX * 0.01;
        state.rotationX += deltaY * 0.01;
        state.lastMouseX = e.clientX;
        state.lastMouseY = e.clientY;
    }
});

canvas.addEventListener('mouseup', () => {
    state.isDragging = false;
});

canvas.addEventListener('mouseleave', () => {
    state.isDragging = false;
});

canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    state.scale = Math.max(50, Math.min(200, state.scale - e.deltaY * 0.1));
});

// Keyboard controls
document.addEventListener('keydown', (e) => {
    const rotSpeed = 0.1;
    switch (e.key) {
        case 'ArrowUp':
            state.rotationX -= rotSpeed;
            state.autoRotate = false;
            break;
        case 'ArrowDown':
            state.rotationX += rotSpeed;
            state.autoRotate = false;
            break;
        case 'ArrowLeft':
            state.rotationY -= rotSpeed;
            state.autoRotate = false;
            break;
        case 'ArrowRight':
            state.rotationY += rotSpeed;
            state.autoRotate = false;
            break;
        case ' ':
            toggleAutoRotate();
            break;
    }
});

// Touch support for mobile
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    state.isDragging = true;
    state.lastMouseX = e.touches[0].clientX;
    state.lastMouseY = e.touches[0].clientY;
    state.autoRotate = false;
});

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (state.isDragging) {
        const deltaX = e.touches[0].clientX - state.lastMouseX;
        const deltaY = e.touches[0].clientY - state.lastMouseY;
        state.rotationY += deltaX * 0.01;
        state.rotationX += deltaY * 0.01;
        state.lastMouseX = e.touches[0].clientX;
        state.lastMouseY = e.touches[0].clientY;
    }
});

canvas.addEventListener('touchend', () => {
    state.isDragging = false;
});

// Control functions
function setView(view) {
    state.autoRotate = false;
    switch (view) {
        case 'front':
            state.rotationX = 0;
            state.rotationY = 0;
            state.rotationZ = 0;
            break;
        case 'top':
            state.rotationX = Math.PI / 2;
            state.rotationY = 0;
            state.rotationZ = 0;
            break;
        case 'side':
            state.rotationX = 0;
            state.rotationY = Math.PI / 2;
            state.rotationZ = 0;
            break;
        case 'corner':
            state.rotationX = Math.PI / 6;
            state.rotationY = Math.PI / 4;
            state.rotationZ = 0;
            break;
        case 'iso':
            state.rotationX = Math.atan(1 / Math.sqrt(2));
            state.rotationY = Math.PI / 4;
            state.rotationZ = 0;
            break;
    }
}

function toggleAutoRotate() {
    state.autoRotate = !state.autoRotate;
}

function resetRotation() {
    state.rotationX = 0.5;
    state.rotationY = 0.5;
    state.rotationZ = 0;
    state.scale = 120;
    state.autoRotate = true;
}

function toggleWireframe() {
    state.wireframe = !state.wireframe;
}

function setColor(color) {
    state.cubeColor = color;
    // Also update all face colors to variations of this color
    faces.forEach((face, i) => {
        const hueShift = i * 30;
        face.color = shiftHue(color, hueShift);
    });
}

function shiftHue(color, degrees) {
    const hex = color.replace('#', '');
    let r = parseInt(hex.substr(0, 2), 16) / 255;
    let g = parseInt(hex.substr(2, 2), 16) / 255;
    let b = parseInt(hex.substr(4, 2), 16) / 255;

    // RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
        }
    }

    // Shift hue
    h = (h + degrees / 360) % 1;
    if (h < 0) h += 1;

    // HSL to RGB
    function hue2rgb(p, q, t) {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1/6) return p + (q - p) * 6 * t;
        if (t < 1/2) return q;
        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
        return p;
    }

    if (s === 0) {
        r = g = b = l;
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    const toHex = x => {
        const hex = Math.round(x * 255).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

// Start the application
animate();
