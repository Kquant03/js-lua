# 🎮 DreamMaker Engine Core Documentation

## Overview

The DreamMaker Engine Core is a high-performance, web-based Entity-Component-System (ECS) game engine designed for collaborative game development. Built with modern JavaScript and WebGL, it provides professional-grade tools while maintaining accessibility for beginners.

## 🏗️ Architecture

### Entity-Component-System (ECS) Pattern

The engine follows a pure ECS architecture where:
- **Entities** are unique identifiers (integers)
- **Components** are pure data containers
- **Systems** contain all game logic and operate on entities with specific component combinations

```javascript
// Create an entity
const playerId = engine.createEntity();

// Add components
engine.addComponent(playerId, 'Transform', { x: 100, y: 100 });
engine.addComponent(playerId, 'Sprite', { width: 32, height: 32 });
engine.addComponent(playerId, 'Physics', { velocity: { x: 0, y: 0 } });

// Systems automatically process entities with required components
```

### Core Systems

| System | Purpose | Components Required |
|--------|---------|-------------------|
| **TransformSystem** | Manages position, rotation, scale hierarchies | Transform |
| **PhysicsSystem** | Handles movement, gravity, acceleration | Transform, Physics |
| **CollisionSystem** | Detects and resolves collisions | Transform, Collision |
| **RenderSystem** | Renders sprites and visual elements | Transform, Sprite |
| **ScriptSystem** | Executes game logic scripts | Script |
| **AnimationSystem** | Manages sprite animations | Animation, Sprite |

## 📦 Core Components

### Transform Component
```javascript
{
  x: 0,           // World X position
  y: 0,           // World Y position
  z: 0,           // Z-index for layering
  rotation: 0,    // Rotation in radians
  scaleX: 1,      // Horizontal scale
  scaleY: 1,      // Vertical scale
  parent: null,   // Parent entity ID
  children: []    // Array of child entity IDs
}
```

### Sprite Component
```javascript
{
  texture: null,     // Image or texture reference
  frame: 0,          // Current animation frame
  width: 32,         // Sprite width
  height: 32,        // Sprite height
  visible: true,     // Visibility flag
  alpha: 1,          // Transparency (0-1)
  tint: 0xFFFFFF,    // Color tint
  blendMode: 'normal' // Blend mode
}
```

### Physics Component
```javascript
{
  velocity: { x: 0, y: 0 },      // Current velocity
  acceleration: { x: 0, y: 0 },  // Applied acceleration
  mass: 1,                       // Object mass
  friction: 0.98,                // Friction coefficient
  bounceX: 1,                    // Horizontal bounce factor
  bounceY: 1,                    // Vertical bounce factor
  gravity: 0,                    // Gravity modifier
  maxVelocity: 500               // Maximum velocity
}
```

### Collision Component
```javascript
{
  bounds: { x: 0, y: 0, width: 32, height: 32 }, // Collision rectangle
  solid: true,      // Whether object blocks movement
  trigger: false,   // Whether object is a trigger zone
  groups: [],       // Collision groups this object belongs to
  mask: []          // Groups this object can collide with
}
```

### Script Component
```javascript
{
  source: '',       // Lua or JavaScript source code
  compiled: null,   // Compiled script function
  variables: {},    // Script-local variables
  active: true      // Whether script is active
}
```

### Animation Component
```javascript
{
  frames: [],          // Array of frame indices
  currentFrame: 0,     // Current frame index
  frameDuration: 100,  // Milliseconds per frame
  elapsed: 0,          // Time elapsed in current frame
  playing: false,      // Whether animation is playing
  loop: true          // Whether animation loops
}
```

## 🔧 Core API Reference

### EngineCore Class

#### Constructor
```javascript
const engine = new EngineCore();
```

#### Entity Management
```javascript
// Create entity
const entityId = engine.createEntity(template);

// Destroy entity
engine.destroyEntity(entityId);

// Check if entity exists
const exists = engine.entities.has(entityId);
```

#### Component Management
```javascript
// Register component type
engine.registerComponent('MyComponent', defaultData);

// Add component
engine.addComponent(entityId, 'Transform', { x: 100, y: 50 });

// Get component
const transform = engine.getComponent(entityId, 'Transform');

// Update component
engine.updateComponent(entityId, 'Transform', { x: 200 });

// Remove component
engine.removeComponent(entityId, 'Transform');
```

#### System Management
```javascript
// Register system
engine.registerSystem('MySystem', new MyCustomSystem(engine));

// Remove system
engine.removeSystem('MySystem');

// Get system
const physicsSystem = engine.systems.get('PhysicsSystem');
```

