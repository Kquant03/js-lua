// Advanced ECS Game Engine Core - Next Generation Platform
// Implements high-performance Entity-Component-System with real-time collaboration

class EngineCore {
    constructor() {
        this.entities = new Map();
        this.components = new Map();
        this.systems = new Map();
        this.scenes = new Map();
        this.currentScene = null;
        this.nextEntityId = 1;
        this.running = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.frameCount = 0;
        this.fps = 60;
        
        // Performance monitoring
        this.performanceMetrics = {
            frameTime: 0,
            systemTime: new Map(),
            memoryUsage: 0,
            drawCalls: 0
        };
        
        // Hot-reloading support
        this.hotReloadCache = new Map();
        this.dependencies = new Map();
        
        // Event system
        this.eventListeners = new Map();
        
        this.initializeCoreSystems();
    }
    
    initializeCoreSystems() {
        // Register core component types
        this.registerComponent('Transform', {
            x: 0, y: 0, z: 0,
            rotation: 0, scaleX: 1, scaleY: 1,
            parent: null, children: []
        });
        
        this.registerComponent('Sprite', {
            texture: null, frame: 0,
            width: 32, height: 32,
            visible: true, alpha: 1,
            tint: 0xFFFFFF, blendMode: 'normal'
        });
        
        this.registerComponent('Physics', {
            velocity: { x: 0, y: 0 },
            acceleration: { x: 0, y: 0 },
            mass: 1, friction: 0.98,
            bounceX: 1, bounceY: 1,
            gravity: 0, maxVelocity: 500
        });
        
        this.registerComponent('Collision', {
            bounds: { x: 0, y: 0, width: 32, height: 32 },
            solid: true, trigger: false,
            groups: [], mask: []
        });
        
        this.registerComponent('Script', {
            source: '', compiled: null,
            variables: {}, active: true
        });
        
        this.registerComponent('Animation', {
            frames: [], currentFrame: 0,
            frameDuration: 100, elapsed: 0,
            playing: false, loop: true
        });
        
        // Register core systems
        this.registerSystem('TransformSystem', new TransformSystem(this));
        this.registerSystem('PhysicsSystem', new PhysicsSystem(this));
        this.registerSystem('CollisionSystem', new CollisionSystem(this));
        this.registerSystem('RenderSystem', new RenderSystem(this));
        this.registerSystem('ScriptSystem', new ScriptSystem(this));
        this.registerSystem('AnimationSystem', new AnimationSystem(this));
    }
    
    // Entity Management
    createEntity(template = {}) {
        const entityId = this.nextEntityId++;
        const entity = { id: entityId, components: new Set(), active: true };
        this.entities.set(entityId, entity);
        
        // Apply template
        for (const [componentType, data] of Object.entries(template)) {
            this.addComponent(entityId, componentType, data);
        }
        
        this.emit('entityCreated', { entityId, entity });
        return entityId;
    }
    
    destroyEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (!entity) return;
        
        // Remove all components
        for (const componentType of entity.components) {
            this.removeComponent(entityId, componentType);
        }
        
