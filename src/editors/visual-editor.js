// Comprehensive Visual Editor System
// Sprite Editor, Tilemap Editor, Scene Composer, and Animation Tools

class VisualEditor {
    constructor(engine) {
        this.engine = engine;
        this.currentTool = 'select';
        this.currentMode = 'scene'; // scene, sprite, tilemap, animation
        
        // Editor state
        this.camera = { x: 0, y: 0, zoom: 1 };
        this.selection = new Set();
        this.clipboard = null;
        this.history = new UndoRedoSystem();
        this.grid = { enabled: true, size: 32, snap: true };
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.overlayCanvas = null;
        this.overlayCtx = null;
        
        // Input handling
        this.mouse = { x: 0, y: 0, down: false, button: 0 };
        this.keys = new Set();
        this.inputHandlers = new Map();
        
        // Editor modules
        this.spriteEditor = new SpriteEditor(this);
        this.tilemapEditor = new TilemapEditor(this);
        this.sceneComposer = new SceneComposer(this);
        this.animationEditor = new AnimationEditor(this);
        
        this.initializeEditor();
    }
    
    initializeEditor() {
        this.setupCanvas();
        this.setupInputHandlers();
        this.setupUI();
        this.registerTools();
    }
    
    setupCanvas() {
        // Main canvas for content
        this.canvas = document.getElementById('editorCanvas') || this.createCanvas('editorCanvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Overlay canvas for UI elements
        this.overlayCanvas = this.createCanvas('editorOverlay');
        this.overlayCtx = this.overlayCanvas.getContext('2d');
        
        // Position overlay on top
        this.overlayCanvas.style.position = 'absolute';
        this.overlayCanvas.style.pointerEvents = 'none';
        this.overlayCanvas.style.top = this.canvas.offsetTop + 'px';
        this.overlayCanvas.style.left = this.canvas.offsetLeft + 'px';
    }
    
    createCanvas(id) {
        const canvas = document.createElement('canvas');
        canvas.id = id;
        canvas.width = 800;
        canvas.height = 600;
        canvas.style.border = '1px solid rgba(139, 69, 19, 0.3)';
        canvas.style.borderRadius = '8px';
        canvas.style.background = '#0a0a0f';
        
        const container = document.getElementById('canvasContainer');
        if (container) {
            container.appendChild(canvas);
        }
        
        return canvas;
    }
    
    setupInputHandlers() {
        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());
        
        // Keyboard events
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
        
        // Drag and drop
        this.canvas.addEventListener('dragover', (e) => e.preventDefault());
        this.canvas.addEventListener('drop', (e) => this.handleDrop(e));
    }
    
    setupUI() {
        this.createToolbar();
        this.createPropertyPanel();
        this.createLayerPanel();
        this.createAssetBrowser();
    }
    
    createToolbar() {
        const toolbar = document.createElement('div');
        toolbar.className = 'editor-toolbar';
        toolbar.innerHTML = `
            <div class="tool-group">
                <button class="tool-btn active" data-tool="select" title="Select (V)">
                    <span class="tool-icon">⚊</span>
                </button>
                <button class="tool-btn" data-tool="move" title="Move (M)">
                    <span class="tool-icon">✋</span>
                </button>
                <button class="tool-btn" data-tool="paint" title="Paint (B)">
                    <span class="tool-icon">🖌</span>
                </button>
                <button class="tool-btn" data-tool="erase" title="Erase (E)">
                    <span class="tool-icon">🧽</span>
                </button>
                <button class="tool-btn" data-tool="fill" title="Fill (F)">
                    <span class="tool-icon">🪣</span>
                </button>
            </div>
            
            <div class="tool-group">
                <button class="mode-btn active" data-mode="scene" title="Scene Editor">Scene</button>
                <button class="mode-btn" data-mode="sprite" title="Sprite Editor">Sprite</button>
                <button class="mode-btn" data-mode="tilemap" title="Tilemap Editor">Tilemap</button>
                <button class="mode-btn" data-mode="animation" title="Animation Editor">Animation</button>
            </div>
            
            <div class="tool-group">
                <button class="action-btn" data-action="undo" title="Undo (Ctrl+Z)">↶</button>
                <button class="action-btn" data-action="redo" title="Redo (Ctrl+Y)">↷</button>
                <button class="action-btn" data-action="copy" title="Copy (Ctrl+C)">📋</button>
                <button class="action-btn" data-action="paste" title="Paste (Ctrl+V)">📄</button>
            </div>
            
            <div class="tool-group">
                <label class="grid-toggle">
                    <input type="checkbox" id="gridToggle" checked />
                    Grid
                </label>
                <input type="range" id="zoomSlider" min="0.1" max="5" step="0.1" value="1" />
                <span id="zoomDisplay">100%</span>
            </div>
        `;
        
        document.body.insertBefore(toolbar, document.body.firstChild);
        this.setupToolbarEvents(toolbar);
    }
    