#### Query System
```javascript
// Get entities with specific components
const movableEntities = engine.query('Transform', 'Physics');

// Iterate through results
for (const entity of movableEntities) {
  const transform = entity.Transform;
  const physics = entity.Physics;
  // Process entity...
}
```

#### Game Loop Control
```javascript
// Start engine
engine.start();

// Stop engine
engine.stop();

// Check if running
const isRunning = engine.running;
```

#### Event System
```javascript
// Listen to events
engine.on('componentAdded', (data) => {
  console.log('Component added:', data);
});

// Emit custom events
engine.emit('gameEvent', { type: 'playerWin' });

// Remove event listener
engine.off('componentAdded', callback);
```

#### Serialization
```javascript
// Serialize game state
const gameData = engine.serialize();

// Load game state
engine.deserialize(gameData);
```

## 🎯 Usage Examples

### Creating a Player Character
```javascript
// Create player entity
const playerId = engine.createEntity();

// Add transform for position
engine.addComponent(playerId, 'Transform', {
  x: 400,
  y: 300,
  rotation: 0
});

// Add sprite for visual representation
engine.addComponent(playerId, 'Sprite', {
  width: 32,
  height: 32,
  tint: 0x00FF00, // Green color
  visible: true
});

// Add physics for movement
engine.addComponent(playerId, 'Physics', {
  velocity: { x: 0, y: 0 },
  friction: 0.9,
  maxVelocity: 200
});

// Add collision detection
engine.addComponent(playerId, 'Collision', {
  bounds: { x: -16, y: -16, width: 32, height: 32 },
  solid: true
});

// Add player control script
engine.addComponent(playerId, 'Script', {
  source: `
    function update(deltaTime) {
      const speed = 150;
      
      if (Input.isKeyDown('a')) {
        physics.velocity.x = -speed;
      } else if (Input.isKeyDown('d')) {
        physics.velocity.x = speed;
      }
      
      if (Input.isKeyPressed(' ')) {
        physics.velocity.y = -300; // Jump
      }
    }
  `
});
```

### Creating an Animated Enemy
```javascript
const enemyId = engine.createEntity();

engine.addComponent(enemyId, 'Transform', { x: 200, y: 200 });

engine.addComponent(enemyId, 'Sprite', {
  width: 24,
  height: 24,
  tint: 0xFF0000 // Red color
});

// Add animation
engine.addComponent(enemyId, 'Animation', {
  frames: [0, 1, 2, 1], // Frame sequence
  frameDuration: 200,   // 200ms per frame
  playing: true,
  loop: true
});

// Add AI behavior
engine.addComponent(enemyId, 'Script', {
  source: `
    function update(deltaTime) {
      // Simple patrol behavior
      if (!this.direction) this.direction = 1;
      
      transform.x += this.direction * 50 * deltaTime;
      
      // Turn around at boundaries
      if (transform.x > 600 || transform.x < 100) {
        this.direction *= -1;
      }
    }
  `
});
```

### Creating a Custom System
```javascript
class HealthSystem {
  constructor(engine) {
    this.engine = engine;
    this.active = true;
  }
  
  update(deltaTime) {
    // Process all entities with Health component
    const entities = this.engine.query('Health', 'Transform');
    
    for (const entity of entities) {
      const health = entity.Health;
      const transform = entity.Transform;
      
      // Health regeneration
      if (health.current < health.max) {
        health.current += health.regenRate * deltaTime;
        health.current = Math.min(health.current, health.max);
      }
      
      // Check for death
      if (health.current <= 0) {
        this.engine.emit('entityDied', { entityId: entity.id });
        this.engine.destroyEntity(entity.id);
      }
    }
  }
}

// Register the custom system
engine.registerSystem('HealthSystem', new HealthSystem(engine));

// Register Health component
engine.registerComponent('Health', {
  current: 100,
  max: 100,
  regenRate: 5 // HP per second
});
```

## ⚡ Performance Features

### Object Pooling
```javascript
// Components are automatically pooled for performance
// No manual memory management required

// Efficient entity queries with caching
const cachedQuery = engine.query('Transform', 'Sprite');
```

### Hot Reloading
```javascript
// Enable hot reloading for development
engine.enableHotReload('MyComponent', componentCode);

// Components and systems can be updated without restart
```

### Efficient Rendering
```javascript
// Automatic sprite batching reduces draw calls
// Frustum culling for off-screen objects
// Z-index sorting for proper layering
```

## 🔌 Extension Points

