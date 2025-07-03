// Visual Scripting System
// Node-based programming interface with flow-based and event-driven logic

class VisualScriptingSystem {
    constructor(engine) {
        this.engine = engine;
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
        
        // Graph data
        this.nodes = new Map();
        this.connections = new Map();
        this.nextNodeId = 1;
        this.nextConnectionId = 1;
        
        // Interaction state
        this.selectedNodes = new Set();
        this.draggedNode = null;
        this.connectingFrom = null;
        this.mouse = { x: 0, y: 0, down: false };
        
        // Node library
        this.nodeLibrary = new NodeLibrary();
        this.nodeSearch = null;
        
        // Execution
        this.executionContext = new ExecutionContext(this);
        this.isExecuting = false;
        
        this.initializeVisualScripting();
    }
    
    initializeVisualScripting() {
        this.setupCanvas();
        this.setupEventHandlers();
        this.setupUI();
        this.registerDefaultNodes();
    }
    
    setupCanvas() {
        this.canvas = document.getElementById('visualScriptCanvas') || this.createCanvas();
        this.ctx = this.canvas.getContext('2d');
        this.canvas.style.background = '#0a0a0f';
    }
    
    createCanvas() {
        const canvas = document.createElement('canvas');
        canvas.id = 'visualScriptCanvas';
        canvas.width = 1200;
        canvas.height = 800;
        canvas.style.border = '1px solid rgba(139, 69, 19, 0.3)';
        canvas.style.borderRadius = '8px';
        
        const container = document.getElementById('scriptingContainer');
        if (container) {
            container.appendChild(canvas);
        }
        
        return canvas;
    }
    