    setupToolbarEvents(toolbar) {
        // Tool selection
        toolbar.addEventListener('click', (e) => {
            if (e.target.dataset.tool) {
                this.setTool(e.target.dataset.tool);
                this.updateToolbarState();
            }
            
            if (e.target.dataset.mode) {
                this.setMode(e.target.dataset.mode);
                this.updateToolbarState();
            }
            
            if (e.target.dataset.action) {
                this.executeAction(e.target.dataset.action);
            }
        });
        
        // Grid toggle
        const gridToggle = toolbar.querySelector('#gridToggle');
        gridToggle.addEventListener('change', (e) => {
            this.grid.enabled = e.target.checked;
            this.render();
        });
        
        // Zoom control
        const zoomSlider = toolbar.querySelector('#zoomSlider');
        const zoomDisplay = toolbar.querySelector('#zoomDisplay');
        
        zoomSlider.addEventListener('input', (e) => {
            this.camera.zoom = parseFloat(e.target.value);
            zoomDisplay.textContent = Math.round(this.camera.zoom * 100) + '%';
            this.render();
        });
    }
    
    createPropertyPanel() {
        const panel = document.createElement('div');
        panel.className = 'property-panel';
        panel.innerHTML = `
            <div class="panel-header">Properties</div>
            <div class="property-content" id="propertyContent">
                <div class="property-item">
                    <label>X Position:</label>
                    <input type="number" id="propX" value="0" />
                </div>
                <div class="property-item">
                    <label>Y Position:</label>
                    <input type="number" id="propY" value="0" />
                </div>
                <div class="property-item">
                    <label>Width:</label>
                    <input type="number" id="propWidth" value="32" />
                </div>
                <div class="property-item">
                    <label>Height:</label>
                    <input type="number" id="propHeight" value="32" />
                </div>
                <div class="property-item">
                    <label>Rotation:</label>
                    <input type="range" id="propRotation" min="0" max="360" value="0" />
                    <span id="rotationDisplay">0°</span>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupPropertyEvents(panel);
    }
    
    setupPropertyEvents(panel) {
        const inputs = panel.querySelectorAll('input');
        inputs.forEach(input => {
            input.addEventListener('input', (e) => {
                this.updateSelectedEntities(e.target.id, e.target.value);
            });
        });
    }
    
    createLayerPanel() {
        const panel = document.createElement('div');
        panel.className = 'layer-panel';
        panel.innerHTML = `
            <div class="panel-header">
                Layers
                <button class="add-layer-btn" title="Add Layer">+</button>
            </div>
            <div class="layer-list" id="layerList">
                <div class="layer-item active" data-layer="0">
                    <span class="layer-name">Background</span>
                    <div class="layer-controls">
                        <button class="layer-visible" title="Toggle Visibility">👁</button>
                        <button class="layer-lock" title="Lock Layer">🔓</button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    createAssetBrowser() {
        const panel = document.createElement('div');
        panel.className = 'asset-browser';
        panel.innerHTML = `
            <div class="panel-header">
                Assets
                <button class="import-asset-btn" title="Import Asset">📂</button>
            </div>
            <div class="asset-grid" id="assetGrid">
                <!-- Assets will be populated dynamically -->
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    registerTools() {
        this.inputHandlers.set('select', new SelectTool(this));
        this.inputHandlers.set('move', new MoveTool(this));
        this.inputHandlers.set('paint', new PaintTool(this));
        this.inputHandlers.set('erase', new EraseTool(this));
        this.inputHandlers.set('fill', new FillTool(this));
    }
    
    // Tool and mode management
    setTool(tool) {
        this.currentTool = tool;
        this.canvas.style.cursor = this.getToolCursor(tool);
    }
    
    setMode(mode) {
        this.currentMode = mode;
        this.updateUIForMode(mode);
    }
    
    getToolCursor(tool) {
        const cursors = {
            select: 'default',
            move: 'move',
            paint: 'crosshair',
            erase: 'crosshair',
            fill: 'crosshair'
        };
        return cursors[tool] || 'default';
    }
    
    updateUIForMode(mode) {
        // Show/hide relevant panels based on mode
        const panels = {
            scene: ['property-panel', 'layer-panel', 'asset-browser'],
            sprite: ['property-panel', 'color-palette'],
            tilemap: ['property-panel', 'layer-panel', 'tileset-panel'],
            animation: ['property-panel', 'timeline-panel', 'onion-skin']
        };
        
        // Hide all panels first
        document.querySelectorAll('.editor-panel').forEach(panel => {
            panel.style.display = 'none';
        });
        
        // Show relevant panels
        if (panels[mode]) {
            panels[mode].forEach(panelClass => {
                const panel = document.querySelector(`.${panelClass}`);
                if (panel) panel.style.display = 'block';
            });
        }
    }
    
    updateToolbarState() {
        // Update active states
        document.querySelectorAll('.tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === this.currentTool);
        });
        
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === this.currentMode);
        });
    }
    
    // Input handling
    handleMouseDown(e) {
        this.mouse.down = true;
        this.mouse.button = e.button;
        this.updateMousePosition(e);
        
        const tool = this.inputHandlers.get(this.currentTool);
        if (tool && tool.onMouseDown) {
            tool.onMouseDown(this.mouse);
        }
    }
    
    handleMouseMove(e) {
        this.updateMousePosition(e);
        
        if (this.mouse.down) {
            const tool = this.inputHandlers.get(this.currentTool);
            if (tool && tool.onMouseDrag) {
                tool.onMouseDrag(this.mouse);
            }
        } else {
            const tool = this.inputHandlers.get(this.currentTool);
            if (tool && tool.onMouseMove) {
                tool.onMouseMove(this.mouse);
            }
        }
        
        this.render();
    }
    
    handleMouseUp(e) {
        this.mouse.down = false;
        this.updateMousePosition(e);
        
        const tool = this.inputHandlers.get(this.currentTool);
        if (tool && tool.onMouseUp) {
            tool.onMouseUp(this.mouse);
        }
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey || e.metaKey) {
            // Zoom
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.camera.zoom = Math.max(0.1, Math.min(5, this.camera.zoom * zoomFactor));
        } else {
            // Pan
            this.camera.x -= e.deltaX;
            this.camera.y -= e.deltaY;
        }
        
        this.render();
    }
    
    handleKeyDown(e) {
        this.keys.add(e.key.toLowerCase());
        
        // Global shortcuts
        if (e.ctrlKey || e.metaKey) {
            switch (e.key.toLowerCase()) {
                case 'z':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.history.redo();
                    } else {
                        this.history.undo();
                    }
                    break;
                case 'y':
                    e.preventDefault();
                    this.history.redo();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copySelection();
                    break;
                case 'v':
                    e.preventDefault();
                    this.pasteFromClipboard();
                    break;
                case 's':
                    e.preventDefault();
                    this.saveProject();
                    break;
            }
        }
        
        // Tool shortcuts
        const toolShortcuts = {
            'v': 'select',
            'm': 'move',
            'b': 'paint',
            'e': 'erase',
            'f': 'fill'
        };
        
        if (toolShortcuts[e.key.toLowerCase()]) {
            this.setTool(toolShortcuts[e.key.toLowerCase()]);
            this.updateToolbarState();
        }
    }
    
    handleKeyUp(e) {
        this.keys.delete(e.key.toLowerCase());
    }
    
    handleDrop(e) {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        
        files.forEach(file => {
            if (file.type.startsWith('image/')) {
                this.importImage(file);
            }
        });
    }
    
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = (e.clientX - rect.left - this.camera.x) / this.camera.zoom;
        this.mouse.y = (e.clientY - rect.top - this.camera.y) / this.camera.zoom;
        
        // Grid snapping
        if (this.grid.snap && this.keys.has('shift')) {
            this.mouse.x = Math.round(this.mouse.x / this.grid.size) * this.grid.size;
            this.mouse.y = Math.round(this.mouse.y / this.grid.size) * this.grid.size;
        }
    }
    
    // Rendering
    render() {
        this.clearCanvas();
        
        switch (this.currentMode) {
            case 'scene':
                this.sceneComposer.render();
                break;
            case 'sprite':
                this.spriteEditor.render();
                break;
            case 'tilemap':
                this.tilemapEditor.render();
                break;
            case 'animation':
                this.animationEditor.render();
                break;
        }
        
        this.renderOverlay();
    }
    
    clearCanvas() {
        this.ctx.save();
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();
        
        this.overlayCtx.save();
        this.overlayCtx.setTransform(1, 0, 0, 1, 0, 0);
        this.overlayCtx.clearRect(0, 0, this.overlayCanvas.width, this.overlayCanvas.height);
        this.overlayCtx.restore();
    }
    
    renderOverlay() {
        this.overlayCtx.save();
        this.overlayCtx.translate(this.camera.x, this.camera.y);
        this.overlayCtx.scale(this.camera.zoom, this.camera.zoom);
        
        // Render grid
        if (this.grid.enabled) {
            this.renderGrid();
        }
        
        // Render selection
        this.renderSelection();
        
        // Render tool overlay
        const tool = this.inputHandlers.get(this.currentTool);
        if (tool && tool.renderOverlay) {
            tool.renderOverlay(this.overlayCtx);
        }
        
        this.overlayCtx.restore();
    }
    
    renderGrid() {
        const ctx = this.overlayCtx;
        const size = this.grid.size;
        const width = this.canvas.width / this.camera.zoom;
        const height = this.canvas.height / this.camera.zoom;
        
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.2)';
        ctx.lineWidth = 1 / this.camera.zoom;
        
        ctx.beginPath();
        
        // Vertical lines
        for (let x = 0; x <= width; x += size) {
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
        }
        
        // Horizontal lines
        for (let y = 0; y <= height; y += size) {
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
        }
        
        ctx.stroke();
    }
    
    renderSelection() {
        if (this.selection.size === 0) return;
        
        const ctx = this.overlayCtx;
        ctx.strokeStyle = '#00ff88';
        ctx.lineWidth = 2 / this.camera.zoom;
        ctx.setLineDash([5 / this.camera.zoom, 5 / this.camera.zoom]);
        
        for (const entityId of this.selection) {
            const transform = this.engine.getComponent(entityId, 'Transform');
            const sprite = this.engine.getComponent(entityId, 'Sprite');
            
            if (transform && sprite) {
                ctx.strokeRect(
                    transform.x - sprite.width / 2,
                    transform.y - sprite.height / 2,
                    sprite.width,
                    sprite.height
                );
            }
        }
        
        ctx.setLineDash([]);
    }
    
    // Selection management
    selectEntity(entityId) {
        this.selection.clear();
        this.selection.add(entityId);
        this.updatePropertyPanel();
    }
    
    addToSelection(entityId) {
        this.selection.add(entityId);
        this.updatePropertyPanel();
    }
    
    removeFromSelection(entityId) {
        this.selection.delete(entityId);
        this.updatePropertyPanel();
    }
    
    clearSelection() {
        this.selection.clear();
        this.updatePropertyPanel();
    }
    
    updatePropertyPanel() {
        const content = document.getElementById('propertyContent');
        if (!content) return;
        
        if (this.selection.size === 1) {
            const entityId = Array.from(this.selection)[0];
            const transform = this.engine.getComponent(entityId, 'Transform');
            const sprite = this.engine.getComponent(entityId, 'Sprite');
            
            if (transform) {
                document.getElementById('propX').value = transform.x;
                document.getElementById('propY').value = transform.y;
                document.getElementById('propRotation').value = transform.rotation * 180 / Math.PI;
            }
            
            if (sprite) {
                document.getElementById('propWidth').value = sprite.width;
                document.getElementById('propHeight').value = sprite.height;
            }
        }
    }
    
    updateSelectedEntities(property, value) {
        for (const entityId of this.selection) {
            const numValue = parseFloat(value);
            
            switch (property) {
                case 'propX':
                    this.engine.updateComponent(entityId, 'Transform', { x: numValue });
                    break;
                case 'propY':
                    this.engine.updateComponent(entityId, 'Transform', { y: numValue });
                    break;
                case 'propWidth':
                    this.engine.updateComponent(entityId, 'Sprite', { width: numValue });
                    break;
                case 'propHeight':
                    this.engine.updateComponent(entityId, 'Sprite', { height: numValue });
                    break;
                case 'propRotation':
                    this.engine.updateComponent(entityId, 'Transform', { rotation: numValue * Math.PI / 180 });
                    document.getElementById('rotationDisplay').textContent = Math.round(numValue) + '°';
                    break;
            }
        }
        
        this.render();
    }
    
    // Actions
    executeAction(action) {
        switch (action) {
            case 'undo':
                this.history.undo();
                break;
            case 'redo':
                this.history.redo();
                break;
            case 'copy':
                this.copySelection();
                break;
            case 'paste':
                this.pasteFromClipboard();
                break;
        }
    }
    
    copySelection() {
        if (this.selection.size === 0) return;
        
        this.clipboard = [];
        for (const entityId of this.selection) {
            const entityData = { components: {} };
            const entity = this.engine.entities.get(entityId);
            
            for (const componentType of entity.components) {
                entityData.components[componentType] = { ...this.engine.getComponent(entityId, componentType) };
            }
            
            this.clipboard.push(entityData);
        }
    }
    
    pasteFromClipboard() {
        if (!this.clipboard || this.clipboard.length === 0) return;
        
        this.clearSelection();
        
        for (const entityData of this.clipboard) {
            const newEntityId = this.engine.createEntity();
            
            for (const [componentType, componentData] of Object.entries(entityData.components)) {
                // Offset position for pasted entities
                if (componentType === 'Transform') {
                    componentData.x += 32;
                    componentData.y += 32;
                }
                
                this.engine.addComponent(newEntityId, componentType, componentData);
            }
            
            this.addToSelection(newEntityId);
        }
        
        this.render();
    }
    
    importImage(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                // Create new entity with sprite component
                const entityId = this.engine.createEntity({
                    Transform: { x: 100, y: 100 },
                    Sprite: { 
                        texture: img,
                        width: img.width,
                        height: img.height
                    }
                });
                
                this.selectEntity(entityId);
                this.render();
            };
            img.src = e.target.result;
        };
        reader.readAsDataURL(file);
    }
    
    saveProject() {
        const projectData = this.engine.serialize();
        const blob = new Blob([JSON.stringify(projectData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'project.json';
        link.click();
        
        URL.revokeObjectURL(url);
    }
    
    // World to screen coordinate conversion
    worldToScreen(worldX, worldY) {
        return {
            x: (worldX * this.camera.zoom) + this.camera.x,
            y: (worldY * this.camera.zoom) + this.camera.y
        };
    }
    
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.camera.x) / this.camera.zoom,
            y: (screenY - this.camera.y) / this.camera.zoom
        };
    }
}

// Editor Tools
class SelectTool {
    constructor(editor) {
        this.editor = editor;
        this.dragStart = null;
        this.selectionBox = null;
    }
    
    onMouseDown(mouse) {
        // Check if clicking on an entity
        const entityId = this.getEntityAtPosition(mouse.x, mouse.y);
        
        if (entityId) {
            if (!this.editor.keys.has('shift')) {
                this.editor.clearSelection();
            }
            this.editor.addToSelection(entityId);
        } else {
            // Start selection box
            this.dragStart = { x: mouse.x, y: mouse.y };
            this.selectionBox = { x: mouse.x, y: mouse.y, width: 0, height: 0 };
            
            if (!this.editor.keys.has('shift')) {
                this.editor.clearSelection();
            }
        }
    }
    
    onMouseDrag(mouse) {
        if (this.dragStart) {
            this.selectionBox.width = mouse.x - this.dragStart.x;
            this.selectionBox.height = mouse.y - this.dragStart.y;
        }
    }
    
    onMouseUp(mouse) {
        if (this.selectionBox && (Math.abs(this.selectionBox.width) > 5 || Math.abs(this.selectionBox.height) > 5)) {
            // Select entities in box
            const entities = this.getEntitiesInBox(this.selectionBox);
            entities.forEach(entityId => this.editor.addToSelection(entityId));
        }
        
        this.dragStart = null;
        this.selectionBox = null;
    }
    
    renderOverlay(ctx) {
        if (this.selectionBox) {
            ctx.strokeStyle = '#00ff88';
            ctx.lineWidth = 1;
            ctx.setLineDash([3, 3]);
            ctx.strokeRect(
                this.selectionBox.x,
                this.selectionBox.y,
                this.selectionBox.width,
                this.selectionBox.height
            );
            ctx.setLineDash([]);
        }
    }
    
    getEntityAtPosition(x, y) {
        const entities = this.editor.engine.query('Transform', 'Sprite');
        
        for (const entity of entities) {
            const transform = entity.Transform;
            const sprite = entity.Sprite;
            
            const left = transform.x - sprite.width / 2;
            const right = transform.x + sprite.width / 2;
            const top = transform.y - sprite.height / 2;
            const bottom = transform.y + sprite.height / 2;
            
            if (x >= left && x <= right && y >= top && y <= bottom) {
                return entity.id;
            }
        }
        
        return null;
    }
    
    getEntitiesInBox(box) {
        const entities = this.editor.engine.query('Transform', 'Sprite');
        const selected = [];
        
        const left = Math.min(box.x, box.x + box.width);
        const right = Math.max(box.x, box.x + box.width);
        const top = Math.min(box.y, box.y + box.height);
        const bottom = Math.max(box.y, box.y + box.height);
        
        for (const entity of entities) {
            const transform = entity.Transform;
            
            if (transform.x >= left && transform.x <= right &&
                transform.y >= top && transform.y <= bottom) {
                selected.push(entity.id);
            }
        }
        
        return selected;
    }
}

class MoveTool {
    constructor(editor) {
        this.editor = editor;
        this.dragging = false;
        this.dragOffset = null;
    }
    
    onMouseDown(mouse) {
        const entityId = this.getEntityAtPosition(mouse.x, mouse.y);
        
        if (entityId) {
            if (!this.editor.selection.has(entityId)) {
                this.editor.selectEntity(entityId);
            }
            
            this.dragging = true;
            
            // Calculate offset from entity center
            const transform = this.editor.engine.getComponent(entityId, 'Transform');
            this.dragOffset = {
                x: mouse.x - transform.x,
                y: mouse.y - transform.y
            };
        }
    }
    
    onMouseDrag(mouse) {
        if (this.dragging && this.editor.selection.size > 0) {
            for (const entityId of this.editor.selection) {
                const newX = mouse.x - (this.dragOffset ? this.dragOffset.x : 0);
                const newY = mouse.y - (this.dragOffset ? this.dragOffset.y : 0);
                
                this.editor.engine.updateComponent(entityId, 'Transform', {
                    x: newX,
                    y: newY
                });
            }
            
            this.editor.updatePropertyPanel();
        }
    }
    
    onMouseUp(mouse) {
        this.dragging = false;
        this.dragOffset = null;
    }
    
    getEntityAtPosition(x, y) {
        // Reuse logic from SelectTool
        return new SelectTool(this.editor).getEntityAtPosition(x, y);
    }
}

// Placeholder tools - can be expanded
class PaintTool {
    constructor(editor) { this.editor = editor; }
    onMouseDown(mouse) { /* Paint logic */ }
}

class EraseTool {
    constructor(editor) { this.editor = editor; }
    onMouseDown(mouse) { /* Erase logic */ }
}

class FillTool {
    constructor(editor) { this.editor = editor; }
    onMouseDown(mouse) { /* Fill logic */ }
}

// Undo/Redo System
class UndoRedoSystem {
    constructor() {
        this.history = [];
        this.index = -1;
        this.maxHistorySize = 50;
    }
    
    execute(command) {
        // Remove any history after current index
        this.history = this.history.slice(0, this.index + 1);
        
        // Add new command
        this.history.push(command);
        this.index++;
        
        // Limit history size
        if (this.history.length > this.maxHistorySize) {
            this.history.shift();
            this.index--;
        }
        
        // Execute command
        command.execute();
    }
    
    undo() {
        if (this.index >= 0) {
            this.history[this.index].undo();
            this.index--;
        }
    }
    
    redo() {
        if (this.index < this.history.length - 1) {
            this.index++;
            this.history[this.index].execute();
        }
    }
}

// Editor module placeholders
class SpriteEditor {
    constructor(editor) { this.editor = editor; }
    render() { /* Sprite editing rendering */ }
}

class TilemapEditor {
    constructor(editor) { this.editor = editor; }
    render() { /* Tilemap editing rendering */ }
}

class SceneComposer {
    constructor(editor) { this.editor = editor; }
    
    render() {
        const ctx = this.editor.ctx;
        ctx.save();
        ctx.translate(this.editor.camera.x, this.editor.camera.y);
        ctx.scale(this.editor.camera.zoom, this.editor.camera.zoom);
        
        // Render all entities in scene
        const entities = this.editor.engine.query('Transform', 'Sprite');
        
        for (const entity of entities) {
            const transform = entity.Transform;
            const sprite = entity.Sprite;
            
            if (!sprite.visible) continue;
            
            ctx.save();
            ctx.translate(transform.x, transform.y);
            ctx.rotate(transform.rotation);
            ctx.scale(transform.scaleX, transform.scaleY);
            
            // Render sprite (placeholder)
            ctx.fillStyle = `hsl(${sprite.tint % 360}, 70%, 50%)`;
            ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
            
            ctx.restore();
        }
        
        ctx.restore();
    }
}

class AnimationEditor {
    constructor(editor) { this.editor = editor; }
    render() { /* Animation editing rendering */ }
}

// Export for global access
window.VisualEditor = VisualEditor;