### Custom Components
```javascript
// Register new component types
engine.registerComponent('Inventory', {
  items: [],
  capacity: 10,
  gold: 0
});

// Components can contain any data structure
engine.registerComponent('DialogueTree', {
  conversations: new Map(),
  currentNode: null,
  variables: {}
});
```

### Custom Systems
```javascript
class NetworkSystem {
  constructor(engine) {
    this.engine = engine;
    this.active = true;
    this.socket = null;
  }
  
  init() {
    // Initialize networking
    this.socket = new WebSocket('ws://localhost:8080');
  }
  
  update(deltaTime) {
    // Sync networked entities
    const networked = this.engine.query('Transform', 'Networked');
    
    for (const entity of networked) {
      this.syncEntity(entity);
    }
  }
  
  syncEntity(entity) {
    // Send entity state over network
    this.socket.send(JSON.stringify({
      type: 'entityUpdate',
      id: entity.id,
      transform: entity.Transform
    }));
  }
  
  destroy() {
    if (this.socket) {
      this.socket.close();
    }
  }
}
```

## 🐛 Debugging Features

### Performance Monitoring
```javascript
// Access performance metrics
const metrics = engine.performanceMetrics;
console.log('Frame time:', metrics.frameTime);
console.log('System times:', metrics.systemTime);
console.log('FPS:', engine.fps);
```

### Entity Inspector
```javascript
// Inspect entity components
const entity = engine.entities.get(entityId);
console.log('Components:', Array.from(entity.components));

// Get all entities with specific component
const sprites = engine.components.get('Sprite');
console.log('Sprite entities:', Array.from(sprites.keys()));
```

### Event Debugging
```javascript
// Log all engine events
engine.on('*', (eventName, data) => {
  console.log(`Event: ${eventName}`, data);
});
```

## 🚀 Best Practices

### Entity Creation
```javascript
// Use templates for consistent entity creation
const playerTemplate = {
  Transform: { x: 0, y: 0 },
  Sprite: { width: 32, height: 32 },
  Physics: { mass: 1 },
  Collision: { bounds: { width: 32, height: 32 } }
};

const playerId = engine.createEntity(playerTemplate);
```

### Component Design
```javascript
// Keep components as pure data
// ✅ Good
{
  health: 100,
  maxHealth: 100,
  armor: 10
}

// ❌ Avoid methods in components
{
  health: 100,
  takeDamage: function(amount) { ... } // Don't do this
}
```

### System Organization
```javascript
// Systems should be focused and single-purpose
// ✅ Good: MovementSystem, CollisionSystem, RenderSystem
// ❌ Avoid: GameplaySystem (too broad)

// Systems should not directly modify other systems
// Use events for cross-system communication
```

### Memory Management
```javascript
// Clean up entities when no longer needed
engine.destroyEntity(entityId);

// Use object pooling for frequently created/destroyed entities
// The engine handles this automatically for components
```

## 🔗 Integration

### Asset Manager Integration
```javascript
// Load assets before creating entities
const texture = await assetManager.load('player.png', 'image');

engine.addComponent(playerId, 'Sprite', {
  texture: texture.element,
  width: texture.width,
  height: texture.height
});
```

### Collaboration System Integration
```javascript
// Engine events are automatically synchronized
// Component changes trigger collaboration events
engine.on('componentUpdated', (data) => {
  collaboration.broadcastOperation('componentUpdated', data);
});
```

### AI System Integration
```javascript
// AI can analyze and modify game state
const gameState = engine.serialize();
const optimizations = await aiSystem.analyzePerformance(gameState);

// Apply AI suggestions
optimizations.forEach(opt => {
  engine.updateComponent(opt.entityId, opt.component, opt.changes);
});
```

## 📊 Performance Benchmarks

| Metric | Target | Typical |
|--------|--------|---------|
| Entities | 10,000+ | 5,000 |
| Components per Entity | 8+ | 4-6 |
| Frame Rate | 60 FPS | 60 FPS |
| Memory Usage | <100MB | 45MB |
| System Update Time | <16ms | 8ms |

## 🔮 Future Enhancements

- **WebGPU Support** - GPU-accelerated compute shaders
- **Multi-threading** - Web Workers for physics simulation
- **Spatial Partitioning** - Quadtree/Octree for collision optimization
- **Component Serialization** - Binary format for faster loading
- **Visual Debugging** - Real-time system profiler
- **Plugin System** - Dynamic system loading

The DreamMaker Engine Core provides a solid foundation for building high-performance web games while maintaining the flexibility to extend and customize for specific needs.