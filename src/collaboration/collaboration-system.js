// Real-time Collaboration System
// Implements CRDT-inspired conflict resolution with WebSocket synchronization

class CollaborationSystem {
    constructor(engine) {
        this.engine = engine;
        this.socket = null;
        this.sessionId = this.generateSessionId();
        this.userId = this.generateUserId();
        this.projectId = null;
        this.connected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        
        // Collaboration state
        this.activeUsers = new Map();
        this.operations = [];
        this.operationIndex = 0;
        this.acknowledgements = new Map();
        
        // Locks for preventing conflicts
        this.locks = new Map();
        this.lockTimeout = 30000; // 30 seconds
        
        // Presence system
        this.cursors = new Map();
        this.selections = new Map();
        
        // Offline support
        this.offlineOperations = [];
        this.isOnline = navigator.onLine;
        
        this.initializeNetworking();
        this.setupEventHandlers();
    }
    
    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
    }
    
    generateUserId() {
        let userId = localStorage.getItem('dreammaker_user_id');
        if (!userId) {
            userId = 'user_' + Math.random().toString(36).substr(2, 9);
            localStorage.setItem('dreammaker_user_id', userId);
        }
        return userId;
    }
    
    initializeNetworking() {
        // Setup online/offline detection
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncOfflineOperations();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }
    
    setupEventHandlers() {
        // Listen to engine events for synchronization
        this.engine.on('componentAdded', (data) => {
            this.broadcastOperation('componentAdded', data);
        });
        
        this.engine.on('componentUpdated', (data) => {
            this.broadcastOperation('componentUpdated', data);
        });
        
        this.engine.on('componentRemoved', (data) => {
            this.broadcastOperation('componentRemoved', data);
        });
        
        this.engine.on('entityCreated', (data) => {
            this.broadcastOperation('entityCreated', data);
        });
        
        this.engine.on('entityDestroyed', (data) => {
            this.broadcastOperation('entityDestroyed', data);
        });
    }
    
    connect(serverUrl, projectId) {
        this.projectId = projectId;
        
        try {
            this.socket = new WebSocket(`${serverUrl}/collaborate/${projectId}`);
            
            this.socket.onopen = () => {
                this.connected = true;
                this.reconnectAttempts = 0;
                this.authenticate();
                this.syncOfflineOperations();
                this.emit('connected');
            };
            
            this.socket.onmessage = (event) => {
                this.handleMessage(JSON.parse(event.data));
            };
            
            this.socket.onclose = () => {
                this.connected = false;
                this.emit('disconnected');
                this.attemptReconnect();
            };
            
            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                this.emit('error', error);
            };
            
        } catch (error) {
            console.error('Failed to connect:', error);
            this.emit('error', error);
        }
    }
    
    disconnect() {
        if (this.socket) {
            this.connected = false;
            this.socket.close();
            this.socket = null;
        }
    }
    
    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
            
            setTimeout(() => {
                if (!this.connected && this.projectId) {
                    this.connect(this.socket?.url || 'ws://localhost:8080', this.projectId);
                }
            }, delay);
        }
    }
    
    authenticate() {
        this.sendMessage({
            type: 'authenticate',
            userId: this.userId,
            sessionId: this.sessionId,
            timestamp: Date.now()
        });
    }
    
    sendMessage(data) {
        if (this.connected && this.socket && this.socket.readyState === WebSocket.OPEN) {
            this.socket.send(JSON.stringify(data));
            return true;
        } else if (this.isOnline) {
            // Queue for when connection is restored
            this.offlineOperations.push(data);
        }
        return false;
    }
    
    handleMessage(data) {
        switch (data.type) {
            case 'operation':
                this.handleRemoteOperation(data);
                break;
                
            case 'userJoined':
                this.handleUserJoined(data);
                break;
                
            case 'userLeft':
                this.handleUserLeft(data);
                break;
                
            case 'presence':
                this.handlePresenceUpdate(data);
                break;
                
            case 'lockAcquired':
                this.handleLockAcquired(data);
                break;
                
            case 'lockReleased':
                this.handleLockReleased(data);
                break;
                
            case 'acknowledgement':
                this.handleAcknowledgement(data);
                break;
                
            case 'projectState':
                this.handleProjectState(data);
                break;
                
            case 'conflict':
                this.handleConflict(data);
                break;
        }
    }
    
    broadcastOperation(type, data, priority = 'normal') {
        const operation = {
            type: 'operation',
            operationType: type,
            data: data,
            userId: this.userId,
            sessionId: this.sessionId,
            timestamp: Date.now(),
            operationId: this.operationIndex++,
            priority: priority
        };
        
        this.operations.push(operation);
        
        if (this.isOnline) {
            this.sendMessage(operation);
        } else {
            this.offlineOperations.push(operation);
        }
    }
    
    handleRemoteOperation(operation) {
        // Ignore our own operations
        if (operation.userId === this.userId && operation.sessionId === this.sessionId) {
            return;
        }
        
        // Apply CRDT-style conflict resolution
        const conflict = this.detectConflict(operation);
        if (conflict) {
            this.resolveConflict(operation, conflict);
        } else {
            this.applyOperation(operation);
        }
        
        // Send acknowledgement
        this.sendMessage({
            type: 'acknowledgement',
            operationId: operation.operationId,
            userId: this.userId
        });
    }
    
    detectConflict(operation) {
        // Check for conflicting operations on the same entity/component
        for (let i = this.operations.length - 1; i >= 0; i--) {
            const localOp = this.operations[i];
            
            if (localOp.timestamp > operation.timestamp - 1000 && // Within 1 second
                localOp.data.entityId === operation.data.entityId &&
                localOp.operationType === operation.operationType) {
                return localOp;
            }
        }
        return null;
    }
    
    resolveConflict(remoteOp, localOp) {
        // Last-writer-wins with user priority
        const remoteTime = remoteOp.timestamp;
        const localTime = localOp.timestamp;
        
        // If remote operation is newer, apply it
        if (remoteTime > localTime) {
            this.applyOperation(remoteOp);
        }
        // If times are very close, use user ID as tiebreaker
        else if (Math.abs(remoteTime - localTime) < 100) {
            if (remoteOp.userId < localOp.userId) {
                this.applyOperation(remoteOp);
            }
        }
        
        this.emit('conflict', { remote: remoteOp, local: localOp });
    }
    
    applyOperation(operation) {
        // Temporarily disable event broadcasting to prevent loops
        const originalBroadcast = this.broadcastOperation;
        this.broadcastOperation = () => {};
        
        try {
            switch (operation.operationType) {
                case 'componentAdded':
                    this.engine.addComponent(
                        operation.data.entityId,
                        operation.data.type,
                        operation.data.data
                    );
                    break;
                    
                case 'componentUpdated':
                    this.engine.updateComponent(
                        operation.data.entityId,
                        operation.data.type,
                        operation.data.data
                    );
                    break;
                    
                case 'componentRemoved':
                    this.engine.removeComponent(
                        operation.data.entityId,
                        operation.data.type
                    );
                    break;
                    
                case 'entityCreated':
                    // Check if entity already exists
                    if (!this.engine.entities.has(operation.data.entityId)) {
                        this.engine.entities.set(operation.data.entityId, operation.data.entity);
                    }
                    break;
                    
                case 'entityDestroyed':
                    this.engine.destroyEntity(operation.data.entityId);
                    break;
            }
        } catch (error) {
            console.error('Failed to apply remote operation:', error, operation);
        } finally {
            // Re-enable broadcasting
            this.broadcastOperation = originalBroadcast;
        }
    }
    
    // Lock system for preventing conflicts
    requestLock(entityId, componentType = null) {
        const lockKey = componentType ? `${entityId}:${componentType}` : entityId;
        
        if (this.locks.has(lockKey)) {
            return false; // Already locked
        }
        
        this.sendMessage({
            type: 'requestLock',
            lockKey: lockKey,
            entityId: entityId,
            componentType: componentType,
            userId: this.userId
        });
        
        return true;
    }
    
    releaseLock(entityId, componentType = null) {
        const lockKey = componentType ? `${entityId}:${componentType}` : entityId;
        
        if (this.locks.get(lockKey) === this.userId) {
            this.locks.delete(lockKey);
            
            this.sendMessage({
                type: 'releaseLock',
                lockKey: lockKey,
                userId: this.userId
            });
            
            return true;
        }
        
        return false;
    }
    
    handleLockAcquired(data) {
        this.locks.set(data.lockKey, data.userId);
        
        // Auto-release after timeout
        setTimeout(() => {
            if (this.locks.get(data.lockKey) === data.userId) {
                this.releaseLock(data.entityId, data.componentType);
            }
        }, this.lockTimeout);
        
        this.emit('lockAcquired', data);
    }
    
    handleLockReleased(data) {
        this.locks.delete(data.lockKey);
        this.emit('lockReleased', data);
    }
    
    // Presence system
    updatePresence(cursor, selection = null, tool = null) {
        this.sendMessage({
            type: 'presence',
            userId: this.userId,
            cursor: cursor,
            selection: selection,
            tool: tool,
            timestamp: Date.now()
        });
    }
    
    handlePresenceUpdate(data) {
        this.cursors.set(data.userId, data.cursor);
        if (data.selection) {
            this.selections.set(data.userId, data.selection);
        }
        this.emit('presenceUpdate', data);
    }
    
    handleUserJoined(data) {
        this.activeUsers.set(data.userId, {
            id: data.userId,
            name: data.name || 'Anonymous',
            color: data.color || this.generateUserColor(data.userId),
            joinedAt: Date.now()
        });
        
        this.emit('userJoined', data);
    }
    
    handleUserLeft(data) {
        this.activeUsers.delete(data.userId);
        this.cursors.delete(data.userId);
        this.selections.delete(data.userId);
        
        // Release any locks held by this user
        for (const [lockKey, userId] of this.locks) {
            if (userId === data.userId) {
                this.locks.delete(lockKey);
            }
        }
        
        this.emit('userLeft', data);
    }
    
    generateUserColor(userId) {
        // Generate consistent color based on user ID
        let hash = 0;
        for (let i = 0; i < userId.length; i++) {
            hash = userId.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 70%, 60%)`;
    }
    
    // Offline support
    syncOfflineOperations() {
        if (!this.connected || this.offlineOperations.length === 0) {
            return;
        }
        
        // Send queued operations
        const operations = [...this.offlineOperations];
        this.offlineOperations = [];
        
        for (const operation of operations) {
            this.sendMessage(operation);
        }
        
        this.emit('offlineSync', { count: operations.length });
    }
    
    handleProjectState(data) {
        // Received complete project state - merge with local state
        if (data.state) {
            this.engine.deserialize(data.state);
        }
        
        if (data.operations) {
            // Apply any operations we missed
            for (const operation of data.operations) {
                if (operation.operationId > this.operationIndex) {
                    this.handleRemoteOperation(operation);
                }
            }
        }
        
        this.emit('projectSynced', data);
    }
    
    handleAcknowledgement(data) {
        this.acknowledgements.set(data.operationId, data.userId);
        this.emit('operationAcknowledged', data);
    }
    
    handleConflict(data) {
        this.emit('conflict', data);
    }
    
    // Version control simulation
    createBranch(name) {
        const snapshot = this.engine.serialize();
        this.sendMessage({
            type: 'createBranch',
            name: name,
            snapshot: snapshot,
            userId: this.userId
        });
    }
    
    mergeBranch(branchName, targetBranch = 'main') {
        this.sendMessage({
            type: 'mergeBranch',
            source: branchName,
            target: targetBranch,
            userId: this.userId
        });
    }
    
    // Chat system
    sendChatMessage(message) {
        this.sendMessage({
            type: 'chat',
            message: message,
            userId: this.userId,
            timestamp: Date.now()
        });
    }
    
    // Event emitter
    emit(event, data) {
        if (this.engine && this.engine.emit) {
            this.engine.emit(`collaboration:${event}`, data);
        }
    }
    
    // Public API
    isLocked(entityId, componentType = null) {
        const lockKey = componentType ? `${entityId}:${componentType}` : entityId;
        return this.locks.has(lockKey);
    }
    
    getLockOwner(entityId, componentType = null) {
        const lockKey = componentType ? `${entityId}:${componentType}` : entityId;
        return this.locks.get(lockKey);
    }
    
    getActiveUsers() {
        return Array.from(this.activeUsers.values());
    }
    
    getUserCursor(userId) {
        return this.cursors.get(userId);
    }
    
    getUserSelection(userId) {
        return this.selections.get(userId);
    }
    
    isConnected() {
        return this.connected;
    }
    
    getConnectionStatus() {
        return {
            connected: this.connected,
            activeUsers: this.activeUsers.size,
            operationsPending: this.offlineOperations.length,
            locks: this.locks.size
        };
    }
}

// Collaboration UI Components
class CollaborationUI {
    constructor(collaboration) {
        this.collaboration = collaboration;
        this.userListElement = null;
        this.chatElement = null;
        this.statusElement = null;
        
        this.setupUI();
        this.setupEventListeners();
    }
    
    setupUI() {
        // Create collaboration panel
        const panel = document.createElement('div');
        panel.className = 'collaboration-panel';
        panel.innerHTML = `
            <div class="collaboration-header">
                <span class="collaboration-title">Collaboration</span>
                <span class="collaboration-status" id="collabStatus">Offline</span>
            </div>
            
            <div class="active-users" id="activeUsers">
                <div class="user-list-header">Active Users</div>
                <div class="user-list" id="userList"></div>
            </div>
            
            <div class="collaboration-chat" id="collabChat">
                <div class="chat-header">Chat</div>
                <div class="chat-messages" id="chatMessages"></div>
                <div class="chat-input-container">
                    <input type="text" id="chatInput" placeholder="Type a message..." />
                    <button id="chatSend">Send</button>
                </div>
            </div>
            
            <div class="collaboration-controls">
                <button id="shareProject">Share Project</button>
                <button id="saveSnapshot">Save Snapshot</button>
            </div>
        `;
        
        document.body.appendChild(panel);
        
        this.userListElement = document.getElementById('userList');
        this.chatElement = document.getElementById('chatMessages');
        this.statusElement = document.getElementById('collabStatus');
        
        // Add styles
        this.addStyles();
    }
    
    setupEventListeners() {
        // Chat functionality
        const chatInput = document.getElementById('chatInput');
        const chatSend = document.getElementById('chatSend');
        
        const sendMessage = () => {
            const message = chatInput.value.trim();
            if (message) {
                this.collaboration.sendChatMessage(message);
                chatInput.value = '';
            }
        };
        
        chatSend.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
        
        // Collaboration events
        this.collaboration.engine.on('collaboration:connected', () => {
            this.updateStatus('Connected', 'connected');
        });
        
        this.collaboration.engine.on('collaboration:disconnected', () => {
            this.updateStatus('Disconnected', 'disconnected');
        });
        
        this.collaboration.engine.on('collaboration:userJoined', (data) => {
            this.addChatMessage(`${data.name || data.userId} joined`, 'system');
            this.updateUserList();
        });
        
        this.collaboration.engine.on('collaboration:userLeft', (data) => {
            this.addChatMessage(`${data.name || data.userId} left`, 'system');
            this.updateUserList();
        });
        
        this.collaboration.engine.on('collaboration:chat', (data) => {
            this.addChatMessage(data.message, 'user', data.userId);
        });
    }
    
    updateStatus(text, status) {
        this.statusElement.textContent = text;
        this.statusElement.className = `collaboration-status ${status}`;
    }
    
    updateUserList() {
        const users = this.collaboration.getActiveUsers();
        this.userListElement.innerHTML = '';
        
        for (const user of users) {
            const userElement = document.createElement('div');
            userElement.className = 'user-item';
            userElement.innerHTML = `
                <div class="user-indicator" style="background-color: ${user.color}"></div>
                <span class="user-name">${user.name}</span>
            `;
            this.userListElement.appendChild(userElement);
        }
    }
    
    addChatMessage(message, type = 'user', userId = null) {
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        
        if (type === 'system') {
            messageElement.innerHTML = `<span class="system-message">${message}</span>`;
        } else {
            const user = userId ? this.collaboration.activeUsers.get(userId) : null;
            const userName = user ? user.name : 'You';
            const time = new Date().toLocaleTimeString();
            
            messageElement.innerHTML = `
                <span class="message-time">${time}</span>
                <span class="message-author">${userName}:</span>
                <span class="message-text">${message}</span>
            `;
        }
        
        this.chatElement.appendChild(messageElement);
        this.chatElement.scrollTop = this.chatElement.scrollHeight;
    }
    
    addStyles() {
        const styles = `
            .collaboration-panel {
                position: fixed;
                right: 20px;
                top: 100px;
                width: 300px;
                background: rgba(13, 17, 23, 0.95);
                border: 1px solid rgba(139, 69, 19, 0.3);
                border-radius: 12px;
                padding: 16px;
                color: #e8e3d8;
                font-family: 'Source Code Pro', monospace;
                font-size: 13px;
                z-index: 1000;
                backdrop-filter: blur(20px);
            }
            
            .collaboration-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 16px;
                padding-bottom: 8px;
                border-bottom: 1px solid rgba(139, 69, 19, 0.2);
            }
            
            .collaboration-title {
                font-weight: 600;
                color: #e8e3d8;
            }
            
            .collaboration-status {
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 11px;
                font-weight: 500;
            }
            
            .collaboration-status.connected {
                background: rgba(34, 197, 94, 0.2);
                color: #22c55e;
            }
            
            .collaboration-status.disconnected {
                background: rgba(239, 68, 68, 0.2);
                color: #ef4444;
            }
            
            .user-list-header {
                font-weight: 500;
                margin-bottom: 8px;
                color: rgba(232, 227, 216, 0.8);
            }
            
            .user-item {
                display: flex;
                align-items: center;
                margin-bottom: 6px;
            }
            
            .user-indicator {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                margin-right: 8px;
            }
            
            .user-name {
                color: #e8e3d8;
            }
            
            .collaboration-chat {
                margin: 16px 0;
            }
            
            .chat-header {
                font-weight: 500;
                margin-bottom: 8px;
                color: rgba(232, 227, 216, 0.8);
            }
            
            .chat-messages {
                height: 120px;
                overflow-y: auto;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 6px;
                padding: 8px;
                margin-bottom: 8px;
                font-size: 12px;
            }
            
            .chat-message {
                margin-bottom: 6px;
                line-height: 1.4;
            }
            
            .system-message {
                color: rgba(232, 227, 216, 0.6);
                font-style: italic;
            }
            
            .message-time {
                color: rgba(232, 227, 216, 0.5);
                margin-right: 8px;
            }
            
            .message-author {
                color: rgba(139, 69, 19, 0.8);
                font-weight: 500;
                margin-right: 4px;
            }
            
            .message-text {
                color: #e8e3d8;
            }
            
            .chat-input-container {
                display: flex;
                gap: 6px;
            }
            
            .chat-input-container input {
                flex: 1;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(139, 69, 19, 0.2);
                border-radius: 4px;
                padding: 6px 8px;
                color: #e8e3d8;
                font-size: 12px;
            }
            
            .chat-input-container button {
                background: rgba(139, 69, 19, 0.6);
                border: none;
                border-radius: 4px;
                padding: 6px 12px;
                color: #e8e3d8;
                font-size: 12px;
                cursor: pointer;
            }
            
            .collaboration-controls {
                display: flex;
                gap: 8px;
                margin-top: 16px;
            }
            
            .collaboration-controls button {
                flex: 1;
                background: rgba(75, 0, 130, 0.6);
                border: 1px solid rgba(75, 0, 130, 0.4);
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .collaboration-controls button:hover {
                background: rgba(75, 0, 130, 0.8);
                transform: translateY(-1px);
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// Export for global access
window.CollaborationSystem = CollaborationSystem;
window.CollaborationUI = CollaborationUI;