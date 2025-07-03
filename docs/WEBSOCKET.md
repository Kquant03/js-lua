# DreamMaker Platform - WebSocket API Documentation

## Table of Contents
- [Connection & Authentication](#connection--authentication)
- [Event Overview](#event-overview)
- [Collaboration Events](#collaboration-events)
- [Real-time Operations](#real-time-operations)
- [Presence & Cursors](#presence--cursors)
- [Voice/Video Chat](#voicevideo-chat)
- [Error Handling](#error-handling)
- [Client Implementation Examples](#client-implementation-examples)

---

## Connection & Authentication

### Connection URL
**Development:** `ws://localhost:8080`  
**Production:** `wss://api.dreammaker.dev`

### Authentication
WebSocket connections require JWT authentication via the `auth` object in handshake:

```javascript
const socket = io('ws://localhost:8080', {
  auth: {
    token: 'your_jwt_token_here'
  }
});
```

### Connection Events

#### `connect`
Fired when successfully connected to the server.

```javascript
socket.on('connect', () => {
  console.log('Connected to DreamMaker collaboration server');
  console.log('Socket ID:', socket.id);
});
```

#### `disconnect`
Fired when disconnected from the server.

```javascript
socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
  // Reasons: 'io server disconnect', 'io client disconnect', 'ping timeout', etc.
});
```

#### `connect_error`
Fired when connection fails.

```javascript
socket.on('connect_error', (error) => {
  console.error('Connection failed:', error.message);
  // Common causes: invalid token, server down, network issues
});
```

---

## Event Overview

### Client → Server Events
| Event | Description | Authentication Required |
|-------|-------------|------------------------|
| `join-project` | Join a collaborative project session | ✅ |
| `operation` | Send real-time game state changes | ✅ |
| `batch-operations` | Send multiple operations atomically | ✅ |
| `cursor-update` | Update cursor position | ✅ |
| `selection-update` | Update selected entities | ✅ |
| `presence-update` | Update user status (active/idle/away) | ✅ |
| `typing-start` | Indicate user started typing | ✅ |
| `typing-stop` | Indicate user stopped typing | ✅ |
| `voice-chat-request` | Request voice/video chat | ✅ |
| `webrtc-signal` | WebRTC signaling for voice/video | ✅ |
| `request-sync` | Request missing operations | ✅ |
| `request-full-state` | Request complete project state | ✅ |
| `undo-request` | Request undo operation | ✅ |
| `redo-request` | Request redo operation | ✅ |
| `comment-add` | Add comment/annotation | ✅ |
| `comment-resolve` | Resolve comment | ✅ |
| `user-activity` | Track user activity | ✅ |
| `connection-recovery` | Recover from connection issues | ✅ |

### Server → Client Events
| Event | Description |
|-------|-------------|
| `project-joined` | Confirmation of joining project |
| `user-joined` | Another user joined the project |
| `user-left` | User left the project |
| `operation-applied` | Operation was applied to project |
| `operation-acknowledged` | Confirmation of operation receipt |
| `operation-rejected` | Operation was rejected |
| `operation-error` | Error processing operation |
| `cursor-update` | Another user's cursor moved |
| `selection-update` | Another user's selection changed |
| `presence-update` | User status changed |
| `typing-indicator` | User typing status changed |
| `voice-chat-request` | Incoming voice chat request |
| `voice-chat-announcement` | Voice chat announcement |
| `webrtc-signal` | WebRTC signaling data |
| `sync-response` | Response to sync request |
| `full-sync` | Complete project synchronization |
| `batch-complete` | Batch operations completed |
| `batch-error` | Batch operations failed |
| `error` | General error message |
| `access-denied` | Access denied to project |

---

## Collaboration Events

### join-project

Join a collaborative project session.

**Client → Server:**
```javascript
socket.emit('join-project', {
  projectId: 'game_id_string',
  permissions: {
    canEdit: true,
    canInvite: false,
    canExport: true,
    canDelete: false
  },
  reconnecting: false // true if recovering from disconnect
});
```

**Server → Client (project-joined):**
```javascript
socket.on('project-joined', (data) => {
  const {
    projectId,
    projectState,      // Current game state
    participants,      // Array of current participants
    operationHistory,  // Last 50 operations
    sessionInfo       // Session metadata
  } = data;
  
  console.log(`Joined project ${projectId} with ${participants.length} participants`);
  
  // projectState structure:
  // {
  //   entities: Map,
  //   scenes: Map,
  //   scripts: Map,
  //   assets: { sprites: Map, sounds: Map, tilemaps: Map },
  //   metadata: { name, created, lastModified }
  // }
});
```

### user-joined / user-left

Notifications when users join or leave the project.

**Server → Client:**
```javascript
socket.on('user-joined', (data) => {
  const {
    user: {
      socketId,
      userId,
      username,
      permissions,
      cursor,
      selection,
      viewport,
      status,        // 'active', 'idle', 'away'
      joinedAt,
      voiceChat: {
        enabled,
        muted,
        speaking
      }
    },
    timestamp
  } = data;
  
  console.log(`${username} joined the project`);
  // Update UI to show new collaborator
});

socket.on('user-left', (data) => {
  const { userId, username, reason, timestamp } = data;
  console.log(`${username} left the project (${reason})`);
  // Remove collaborator from UI
});
```

---

## Real-time Operations

### operation

Send real-time changes to the game state.

**Client → Server:**
```javascript
socket.emit('operation', {
  type: 'entity-create',           // Operation type
  payload: {                       // Operation-specific data
    entityId: 'entity_123',
    entityData: {
      name: 'Player Character',
      components: new Map([
        ['transform', {
          position: { x: 0, y: 0, z: 0 },
          rotation: { x: 0, y: 0, z: 0 },
          scale: { x: 1, y: 1, z: 1 }
        }],
        ['sprite', {
          texture: 'player_sprite.png',
          width: 32,
          height: 48
        }]
      ]),
      active: true,
      tags: ['player'],
      layer: 1
    },
    sceneId: 'main_scene'
  },
  lamportClock: 15,               // Logical clock for ordering
  dependencies: [],               // Dependent operation IDs
  tool: 'entity-tool',           // Tool being used
  viewport: {                    // Current viewport
    x: 100, y: 200, zoom: 1.5
  },
  selection: {                   // Current selection
    entities: ['entity_456'],
    type: 'single'
  },
  batch: false                   // Part of batch operation
});
```

**Server → Client (operation-applied):**
```javascript
socket.on('operation-applied', (data) => {
  const {
    operation: {
      id,              // Unique operation ID
      type,            // Operation type
      payload,         // Operation data
      userId,          // User who performed operation
      username,        // Username who performed operation
      timestamp,       // When operation was applied
      lamportClock,    // Logical clock value
      metadata: {      // Additional metadata
        tool,
        viewport,
        selection,
        batch
      }
    },
    appliedBy,         // Username who applied operation
    timestamp          // Server timestamp
  } = data;
  
  // Apply operation to local game state
  applyOperationToGameState(operation);
  
  // Update UI to reflect changes
  updateGameUI();
});
```

**Server → Client (operation-acknowledged):**
```javascript
socket.on('operation-acknowledged', (data) => {
  const { operationId, success, timestamp } = data;
  
  if (success) {
    // Operation was accepted and applied
    markOperationAsConfirmed(operationId);
  }
});
```

**Server → Client (operation-rejected):**
```javascript
socket.on('operation-rejected', (data) => {
  const { operationId, reason, timestamp } = data;
  
  console.warn(`Operation ${operationId} rejected: ${reason}`);
  // Handle rejection (e.g., revert optimistic UI update)
  revertOperation(operationId);
});
```

### Operation Types

#### Entity Operations

**entity-create:**
```javascript
{
  type: 'entity-create',
  payload: {
    entityId: 'unique_entity_id',
    entityData: {
      name: 'Entity Name',
      components: new Map(),
      transform: { position, rotation, scale },
      active: true,
      tags: ['tag1', 'tag2'],
      layer: 0
    },
    sceneId: 'scene_id' // optional
  }
}
```

**entity-update:**
```javascript
{
  type: 'entity-update',
  payload: {
    entityId: 'entity_id',
    updates: {
      name: 'New Name',
      active: false,
      tags: ['updated-tag']
      // Partial updates supported
    }
  }
}
```

**entity-delete:**
```javascript
{
  type: 'entity-delete',
  payload: {
    entityId: 'entity_id',
    sceneId: 'scene_id' // optional
  }
}
```

**entity-move:**
```javascript
{
  type: 'entity-move',
  payload: {
    entityId: 'entity_id',
    newPosition: { x: 100, y: 200, z: 0 },
    newRotation: { x: 0, y: 45, z: 0 },  // optional
    newScale: { x: 1.5, y: 1.5, z: 1 }   // optional
  }
}
```

#### Component Operations

**component-add:**
```javascript
{
  type: 'component-add',
  payload: {
    entityId: 'entity_id',
    componentType: 'physics',
    componentData: {
      mass: 1.0,
      friction: 0.5,
      bounciness: 0.3
    }
  }
}
```

**component-update:**
```javascript
{
  type: 'component-update',
  payload: {
    entityId: 'entity_id',
    componentType: 'transform',
    updates: {
      position: { x: 150, y: 300, z: 0 }
    }
  }
}
```

**component-remove:**
```javascript
{
  type: 'component-remove',
  payload: {
    entityId: 'entity_id',
    componentType: 'physics'
  }
}
```

#### Scene Operations

**scene-update:**
```javascript
{
  type: 'scene-update',
  payload: {
    sceneId: 'scene_id',
    updates: {
      nam