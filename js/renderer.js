// js/renderer.js
export class SchematicRenderer {
    constructor(canvas, schematic) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.schematic = schematic;
        this.currentLayer = 0;
        
        // Settings
        this.showGrid = true;
        this.showGhost = true;
        this.cellSize = 40; // Pixels per block
        
        // Camera
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;

        // Touch handling state
        this.isDragging = false;
        this.lastX = 0;
        this.lastY = 0;
        this.initialPinchDist = null;
        this.touchStartY = 0;
        this.touchStartTime = 0;

        this.resize();
        window.addEventListener('resize', () => this.resize());
        this.setupTouch();
        this.draw();
    }

    resize() {
        // Handle high-DPI displays safely
        const rect = this.canvas.parentElement.getBoundingClientRect();
        this.canvas.width = rect.width * window.devicePixelRatio;
        this.canvas.height = rect.height * window.devicePixelRatio;
        this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        // Center the build initially
        this.offsetX = (rect.width / 2) - ((this.schematic.width * this.cellSize) / 2);
        this.offsetY = (rect.height / 2) - ((this.schematic.length * this.cellSize) / 2);
        this.draw();
    }

    setLayer(y) {
        this.currentLayer = y;
        // Security: textContent prevents DOM injection
        document.getElementById('layer-indicator').textContent = `Layer ${y + 1} of ${this.schematic.height}`;
        this.updateBlockCount();
        this.draw();
    }

    updateBlockCount() {
        const layer = this.schematic.getLayer(this.currentLayer);
        let count = 0;
        for (let z = 0; z < this.schematic.length; z++) {
            for (let x = 0; x < this.schematic.width; x++) {
                if (layer[z][x].primary || layer[z][x].secondary) count++;
            }
        }
        document.getElementById('total-blocks').textContent = count;
    }

    setupTouch() {
        // Pointer events handle both mouse and single-touch
        this.canvas.addEventListener('pointerdown', (e) => {
            this.isDragging = true;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.touchStartY = e.clientY;
            this.touchStartTime = Date.now();
            this.canvas.setPointerCapture(e.pointerId);
        });

        this.canvas.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const dx = e.clientX - this.lastX;
            const dy = e.clientY - this.lastY;
            this.offsetX += dx;
            this.offsetY += dy;
            this.lastX = e.clientX;
            this.lastY = e.clientY;
            this.draw();
        });

        this.canvas.addEventListener('pointerup', (e) => {
            this.isDragging = false;
            const timeDiff = Date.now() - this.touchStartTime;
            const yDiff = e.clientY - this.touchStartY;
            
            // Swipe Detection: Fast Y movement = change layer
            if (timeDiff < 300 && Math.abs(yDiff) > 50) {
                if (yDiff > 0 && this.currentLayer > 0) this.setLayer(this.currentLayer - 1);
                else if (yDiff < 0 && this.currentLayer < this.schematic.height - 1) this.setLayer(this.currentLayer + 1);
            } else if (timeDiff < 200 && Math.abs(yDiff) < 10) {
                // Tap Detection: get block info
                this.handleTap(e.clientX, e.clientY);
            }
            this.canvas.releasePointerCapture(e.pointerId);
        });

        // Pinch to zoom (Standard Touch API required for multi-touch)
        this.canvas.addEventListener('touchmove', (e) => {
            if (e.touches.length === 2) {
                e.preventDefault(); // Stop page scaling
                const dist = Math.hypot(
                    e.touches[0].clientX - e.touches[1].clientX,
                    e.touches[0].clientY - e.touches[1].clientY
                );
                if (!this.initialPinchDist) {
                    this.initialPinchDist = dist;
                } else {
                    const delta = dist / this.initialPinchDist;
                    // Cap zoom to safe bounds
                    this.scale = Math.max(0.5, Math.min(this.scale * delta, 3));
                    this.initialPinchDist = dist;
                    this.draw();
                }
            }
        }, { passive: false });

        this.canvas.addEventListener('touchend', () => {
            this.initialPinchDist = null;
        });
    }

    handleTap(clientX, clientY) {
        // Convert screen coordinates to grid coordinates
        const rect = this.canvas.getBoundingClientRect();
        const x = Math.floor(((clientX - rect.left) - this.offsetX) / (this.cellSize * this.scale));
        const z = Math.floor(((clientY - rect.top) - this.offsetY) / (this.cellSize * this.scale));
        
        if (x >= 0 && x < this.schematic.width && z >= 0 && z < this.schematic.length) {
            const cell = this.schematic.grid[this.currentLayer][z][x];
            let msg = `Empty (${x}, ${this.currentLayer}, ${z})`;
            if (cell.primary) {
                msg = `${cell.primary.id.replace('minecraft:', '')} \nStates: ${JSON.stringify(cell.primary.states)}`;
            }
            if (cell.secondary) {
                msg += `\nWaterlogged: ${cell.secondary.id.replace('minecraft:', '')}`;
            }
            this.showToast(msg);
        }
    }

    showToast(msg) {
        const toast = document.getElementById('block-info-toast');
        toast.textContent = msg; // Security: no innerHTML
        toast.classList.remove('hidden');
        clearTimeout(this.toastTimer);
        this.toastTimer = setTimeout(() => toast.classList.add('hidden'), 3000);
    }

    draw() {
        // Read theme colors from CSS variables safely
        const style = getComputedStyle(document.body);
        const gridColor = style.getPropertyValue('--grid-line').trim();
        const bgColor = style.getPropertyValue('--bg-color').trim();

        // Clear canvas
        const rect = this.canvas.getBoundingClientRect();
        this.ctx.fillStyle = bgColor;
        this.ctx.fillRect(0, 0, rect.width, rect.height);

        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);

        // Draw Ghost Layer (Layer below)
        if (this.showGhost && this.currentLayer > 0) {
            this.ctx.globalAlpha = 0.3;
            this.drawLayerBlocks(this.currentLayer - 1);
            this.ctx.globalAlpha = 1.0;
        }

        // Draw Current Layer
        this.drawLayerBlocks(this.currentLayer);

        // Draw Grid with 16x16 Chunk Highlights
        if (this.showGrid) {
            this.ctx.strokeStyle = gridColor;
            for (let z = 0; z <= this.schematic.length; z++) {
                this.ctx.lineWidth = (z % 16 === 0) ? 2 : 0.5; // Chunk boundary
                this.ctx.beginPath();
                this.ctx.moveTo(0, z * this.cellSize);
                this.ctx.lineTo(this.schematic.width * this.cellSize, z * this.cellSize);
                this.ctx.stroke();
            }
            for (let x = 0; x <= this.schematic.width; x++) {
                this.ctx.lineWidth = (x % 16 === 0) ? 2 : 0.5; // Chunk boundary
                this.ctx.beginPath();
                this.ctx.moveTo(x * this.cellSize, 0);
                this.ctx.lineTo(x * this.cellSize, this.schematic.length * this.cellSize);
                this.ctx.stroke();
            }
        }
        
        this.ctx.restore();
    }

    drawLayerBlocks(y) {
        const layer = this.schematic.getLayer(y);
        for (let z = 0; z < this.schematic.length; z++) {
            for (let x = 0; x < this.schematic.width; x++) {
                const cell = layer[z][x];
                
                // Temporary Hardcoded Colors until texture system is built
                if (cell.primary) {
                    this.ctx.fillStyle = this.getColorForBlock(cell.primary.id);
                    this.ctx.fillRect(x * this.cellSize, z * this.cellSize, this.cellSize, this.cellSize);
                }
                
                // Draw Secondary layer (Water) overlay
                if (cell.secondary) {
                    this.ctx.fillStyle = 'rgba(52, 152, 219, 0.5)'; // Transparent Blue
                    this.ctx.fillRect(x * this.cellSize, z * this.cellSize, this.cellSize, this.cellSize);
                }
            }
        }
    }

    getColorForBlock(id) {
        // Fallbacks for the sample build
        if (id.includes('stone')) return '#7f8c8d';
        if (id.includes('wood') || id.includes('oak')) return '#a0522d';
        if (id.includes('repeater') || id.includes('redstone')) return '#c0392b';
        return '#95a5a6';
    }
}