    setupEventHandlers() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('wheel', (e) => this.handleWheel(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleContextMenu(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }
    
    setupUI() {
        this.createNodeLibraryPanel();
        this.createPropertiesPanel();
        this.createExecutionPanel();
    }
    
    createNodeLibraryPanel() {
        const panel = document.createElement('div');
        panel.className = 'node-library-panel';
        panel.innerHTML = `
            <div class="panel-header">Node Library</div>
            <div class="node-search">
                <input type="text" id="nodeSearchInput" placeholder="Search nodes..." />
            </div>
            <div class="node-categories" id="nodeCategories">
                <!-- Categories will be populated -->
            </div>
        `;
        
        document.body.appendChild(panel);
        this.populateNodeLibrary();
    }
    
    createPropertiesPanel() {
        const panel = document.createElement('div');
        panel.className = 'node-properties-panel';
        panel.innerHTML = `
            <div class="panel-header">Properties</div>
            <div class="properties-content" id="nodePropertiesContent">
                <div class="no-selection">Select a node to edit properties</div>
            </div>
        `;
        
        document.body.appendChild(panel);
    }
    
    createExecutionPanel() {
        const panel = document.createElement('div');
        panel.className = 'execution-panel';
        panel.innerHTML = `
            <div class="panel-header">Execution</div>
            <div class="execution-controls">
                <button id="playScript" class="exec-btn">▶ Play</button>
                <button id="pauseScript" class="exec-btn">⏸ Pause</button>
                <button id="stopScript" class="exec-btn">⏹ Stop</button>
                <button id="stepScript" class="exec-btn">⏭ Step</button>
            </div>
            <div class="execution-status" id="executionStatus">
                <div class="status-line">Status: <span>Stopped</span></div>
                <div class="status-line">Nodes executed: <span>0</span></div>
                <div class="status-line">Execution time: <span>0ms</span></div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.setupExecutionControls();
    }
    
    populateNodeLibrary() {
        const categories = this.nodeLibrary.getCategories();
        const container = document.getElementById('nodeCategories');
        
        for (const [categoryName, nodes] of Object.entries(categories)) {
            const categoryDiv = document.createElement('div');
            categoryDiv.className = 'node-category';
            
            const header = document.createElement('div');
            header.className = 'category-header';
            header.textContent = categoryName;
            header.addEventListener('click', () => {
                categoryDiv.classList.toggle('collapsed');
            });
            
            const nodeList = document.createElement('div');
            nodeList.className = 'category-nodes';
            
            for (const nodeType of nodes) {
                const nodeItem = document.createElement('div');
                nodeItem.className = 'node-item';
                nodeItem.textContent = nodeType.name;
                nodeItem.title = nodeType.description;
                nodeItem.addEventListener('click', () => {
                    this.addNodeAtCursor(nodeType.type);
                });
                
                nodeList.appendChild(nodeItem);
            }
            
            categoryDiv.appendChild(header);
            categoryDiv.appendChild(nodeList);
            container.appendChild(categoryDiv);
        }
    }
    
    setupExecutionControls() {
        document.getElementById('playScript').addEventListener('click', () => {
            this.startExecution();
        });
        
        document.getElementById('pauseScript').addEventListener('click', () => {
            this.pauseExecution();
        });
        
        document.getElementById('stopScript').addEventListener('click', () => {
            this.stopExecution();
        });
        
        document.getElementById('stepScript').addEventListener('click', () => {
            this.stepExecution();
        });
    }
    
    registerDefaultNodes() {
        // Register built-in node types
        this.nodeLibrary.registerNode('Event', 'OnStart', OnStartNode);
        this.nodeLibrary.registerNode('Event', 'OnUpdate', OnUpdateNode);
        this.nodeLibrary.registerNode('Event', 'OnCollision', OnCollisionNode);
        this.nodeLibrary.registerNode('Event', 'OnKeyPress', OnKeyPressNode);
        
        this.nodeLibrary.registerNode('Logic', 'Branch', BranchNode);
        this.nodeLibrary.registerNode('Logic', 'AND', AndNode);
        this.nodeLibrary.registerNode('Logic', 'OR', OrNode);
        this.nodeLibrary.registerNode('Logic', 'NOT', NotNode);
        this.nodeLibrary.registerNode('Logic', 'Compare', CompareNode);
        
        this.nodeLibrary.registerNode('Math', 'Add', AddNode);
        this.nodeLibrary.registerNode('Math', 'Subtract', SubtractNode);
        this.nodeLibrary.registerNode('Math', 'Multiply', MultiplyNode);
        this.nodeLibrary.registerNode('Math', 'Divide', DivideNode);
        this.nodeLibrary.registerNode('Math', 'Random', RandomNode);
        
        this.nodeLibrary.registerNode('Transform', 'GetPosition', GetPositionNode);
        this.nodeLibrary.registerNode('Transform', 'SetPosition', SetPositionNode);
        this.nodeLibrary.registerNode('Transform', 'Move', MoveNode);
        this.nodeLibrary.registerNode('Transform', 'Rotate', RotateNode);
        
        this.nodeLibrary.registerNode('Physics', 'AddForce', AddForceNode);
        this.nodeLibrary.registerNode('Physics', 'SetVelocity', SetVelocityNode);
        this.nodeLibrary.registerNode('Physics', 'GetVelocity', GetVelocityNode);
        
        this.nodeLibrary.registerNode('Animation', 'PlayAnimation', PlayAnimationNode);
        this.nodeLibrary.registerNode('Animation', 'StopAnimation', StopAnimationNode);
        
        this.nodeLibrary.registerNode('Audio', 'PlaySound', PlaySoundNode);
        this.nodeLibrary.registerNode('Audio', 'StopSound', StopSoundNode);
        
        this.nodeLibrary.registerNode('Variables', 'SetVariable', SetVariableNode);
        this.nodeLibrary.registerNode('Variables', 'GetVariable', GetVariableNode);
        
        this.nodeLibrary.registerNode('Flow', 'Delay', DelayNode);
        this.nodeLibrary.registerNode('Flow', 'ForLoop', ForLoopNode);
        this.nodeLibrary.registerNode('Flow', 'WhileLoop', WhileLoopNode);
    }
    
    // Node management
    addNode(nodeType, x = 100, y = 100) {
        const NodeClass = this.nodeLibrary.getNodeClass(nodeType);
        if (!NodeClass) return null;
        
        const nodeId = this.nextNodeId++;
        const node = new NodeClass(nodeId, x, y);
        this.nodes.set(nodeId, node);
        
        this.render();
        return node;
    }
    
    addNodeAtCursor(nodeType) {
        const worldPos = this.screenToWorld(this.mouse.x, this.mouse.y);
        this.addNode(nodeType, worldPos.x, worldPos.y);
    }
    
    removeNode(nodeId) {
        // Remove all connections to this node
        const connectionsToRemove = [];
        for (const [connId, connection] of this.connections) {
            if (connection.fromNode === nodeId || connection.toNode === nodeId) {
                connectionsToRemove.push(connId);
            }
        }
        
        connectionsToRemove.forEach(connId => this.connections.delete(connId));
        this.nodes.delete(nodeId);
        this.selectedNodes.delete(nodeId);
        
        this.render();
    }
    
    duplicateNode(nodeId) {
        const originalNode = this.nodes.get(nodeId);
        if (!originalNode) return null;
        
        const newNode = originalNode.clone();
        newNode.id = this.nextNodeId++;
        newNode.x += 50;
        newNode.y += 50;
        
        this.nodes.set(newNode.id, newNode);
        this.render();
        return newNode;
    }
    
    // Connection management
    addConnection(fromNodeId, fromPin, toNodeId, toPin) {
        // Validate connection
        const fromNode = this.nodes.get(fromNodeId);
        const toNode = this.nodes.get(toNodeId);
        
        if (!fromNode || !toNode) return null;
        
        const fromPinDef = fromNode.outputs.find(p => p.name === fromPin);
        const toPinDef = toNode.inputs.find(p => p.name === toPin);
        
        if (!fromPinDef || !toPinDef) return null;
        if (fromPinDef.type !== toPinDef.type && toPinDef.type !== 'any') return null;
        
        // Remove existing connection to input pin
        for (const [connId, connection] of this.connections) {
            if (connection.toNode === toNodeId && connection.toPin === toPin) {
                this.connections.delete(connId);
                break;
            }
        }
        
        const connectionId = this.nextConnectionId++;
        const connection = {
            id: connectionId,
            fromNode: fromNodeId,
            fromPin: fromPin,
            toNode: toNodeId,
            toPin: toPin
        };
        
        this.connections.set(connectionId, connection);
        this.render();
        return connection;
    }
    
    removeConnection(connectionId) {
        this.connections.delete(connectionId);
        this.render();
    }
    
    // Input handling
    handleMouseDown(e) {
        this.mouse.down = true;
        this.updateMousePosition(e);
        
        if (e.button === 0) { // Left click
            const clickedNode = this.getNodeAtPosition(this.mouse.x, this.mouse.y);
            const clickedPin = this.getPinAtPosition(this.mouse.x, this.mouse.y);
            
            if (clickedPin) {
                this.handlePinClick(clickedPin);
            } else if (clickedNode) {
                this.handleNodeClick(clickedNode, e.shiftKey);
                this.draggedNode = clickedNode;
            } else {
                if (!e.shiftKey) this.selectedNodes.clear();
                this.connectingFrom = null;
            }
        }
        
        this.render();
    }
    
    handleMouseMove(e) {
        this.updateMousePosition(e);
        
        if (this.mouse.down && this.draggedNode) {
            // Drag selected nodes
            const deltaX = this.mouse.x - this.mouse.lastX;
            const deltaY = this.mouse.y - this.mouse.lastY;
            
            for (const nodeId of this.selectedNodes) {
                const node = this.nodes.get(nodeId);
                if (node) {
                    node.x += deltaX / this.camera.zoom;
                    node.y += deltaY / this.camera.zoom;
                }
            }
        } else if (this.mouse.down && !this.draggedNode) {
            // Pan camera
            this.camera.x += this.mouse.x - this.mouse.lastX;
            this.camera.y += this.mouse.y - this.mouse.lastY;
        }
        
        this.mouse.lastX = this.mouse.x;
        this.mouse.lastY = this.mouse.y;
        this.render();
    }
    
    handleMouseUp(e) {
        this.mouse.down = false;
        
        if (this.connectingFrom) {
            const targetPin = this.getPinAtPosition(this.mouse.x, this.mouse.y);
            if (targetPin && targetPin.nodeId !== this.connectingFrom.nodeId) {
                // Determine direction
                if (this.connectingFrom.type === 'output' && targetPin.type === 'input') {
                    this.addConnection(
                        this.connectingFrom.nodeId, this.connectingFrom.pinName,
                        targetPin.nodeId, targetPin.pinName
                    );
                } else if (this.connectingFrom.type === 'input' && targetPin.type === 'output') {
                    this.addConnection(
                        targetPin.nodeId, targetPin.pinName,
                        this.connectingFrom.nodeId, this.connectingFrom.pinName
                    );
                }
            }
            this.connectingFrom = null;
        }
        
        this.draggedNode = null;
        this.render();
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        if (e.ctrlKey) {
            // Zoom
            const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
            this.camera.zoom = Math.max(0.2, Math.min(3, this.camera.zoom * zoomFactor));
        } else {
            // Pan
            this.camera.x -= e.deltaX;
            this.camera.y -= e.deltaY;
        }
        
        this.render();
    }
    
    handleContextMenu(e) {
        e.preventDefault();
        this.showContextMenu(e.clientX, e.clientY);
    }
    
    handleDoubleClick(e) {
        const clickedNode = this.getNodeAtPosition(this.mouse.x, this.mouse.y);
        if (clickedNode) {
            this.editNodeProperties(clickedNode);
        }
    }
    
    handleKeyDown(e) {
        switch (e.key) {
            case 'Delete':
                this.deleteSelectedNodes();
                break;
            case 'c':
                if (e.ctrlKey) this.copySelectedNodes();
                break;
            case 'v':
                if (e.ctrlKey) this.pasteNodes();
                break;
            case 'd':
                if (e.ctrlKey) this.duplicateSelectedNodes();
                break;
            case 'a':
                if (e.ctrlKey) this.selectAllNodes();
                break;
        }
    }
    
    handlePinClick(pin) {
        if (this.connectingFrom) {
            // Try to create connection
            if (pin.nodeId !== this.connectingFrom.nodeId) {
                if (this.connectingFrom.type === 'output' && pin.type === 'input') {
                    this.addConnection(
                        this.connectingFrom.nodeId, this.connectingFrom.pinName,
                        pin.nodeId, pin.pinName
                    );
                } else if (this.connectingFrom.type === 'input' && pin.type === 'output') {
                    this.addConnection(
                        pin.nodeId, pin.pinName,
                        this.connectingFrom.nodeId, this.connectingFrom.pinName
                    );
                }
            }
            this.connectingFrom = null;
        } else {
            // Start connection
            this.connectingFrom = pin;
        }
    }
    
    handleNodeClick(node, addToSelection) {
        if (addToSelection) {
            if (this.selectedNodes.has(node.id)) {
                this.selectedNodes.delete(node.id);
            } else {
                this.selectedNodes.add(node.id);
            }
        } else {
            this.selectedNodes.clear();
            this.selectedNodes.add(node.id);
        }
        
        this.updatePropertiesPanel();
    }
    
    updateMousePosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.lastX = this.mouse.x;
        this.mouse.lastY = this.mouse.y;
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
    }
    
    // Hit testing
    getNodeAtPosition(x, y) {
        const worldPos = this.screenToWorld(x, y);
        
        for (const node of this.nodes.values()) {
            if (worldPos.x >= node.x && worldPos.x <= node.x + node.width &&
                worldPos.y >= node.y && worldPos.y <= node.y + node.height) {
                return node;
            }
        }
        return null;
    }
    
    getPinAtPosition(x, y) {
        const worldPos = this.screenToWorld(x, y);
        
        for (const node of this.nodes.values()) {
            // Check input pins
            for (let i = 0; i < node.inputs.length; i++) {
                const pin = node.inputs[i];
                const pinX = node.x - 8;
                const pinY = node.y + 30 + i * 20;
                
                if (Math.abs(worldPos.x - pinX) <= 8 && Math.abs(worldPos.y - pinY) <= 8) {
                    return {
                        nodeId: node.id,
                        pinName: pin.name,
                        type: 'input',
                        x: pinX,
                        y: pinY
                    };
                }
            }
            
            // Check output pins
            for (let i = 0; i < node.outputs.length; i++) {
                const pin = node.outputs[i];
                const pinX = node.x + node.width + 8;
                const pinY = node.y + 30 + i * 20;
                
                if (Math.abs(worldPos.x - pinX) <= 8 && Math.abs(worldPos.y - pinY) <= 8) {
                    return {
                        nodeId: node.id,
                        pinName: pin.name,
                        type: 'output',
                        x: pinX,
                        y: pinY
                    };
                }
            }
        }
        return null;
    }
    
    // Rendering
    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.ctx.save();
        this.ctx.translate(this.camera.x, this.camera.y);
        this.ctx.scale(this.camera.zoom, this.camera.zoom);
        
        // Render grid
        this.renderGrid();
        
        // Render connections
        this.renderConnections();
        
        // Render nodes
        this.renderNodes();
        
        // Render active connection
        if (this.connectingFrom) {
            this.renderActiveConnection();
        }
        
        this.ctx.restore();
    }
    
    renderGrid() {
        const gridSize = 50;
        const ctx = this.ctx;
        
        ctx.strokeStyle = 'rgba(139, 69, 19, 0.1)';
        ctx.lineWidth = 1 / this.camera.zoom;
        
        const startX = Math.floor(-this.camera.x / this.camera.zoom / gridSize) * gridSize;
        const endX = Math.ceil((this.canvas.width - this.camera.x) / this.camera.zoom / gridSize) * gridSize;
        const startY = Math.floor(-this.camera.y / this.camera.zoom / gridSize) * gridSize;
        const endY = Math.ceil((this.canvas.height - this.camera.y) / this.camera.zoom / gridSize) * gridSize;
        
        ctx.beginPath();
        for (let x = startX; x <= endX; x += gridSize) {
            ctx.moveTo(x, startY);
            ctx.lineTo(x, endY);
        }
        for (let y = startY; y <= endY; y += gridSize) {
            ctx.moveTo(startX, y);
            ctx.lineTo(endX, y);
        }
        ctx.stroke();
    }
    
    renderNodes() {
        for (const node of this.nodes.values()) {
            this.renderNode(node);
        }
    }
    
    renderNode(node) {
        const ctx = this.ctx;
        const isSelected = this.selectedNodes.has(node.id);
        const isExecuting = this.executionContext.isNodeExecuting(node.id);
        
        // Node background
        ctx.fillStyle = isSelected ? '#2a4a6b' : '#1a2a3a';
        if (isExecuting) ctx.fillStyle = '#4a2a1a';
        
        ctx.fillRect(node.x, node.y, node.width, node.height);
        
        // Node border
        ctx.strokeStyle = isSelected ? '#4a8fff' : '#3a5a7a';
        if (isExecuting) ctx.strokeStyle = '#ff6a4a';
        
        ctx.lineWidth = isSelected ? 2 : 1;
        ctx.strokeRect(node.x, node.y, node.width, node.height);
        
        // Node title
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText(node.title, node.x + 8, node.y + 16);
        
        // Input pins
        for (let i = 0; i < node.inputs.length; i++) {
            const pin = node.inputs[i];
            const pinX = node.x - 8;
            const pinY = node.y + 30 + i * 20;
            
            this.renderPin(pinX, pinY, pin.type, true);
            
            // Pin label
            ctx.fillStyle = '#cccccc';
            ctx.font = '10px Arial';
            ctx.fillText(pin.name, node.x + 8, pinY + 4);
        }
        
        // Output pins
        for (let i = 0; i < node.outputs.length; i++) {
            const pin = node.outputs[i];
            const pinX = node.x + node.width + 8;
            const pinY = node.y + 30 + i * 20;
            
            this.renderPin(pinX, pinY, pin.type, false);
            
            // Pin label
            ctx.fillStyle = '#cccccc';
            ctx.font = '10px Arial';
            ctx.textAlign = 'right';
            ctx.fillText(pin.name, node.x + node.width - 8, pinY + 4);
            ctx.textAlign = 'left';
        }
    }
    
    renderPin(x, y, type, isInput) {
        const ctx = this.ctx;
        const colors = {
            exec: '#ffffff',
            number: '#4a9eff',
            string: '#ff4a9e',
            boolean: '#ff9e4a',
            vector: '#9eff4a',
            any: '#cccccc'
        };
        
        ctx.fillStyle = colors[type] || colors.any;
        
        if (type === 'exec') {
            // Triangle for execution pins
            ctx.beginPath();
            if (isInput) {
                ctx.moveTo(x - 6, y - 4);
                ctx.lineTo(x + 2, y);
                ctx.lineTo(x - 6, y + 4);
            } else {
                ctx.moveTo(x + 6, y - 4);
                ctx.lineTo(x - 2, y);
                ctx.lineTo(x + 6, y + 4);
            }
            ctx.closePath();
            ctx.fill();
        } else {
            // Circle for data pins
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    renderConnections() {
        for (const connection of this.connections.values()) {
            this.renderConnection(connection);
        }
    }
    
    renderConnection(connection) {
        const fromNode = this.nodes.get(connection.fromNode);
        const toNode = this.nodes.get(connection.toNode);
        
        if (!fromNode || !toNode) return;
        
        const fromPinIndex = fromNode.outputs.findIndex(p => p.name === connection.fromPin);
        const toPinIndex = toNode.inputs.findIndex(p => p.name === connection.toPin);
        
        if (fromPinIndex === -1 || toPinIndex === -1) return;
        
        const fromX = fromNode.x + fromNode.width + 8;
        const fromY = fromNode.y + 30 + fromPinIndex * 20;
        const toX = toNode.x - 8;
        const toY = toNode.y + 30 + toPinIndex * 20;
        
        const ctx = this.ctx;
        const pinType = fromNode.outputs[fromPinIndex].type;
        
        // Connection color based on type
        const colors = {
            exec: '#ffffff',
            number: '#4a9eff',
            string: '#ff4a9e',
            boolean: '#ff9e4a',
            vector: '#9eff4a'
        };
        
        ctx.strokeStyle = colors[pinType] || '#cccccc';
        ctx.lineWidth = pinType === 'exec' ? 3 : 2;
        
        // Bezier curve
        const controlDistance = Math.abs(toX - fromX) * 0.5;
        const cp1X = fromX + controlDistance;
        const cp1Y = fromY;
        const cp2X = toX - controlDistance;
        const cp2Y = toY;
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.bezierCurveTo(cp1X, cp1Y, cp2X, cp2Y, toX, toY);
        ctx.stroke();
        
        // Arrow head
        const angle = Math.atan2(toY - cp2Y, toX - cp2X);
        const arrowLength = 8;
        
        ctx.fillStyle = ctx.strokeStyle;
        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(
            toX - arrowLength * Math.cos(angle - Math.PI / 6),
            toY - arrowLength * Math.sin(angle - Math.PI / 6)
        );
        ctx.lineTo(
            toX - arrowLength * Math.cos(angle + Math.PI / 6),
            toY - arrowLength * Math.sin(angle + Math.PI / 6)
        );
        ctx.closePath();
        ctx.fill();
    }
    
    renderActiveConnection() {
        if (!this.connectingFrom) return;
        
        const fromNode = this.nodes.get(this.connectingFrom.nodeId);
        if (!fromNode) return;
        
        const worldMouse = this.screenToWorld(this.mouse.x, this.mouse.y);
        let fromX, fromY;
        
        if (this.connectingFrom.type === 'output') {
            const pinIndex = fromNode.outputs.findIndex(p => p.name === this.connectingFrom.pinName);
            fromX = fromNode.x + fromNode.width + 8;
            fromY = fromNode.y + 30 + pinIndex * 20;
        } else {
            const pinIndex = fromNode.inputs.findIndex(p => p.name === this.connectingFrom.pinName);
            fromX = fromNode.x - 8;
            fromY = fromNode.y + 30 + pinIndex * 20;
        }
        
        const ctx = this.ctx;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(worldMouse.x, worldMouse.y);
        ctx.stroke();
        
        ctx.setLineDash([]);
    }
    
    // Execution
    startExecution() {
        this.isExecuting = true;
        this.executionContext.start();
        this.updateExecutionStatus('Running');
    }
    
    pauseExecution() {
        this.isExecuting = false;
        this.executionContext.pause();
        this.updateExecutionStatus('Paused');
    }
    
    stopExecution() {
        this.isExecuting = false;
        this.executionContext.stop();
        this.updateExecutionStatus('Stopped');
    }
    
    stepExecution() {
        this.executionContext.step();
    }
    
    updateExecutionStatus(status) {
        const statusElement = document.getElementById('executionStatus');
        if (statusElement) {
            const spans = statusElement.querySelectorAll('span');
            if (spans[0]) spans[0].textContent = status;
            if (spans[1]) spans[1].textContent = this.executionContext.nodesExecuted;
            if (spans[2]) spans[2].textContent = this.executionContext.executionTime + 'ms';
        }
    }
    
    // Utility functions
    screenToWorld(screenX, screenY) {
        return {
            x: (screenX - this.camera.x) / this.camera.zoom,
            y: (screenY - this.camera.y) / this.camera.zoom
        };
    }
    
    worldToScreen(worldX, worldY) {
        return {
            x: worldX * this.camera.zoom + this.camera.x,
            y: worldY * this.camera.zoom + this.camera.y
        };
    }
    
    deleteSelectedNodes() {
        for (const nodeId of this.selectedNodes) {
            this.removeNode(nodeId);
        }
        this.selectedNodes.clear();
    }
    
    duplicateSelectedNodes() {
        const newSelection = new Set();
        for (const nodeId of this.selectedNodes) {
            const newNode = this.duplicateNode(nodeId);
            if (newNode) newSelection.add(newNode.id);
        }
        this.selectedNodes = newSelection;
    }
    
    selectAllNodes() {
        this.selectedNodes.clear();
        for (const nodeId of this.nodes.keys()) {
            this.selectedNodes.add(nodeId);
        }
        this.render();
    }
    
    updatePropertiesPanel() {
        const content = document.getElementById('nodePropertiesContent');
        if (!content) return;
        
        if (this.selectedNodes.size === 1) {
            const nodeId = Array.from(this.selectedNodes)[0];
            const node = this.nodes.get(nodeId);
            if (node && node.getPropertyEditor) {
                content.innerHTML = node.getPropertyEditor();
            }
        } else {
            content.innerHTML = '<div class="no-selection">Select a single node to edit properties</div>';
        }
    }
    
    // Serialization
    serialize() {
        const data = {
            nodes: Array.from(this.nodes.values()).map(node => node.serialize()),
            connections: Array.from(this.connections.values())
        };
        return data;
    }
    
    deserialize(data) {
        this.nodes.clear();
        this.connections.clear();
        this.selectedNodes.clear();
        
        // Recreate nodes
        for (const nodeData of data.nodes) {
            const NodeClass = this.nodeLibrary.getNodeClass(nodeData.type);
            if (NodeClass) {
                const node = NodeClass.deserialize(nodeData);
                this.nodes.set(node.id, node);
                this.nextNodeId = Math.max(this.nextNodeId, node.id + 1);
            }
        }
        
        // Recreate connections
        for (const connectionData of data.connections) {
            this.connections.set(connectionData.id, connectionData);
            this.nextConnectionId = Math.max(this.nextConnectionId, connectionData.id + 1);
        }
        
        this.render();
    }
}

// Base classes and node library will be implemented in the next parts...
// This is the core framework for the visual scripting system

// Export for global access
window.VisualScriptingSystem = VisualScriptingSystem;