        this.entities.delete(entityId);
        this.emit('entityDestroyed', { entityId });
    }
    
    // Component Management
    registerComponent(type, defaultData = {}) {
        if (!this.components.has(type)) {
            this.components.set(type, new Map());
        }
        
        // Store default structure for validation
        this.components.get(type).defaultData = defaultData;
    }
    
    addComponent(entityId, type, data = {}) {
        const entity = this.entities.get(entityId);
        if (!entity) return false;
        
        if (!this.components.has(type)) {
            this.registerComponent(type);
        }
        
        const componentMap = this.components.get(type);
        const defaultData = componentMap.defaultData || {};
        const componentData = { ...defaultData, ...data };
        
        componentMap.set(entityId, componentData);
        entity.components.add(type);
        
        this.emit('componentAdded', { entityId, type, data: componentData });
        return true;
    }
    
    removeComponent(entityId, type) {
        const entity = this.entities.get(entityId);
        if (!entity) return false;
        
        const componentMap = this.components.get(type);
        if (componentMap && componentMap.has(entityId)) {
            componentMap.delete(entityId);
            entity.components.delete(type);
            this.emit('componentRemoved', { entityId, type });
            return true;
        }
        return false;
    }
    
    getComponent(entityId, type) {
        const componentMap = this.components.get(type);
        return componentMap ? componentMap.get(entityId) : null;
    }
    
    updateComponent(entityId, type, data) {
        const componentMap = this.components.get(type);
        if (componentMap && componentMap.has(entityId)) {
            const current = componentMap.get(entityId);
            Object.assign(current, data);
            this.emit('componentUpdated', { entityId, type, data: current });
            return true;
        }
        return false;
    }
    
    // Query System for efficient entity filtering
    query(...componentTypes) {
        const results = [];
        for (const [entityId, entity] of this.entities) {
            if (!entity.active) continue;
            
            let hasAll = true;
            for (const type of componentTypes) {
                if (!entity.components.has(type)) {
                    hasAll = false;
                    break;
                }
            }
            
            if (hasAll) {
                const entityData = { id: entityId };
                for (const type of componentTypes) {
                    entityData[type] = this.getComponent(entityId, type);
                }
                results.push(entityData);
            }
        }
        return results;
    }
    
    // System Management
    registerSystem(name, system) {
        this.systems.set(name, system);
        system.engine = this;
        if (system.init) system.init();
    }
    
    removeSystem(name) {
        const system = this.systems.get(name);
        if (system && system.destroy) system.destroy();
        this.systems.delete(name);
    }
    
    // Scene Management
    createScene(name) {
        const scene = {
            name,
            entities: new Set(),
            cameras: [],
            layers: new Map(),
            properties: {}
        };
        this.scenes.set(name, scene);
        return scene;
    }
    
    switchScene(name) {
        const scene = this.scenes.get(name);
        if (!scene) return false;
        
        this.currentScene = scene;
        this.emit('sceneChanged', { scene });
        return true;
    }
    
    // Main Loop
    start() {
        if (this.running) return;
        this.running = true;
        this.lastTime = performance.now();
        this.gameLoop();
        this.emit('engineStarted');
    }
    
    stop() {
        this.running = false;
        this.emit('engineStopped');
    }
    
    gameLoop() {
        if (!this.running) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        this.frameCount++;
        
        // Performance monitoring
        const frameStart = performance.now();
        
        // Update systems
        for (const [name, system] of this.systems) {
            if (!system.active) continue;
            
            const systemStart = performance.now();
            try {
                system.update(this.deltaTime);
            } catch (error) {
                console.error(`System ${name} error:`, error);
            }
            
            this.performanceMetrics.systemTime.set(name, performance.now() - systemStart);
        }
        
        // Calculate performance metrics
        this.performanceMetrics.frameTime = performance.now() - frameStart;
        if (this.frameCount % 60 === 0) {
            this.fps = 1000 / this.performanceMetrics.frameTime;
            this.emit('performanceUpdate', this.performanceMetrics);
        }
        
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // Event System
    on(event, callback) {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }
    
    off(event, callback) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(callback);
        }
    }
    
    emit(event, data = {}) {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const callback of listeners) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Event listener error for ${event}:`, error);
                }
            }
        }
    }
    
    // Hot Reloading
    enableHotReload(componentType, moduleCode) {
        const oldModule = this.hotReloadCache.get(componentType);
        this.hotReloadCache.set(componentType, moduleCode);
        
        // Recompile and update
        try {
            const newComponent = new Function('return ' + moduleCode)();
            this.registerComponent(componentType, newComponent);
            
            // Update existing instances
            const componentMap = this.components.get(componentType);
            if (componentMap) {
                for (const [entityId, data] of componentMap) {
                    this.emit('componentHotReloaded', { entityId, componentType, data });
                }
            }
        } catch (error) {
            console.error(`Hot reload failed for ${componentType}:`, error);
        }
    }
    
    // Asset Integration
    loadAsset(path, type = 'auto') {
        return window.assetManager ? window.assetManager.load(path, type) : null;
    }
    
    // Serialization for saving/loading
    serialize() {
        const data = {
            entities: [],
            scene: this.currentScene ? this.currentScene.name : null,
            properties: {}
        };
        
        for (const [entityId, entity] of this.entities) {
            const entityData = { id: entityId, components: {} };
            for (const componentType of entity.components) {
                entityData.components[componentType] = this.getComponent(entityId, componentType);
            }
            data.entities.push(entityData);
        }
        
        return data;
    }
    
    deserialize(data) {
        // Clear current state
        this.entities.clear();
        this.nextEntityId = 1;
        
        // Recreate entities
        for (const entityData of data.entities) {
            const entityId = this.createEntity();
            for (const [componentType, componentData] of Object.entries(entityData.components)) {
                this.addComponent(entityId, componentType, componentData);
            }
        }
        
        // Switch scene
        if (data.scene) {
            this.switchScene(data.scene);
        }
    }
}

// Core Systems Implementation

class TransformSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
    }
    
    update(deltaTime) {
        const entities = this.engine.query('Transform');
        
        for (const entity of entities) {
            const transform = entity.Transform;
            
            // Update world transform based on parent
            if (transform.parent) {
                const parentTransform = this.engine.getComponent(transform.parent, 'Transform');
                if (parentTransform) {
                    transform.worldX = parentTransform.worldX + transform.x;
                    transform.worldY = parentTransform.worldY + transform.y;
                    transform.worldRotation = parentTransform.worldRotation + transform.rotation;
                } else {
                    transform.worldX = transform.x;
                    transform.worldY = transform.y;
                    transform.worldRotation = transform.rotation;
                }
            } else {
                transform.worldX = transform.x;
                transform.worldY = transform.y;
                transform.worldRotation = transform.rotation;
            }
        }
    }
}

class PhysicsSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
    }
    
    update(deltaTime) {
        const entities = this.engine.query('Transform', 'Physics');
        
        for (const entity of entities) {
            const transform = entity.Transform;
            const physics = entity.Physics;
            
            // Apply gravity
            physics.velocity.y += physics.gravity * deltaTime;
            
            // Apply acceleration
            physics.velocity.x += physics.acceleration.x * deltaTime;
            physics.velocity.y += physics.acceleration.y * deltaTime;
            
            // Apply friction
            physics.velocity.x *= physics.friction;
            physics.velocity.y *= physics.friction;
            
            // Clamp to max velocity
            const speed = Math.sqrt(physics.velocity.x ** 2 + physics.velocity.y ** 2);
            if (speed > physics.maxVelocity) {
                const scale = physics.maxVelocity / speed;
                physics.velocity.x *= scale;
                physics.velocity.y *= scale;
            }
            
            // Update position
            transform.x += physics.velocity.x * deltaTime;
            transform.y += physics.velocity.y * deltaTime;
        }
    }
}

class CollisionSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
    }
    
    update(deltaTime) {
        const entities = this.engine.query('Transform', 'Collision');
        
        // Simple AABB collision detection
        for (let i = 0; i < entities.length; i++) {
            for (let j = i + 1; j < entities.length; j++) {
                const entityA = entities[i];
                const entityB = entities[j];
                
                if (this.checkCollision(entityA, entityB)) {
                    this.engine.emit('collision', {
                        entityA: entityA.id,
                        entityB: entityB.id
                    });
                    
                    // Handle physics collision
                    if (entityA.Physics && entityB.Physics) {
                        this.resolveCollision(entityA, entityB);
                    }
                }
            }
        }
    }
    
    checkCollision(entityA, entityB) {
        const transformA = entityA.Transform;
        const collisionA = entityA.Collision;
        const transformB = entityB.Transform;
        const collisionB = entityB.Collision;
        
        const boundsA = {
            x: transformA.x + collisionA.bounds.x,
            y: transformA.y + collisionA.bounds.y,
            width: collisionA.bounds.width,
            height: collisionA.bounds.height
        };
        
        const boundsB = {
            x: transformB.x + collisionB.bounds.x,
            y: transformB.y + collisionB.bounds.y,
            width: collisionB.bounds.width,
            height: collisionB.bounds.height
        };
        
        return boundsA.x < boundsB.x + boundsB.width &&
               boundsA.x + boundsA.width > boundsB.x &&
               boundsA.y < boundsB.y + boundsB.height &&
               boundsA.y + boundsA.height > boundsB.y;
    }
    
    resolveCollision(entityA, entityB) {
        const physicsA = entityA.Physics;
        const physicsB = entityB.Physics;
        
        // Simple bounce physics
        const tempVelX = physicsA.velocity.x;
        const tempVelY = physicsA.velocity.y;
        
        physicsA.velocity.x = physicsB.velocity.x * physicsA.bounceX;
        physicsA.velocity.y = physicsB.velocity.y * physicsA.bounceY;
        
        physicsB.velocity.x = tempVelX * physicsB.bounceX;
        physicsB.velocity.y = tempVelY * physicsB.bounceY;
    }
}

class RenderSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
        this.canvas = null;
        this.ctx = null;
        this.camera = { x: 0, y: 0, zoom: 1 };
    }
    
    init() {
        this.canvas = document.getElementById('gameCanvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
        }
    }
    
    update(deltaTime) {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Get renderable entities
        const entities = this.engine.query('Transform', 'Sprite');
        
        // Sort by z-index
        entities.sort((a, b) => (a.Transform.z || 0) - (b.Transform.z || 0));
        
        for (const entity of entities) {
            this.renderSprite(entity);
        }
    }
    
    renderSprite(entity) {
        const transform = entity.Transform;
        const sprite = entity.Sprite;
        
        if (!sprite.visible || sprite.alpha <= 0) return;
        
        this.ctx.save();
        
        // Apply camera transform
        const screenX = (transform.worldX || transform.x) - this.camera.x;
        const screenY = (transform.worldY || transform.y) - this.camera.y;
        
        // Apply transformations
        this.ctx.translate(screenX, screenY);
        this.ctx.rotate(transform.worldRotation || transform.rotation);
        this.ctx.scale(transform.scaleX * this.camera.zoom, transform.scaleY * this.camera.zoom);
        this.ctx.globalAlpha = sprite.alpha;
        
        // Render sprite (placeholder rectangle for now)
        this.ctx.fillStyle = `hsl(${sprite.tint % 360}, 70%, 50%)`;
        this.ctx.fillRect(-sprite.width / 2, -sprite.height / 2, sprite.width, sprite.height);
        
        this.ctx.restore();
    }
}

class ScriptSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
        this.luaRuntime = window.dreamEmulator;
    }
    
    update(deltaTime) {
        const entities = this.engine.query('Script');
        
        for (const entity of entities) {
            const script = entity.Script;
            
            if (!script.active || !script.source) continue;
            
            // Compile script if needed
            if (!script.compiled && script.source) {
                this.compileScript(entity.id, script);
            }
            
            // Execute update function
            if (script.compiled && script.compiled.update) {
                try {
                    script.compiled.update(deltaTime, entity.id);
                } catch (error) {
                    console.error(`Script error in entity ${entity.id}:`, error);
                }
            }
        }
    }
    
    compileScript(entityId, script) {
        try {
            if (this.luaRuntime) {
                // Use Lua runtime
                this.luaRuntime.wasmRunCode(script.source);
                script.compiled = { lua: true };
            } else {
                // Fallback to JavaScript
                script.compiled = new Function('deltaTime', 'entityId', 'engine', script.source);
            }
        } catch (error) {
            console.error(`Script compilation error for entity ${entityId}:`, error);
        }
    }
}

class AnimationSystem {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
    }
    
    update(deltaTime) {
        const entities = this.engine.query('Animation', 'Sprite');
        
        for (const entity of entities) {
            const animation = entity.Animation;
            const sprite = entity.Sprite;
            
            if (!animation.playing || animation.frames.length === 0) continue;
            
            animation.elapsed += deltaTime * 1000;
            
            if (animation.elapsed >= animation.frameDuration) {
                animation.elapsed = 0;
                animation.currentFrame++;
                
                if (animation.currentFrame >= animation.frames.length) {
                    if (animation.loop) {
                        animation.currentFrame = 0;
                    } else {
                        animation.playing = false;
                        animation.currentFrame = animation.frames.length - 1;
                    }
                }
                
                // Update sprite frame
                if (animation.frames[animation.currentFrame]) {
                    sprite.frame = animation.frames[animation.currentFrame];
                }
            }
        }
    }
}

// Export for global access
window.EngineCore = EngineCore;