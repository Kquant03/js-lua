// Advanced Asset Management System
// Handles loading, caching, and optimization of game assets

class AssetManager {
    constructor() {
        this.assets = new Map();
        this.loadingPromises = new Map();
        this.cache = new Map();
        this.dependencies = new Map();
        this.referenceCount = new Map();
        
        // Asset types and loaders
        this.loaders = new Map();
        this.processors = new Map();
        
        // Performance tracking
        this.metrics = {
            totalLoaded: 0,
            totalSize: 0,
            loadTime: 0,
            cacheHits: 0,
            cacheMisses: 0
        };
        
        // Streaming and progressive loading
        this.streamingEnabled = true;
        this.preloadQueue = [];
        this.priorityQueue = new PriorityQueue();
        
        // Asset atlasing
        this.atlases = new Map();
        this.atlasBuilder = new AtlasBuilder();
        
        this.initializeAssetManager();
    }
    
    initializeAssetManager() {
        this.registerDefaultLoaders();
        this.setupServiceWorker();
        this.startPreloadWorker();
    }
    
    registerDefaultLoaders() {
        // Image loader
        this.registerLoader('image', new ImageLoader());
        this.registerLoader('sprite', new SpriteLoader());
        
        // Audio loader
        this.registerLoader('audio', new AudioLoader());
        this.registerLoader('music', new AudioLoader());
        
        // Text/Data loaders
        this.registerLoader('json', new JsonLoader());
        this.registerLoader('text', new TextLoader());
        this.registerLoader('csv', new CsvLoader());
        
        // 3D/Model loaders
        this.registerLoader('model', new ModelLoader());
        this.registerLoader('animation', new AnimationLoader());
        
        // Script loader
        this.registerLoader('script', new ScriptLoader());
        this.registerLoader('shader', new ShaderLoader());
        
        // Font loader
        this.registerLoader('font', new FontLoader());
        
        // Compressed formats
        this.registerLoader('compressed', new CompressedLoader());
        
        // Asset bundles
        this.registerLoader('bundle', new BundleLoader());
    }
    
    registerLoader(type, loader) {
        this.loaders.set(type, loader);
    }
    
    registerProcessor(type, processor) {
        this.processors.set(type, processor);
    }
    
    // Core loading methods
    async load(path, type = 'auto', options = {}) {
        const normalizedPath = this.normalizePath(path);
        const resolvedType = type === 'auto' ? this.detectType(normalizedPath) : type;
        
        // Check cache first
        if (this.cache.has(normalizedPath) && !options.reload) {
            this.metrics.cacheHits++;
            this.incrementReference(normalizedPath);
            return this.cache.get(normalizedPath);
        }
        
        this.metrics.cacheMisses++;
        
        // Check if already loading
        if (this.loadingPromises.has(normalizedPath)) {
            return this.loadingPromises.get(normalizedPath);
        }
        
        // Start loading
        const loadPromise = this.performLoad(normalizedPath, resolvedType, options);
        this.loadingPromises.set(normalizedPath, loadPromise);
        
        try {
            const asset = await loadPromise;
            this.cache.set(normalizedPath, asset);
            this.incrementReference(normalizedPath);
            this.loadingPromises.delete(normalizedPath);
            
            this.metrics.totalLoaded++;
            this.metrics.totalSize += asset.size || 0;
            
            this.emit('assetLoaded', { path: normalizedPath, asset, type: resolvedType });
            return asset;
            
        } catch (error) {
            this.loadingPromises.delete(normalizedPath);
            this.emit('assetError', { path: normalizedPath, error, type: resolvedType });
            throw error;
        }
    }
    
    async performLoad(path, type, options) {
        const startTime = performance.now();
        
        try {
            // Get appropriate loader
            const loader = this.loaders.get(type);
            if (!loader) {
                throw new Error(`No loader registered for type: ${type}`);
            }
            
            // Load the asset
            let asset = await loader.load(path, options);
            
            // Apply processors
            const processor = this.processors.get(type);
            if (processor) {
                asset = await processor.process(asset, options);
            }
            
            // Add metadata
            asset.path = path;
            asset.type = type;
            asset.loadTime = performance.now() - startTime;
            asset.timestamp = Date.now();
            
            this.metrics.loadTime += asset.loadTime;
            
            return asset;
            
        } catch (error) {
            console.error(`Failed to load asset: ${path}`, error);
            throw error;
        }
    }
    
    // Addressable asset system
    async loadByAddress(address, options = {}) {
        const path = this.resolveAddress(address);
        if (!path) {
            throw new Error(`Address not found: ${address}`);
        }
        
        return this.load(path, 'auto', options);
    }
    
    registerAddress(address, path, type = 'auto') {
        if (!this.addresses) this.addresses = new Map();
        this.addresses.set(address, { path, type });
    }
    
    resolveAddress(address) {
        if (!this.addresses) return null;
        const entry = this.addresses.get(address);
        return entry ? entry.path : null;
    }
    
    // Batch loading
    async loadBatch(paths, onProgress = null) {
        const promises = paths.map(async (pathInfo, index) => {
            const path = typeof pathInfo === 'string' ? pathInfo : pathInfo.path;
            const type = typeof pathInfo === 'string' ? 'auto' : pathInfo.type;
            const options = typeof pathInfo === 'string' ? {} : pathInfo.options;
            
            try {
                const asset = await this.load(path, type, options);
                if (onProgress) onProgress(index + 1, paths.length, path, asset);
                return { path, asset, success: true };
            } catch (error) {
                if (onProgress) onProgress(index + 1, paths.length, path, null, error);
                return { path, error, success: false };
            }
        });
        
        return Promise.all(promises);
    }
    
    // Preloading system
    preload(paths, priority = 1) {
        if (Array.isArray(paths)) {
            paths.forEach(path => {
                this.priorityQueue.enqueue(path, priority);
            });
        } else {
            this.priorityQueue.enqueue(paths, priority);
        }
        
        this.processPreloadQueue();
    }
    
    async processPreloadQueue() {
        if (this.preloadQueue.length > 0) return; // Already processing
        
        while (!this.priorityQueue.isEmpty()) {
            const { item: path, priority } = this.priorityQueue.dequeue();
            
            try {
                await this.load(path);
            } catch (error) {
                console.warn(`Preload failed for ${path}:`, error);
            }
        }
    }
    
    // Memory management
    unload(path) {
        const normalizedPath = this.normalizePath(path);
        
        if (this.decrementReference(normalizedPath) === 0) {
            const asset = this.cache.get(normalizedPath);
            if (asset && asset.dispose) {
                asset.dispose();
            }
            
            this.cache.delete(normalizedPath);
            this.dependencies.delete(normalizedPath);
            
            this.emit('assetUnloaded', { path: normalizedPath });
        }
    }
    
    incrementReference(path) {
        const current = this.referenceCount.get(path) || 0;
        this.referenceCount.set(path, current + 1);
        return current + 1;
    }
    
    decrementReference(path) {
        const current = this.referenceCount.get(path) || 0;
        const newCount = Math.max(0, current - 1);
        this.referenceCount.set(path, newCount);
        return newCount;
    }
    
    // Garbage collection
    garbageCollect(aggressive = false) {
        const toUnload = [];
        
        for (const [path, refCount] of this.referenceCount) {
            if (refCount === 0) {
                toUnload.push(path);
            }
        }
        
        if (aggressive) {
            // Also unload assets not accessed recently
            const cutoffTime = Date.now() - (5 * 60 * 1000); // 5 minutes
            
            for (const [path, asset] of this.cache) {
                if (asset.lastAccessed && asset.lastAccessed < cutoffTime) {
                    toUnload.push(path);
                }
            }
        }
        
        toUnload.forEach(path => this.unload(path));
        
        return toUnload.length;
    }
    
    // Asset atlasing for optimization
    async createAtlas(imagePaths, atlasName, options = {}) {
        const images = await this.loadBatch(imagePaths.map(path => ({ path, type: 'image' })));
        const successfulImages = images.filter(result => result.success).map(result => result.asset);
        
        const atlas = await this.atlasBuilder.build(successfulImages, {
            name: atlasName,
            maxSize: options.maxSize || 2048,
            padding: options.padding || 2,
            format: options.format || 'rgba'
        });
        
        this.atlases.set(atlasName, atlas);
        this.cache.set(`atlas:${atlasName}`, atlas);
        
        return atlas;
    }
    
    getAtlasRegion(atlasName, regionName) {
        const atlas = this.atlases.get(atlasName);
        return atlas ? atlas.regions.get(regionName) : null;
    }
    
    // Streaming and progressive loading
    async loadProgressive(path, onChunk = null) {
        if (!this.streamingEnabled) {
            return this.load(path);
        }
        
        const response = await fetch(path);
        if (!response.body) {
            return this.load(path); // Fallback
        }
        
        const reader = response.body.getReader();
        const contentLength = response.headers.get('Content-Length');
        const total = contentLength ? parseInt(contentLength) : 0;
        
        let loaded = 0;
        const chunks = [];
        
        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) break;
                
                chunks.push(value);
                loaded += value.length;
                
                if (onChunk) {
                    onChunk(loaded, total, (loaded / total) * 100);
                }
            }
            
            // Combine chunks
            const data = new Uint8Array(loaded);
            let offset = 0;
            
            for (const chunk of chunks) {
                data.set(chunk, offset);
                offset += chunk.length;
            }
            
            // Process the complete data
            const type = this.detectType(path);
            const loader = this.loaders.get(type);
            
            if (loader && loader.processData) {
                return await loader.processData(data, path);
            }
            
            return data;
            
        } finally {
            reader.releaseLock();
        }
    }
    
    // Hot reloading for development
    enableHotReload() {
        if (!this.hotReloadWatcher) {
            this.hotReloadWatcher = new HotReloadWatcher(this);
        }
    }
    
    async reloadAsset(path) {
        const normalizedPath = this.normalizePath(path);
        
        // Force reload
        const asset = await this.load(normalizedPath, 'auto', { reload: true });
        
        this.emit('assetReloaded', { path: normalizedPath, asset });
        return asset;
    }
    
    // Utility methods
    normalizePath(path) {
        return path.replace(/\\/g, '/').replace(/\/+/g, '/');
    }
    
    detectType(path) {
        const extension = path.split('.').pop().toLowerCase();
        
        const typeMap = {
            // Images
            'png': 'image', 'jpg': 'image', 'jpeg': 'image', 'gif': 'image', 
            'bmp': 'image', 'webp': 'image', 'svg': 'image',
            
            // Audio
            'mp3': 'audio', 'wav': 'audio', 'ogg': 'audio', 'aac': 'audio',
            'm4a': 'audio', 'flac': 'audio',
            
            // Data
            'json': 'json', 'txt': 'text', 'csv': 'csv', 'xml': 'text',
            
            // 3D
            'obj': 'model', 'fbx': 'model', 'gltf': 'model', 'glb': 'model',
            
            // Scripts
            'js': 'script', 'lua': 'script', 'py': 'script',
            
            // Shaders
            'glsl': 'shader', 'vert': 'shader', 'frag': 'shader',
            
            // Fonts
            'ttf': 'font', 'otf': 'font', 'woff': 'font', 'woff2': 'font',
            
            // Compressed
            'zip': 'compressed', 'gz': 'compressed', 'br': 'compressed'
        };
        
        return typeMap[extension] || 'text';
    }
    
    // Service Worker for offline caching
    async setupServiceWorker() {
        if ('serviceWorker' in navigator) {
            try {
                await navigator.serviceWorker.register('/asset-cache-sw.js');
                console.log('Asset cache service worker registered');
            } catch (error) {
                console.warn('Service worker registration failed:', error);
            }
        }
    }
    
    startPreloadWorker() {
        // Use Web Worker for background preloading
        if (typeof Worker !== 'undefined') {
            this.preloadWorker = new Worker('/preload-worker.js');
            this.preloadWorker.onmessage = (event) => {
                const { type, data } = event.data;
                
                if (type === 'preloadComplete') {
                    this.emit('preloadComplete', data);
                }
            };
        }
    }
    
    // Events
    emit(event, data) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            for (const callback of this.eventListeners.get(event)) {
                try {
                    callback(data);
                } catch (error) {
                    console.error(`Asset manager event error (${event}):`, error);
                }
            }
        }
    }
    
    on(event, callback) {
        if (!this.eventListeners) this.eventListeners = new Map();
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event).add(callback);
    }
    
    off(event, callback) {
        if (this.eventListeners && this.eventListeners.has(event)) {
            this.eventListeners.get(event).delete(callback);
        }
    }
    
    // Statistics and debugging
    getStats() {
        return {
            ...this.metrics,
            cachedAssets: this.cache.size,
            memoryUsage: this.estimateMemoryUsage(),
            atlases: this.atlases.size
        };
    }
    
    estimateMemoryUsage() {
        let total = 0;
        for (const asset of this.cache.values()) {
            total += asset.size || 0;
        }
        return total;
    }
    
    exportCache() {
        const data = {};
        for (const [path, asset] of this.cache) {
            data[path] = {
                type: asset.type,
                size: asset.size,
                loadTime: asset.loadTime,
                timestamp: asset.timestamp
            };
        }
        return data;
    }
}

// Asset Loaders
class ImageLoader {
    async load(path, options = {}) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            
            img.onload = () => {
                const asset = {
                    element: img,
                    width: img.width,
                    height: img.height,
                    size: img.width * img.height * 4, // Estimate RGBA
                    type: 'image'
                };
                
                // Create canvas for pixel data if needed
                if (options.getPixelData) {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    ctx.drawImage(img, 0, 0);
                    asset.pixelData = ctx.getImageData(0, 0, img.width, img.height);
                }
                
                resolve(asset);
            };
            
            img.onerror = () => reject(new Error(`Failed to load image: ${path}`));
            
            if (options.crossOrigin) {
                img.crossOrigin = options.crossOrigin;
            }
            
            img.src = path;
        });
    }
}

class AudioLoader {
    async load(path, options = {}) {
        try {
            const response = await fetch(path);
            const arrayBuffer = await response.arrayBuffer();
            
            const audioContext = this.getAudioContext();
            const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
            
            return {
                buffer: audioBuffer,
                duration: audioBuffer.duration,
                sampleRate: audioBuffer.sampleRate,
                numberOfChannels: audioBuffer.numberOfChannels,
                size: arrayBuffer.byteLength,
                type: 'audio'
            };
            
        } catch (error) {
            // Fallback to HTML5 audio
            return new Promise((resolve, reject) => {
                const audio = new Audio();
                
                audio.oncanplaythrough = () => {
                    resolve({
                        element: audio,
                        duration: audio.duration,
                        size: 0, // Unknown for HTML5 audio
                        type: 'audio'
                    });
                };
                
                audio.onerror = () => reject(new Error(`Failed to load audio: ${path}`));
                audio.src = path;
            });
        }
    }
    
    getAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        return this.audioContext;
    }
}

class JsonLoader {
    async load(path, options = {}) {
        const response = await fetch(path);
        const data = await response.json();
        
        return {
            data: data,
            size: JSON.stringify(data).length,
            type: 'json'
        };
    }
}

class TextLoader {
    async load(path, options = {}) {
        const response = await fetch(path);
        const text = await response.text();
        
        return {
            data: text,
            size: text.length,
            type: 'text'
        };
    }
}

class ModelLoader {
    async load(path, options = {}) {
        // Simplified model loading - would integrate with libraries like Three.js
        const response = await fetch(path);
        const data = await response.arrayBuffer();
        
        return {
            data: data,
            size: data.byteLength,
            type: 'model'
        };
    }
}

// Priority Queue for asset loading
class PriorityQueue {
    constructor() {
        this.items = [];
    }
    
    enqueue(item, priority) {
        const element = { item, priority };
        let added = false;
        
        for (let i = 0; i < this.items.length; i++) {
            if (element.priority > this.items[i].priority) {
                this.items.splice(i, 0, element);
                added = true;
                break;
            }
        }
        
        if (!added) {
            this.items.push(element);
        }
    }
    
    dequeue() {
        return this.items.shift();
    }
    
    isEmpty() {
        return this.items.length === 0;
    }
}

// Atlas Builder for sprite optimization
class AtlasBuilder {
    async build(images, options = {}) {
        const maxSize = options.maxSize || 2048;
        const padding = options.padding || 2;
        
        // Simple bin packing algorithm
        const regions = new Map();
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        canvas.width = maxSize;
        canvas.height = maxSize;
        
        let currentX = 0;
        let currentY = 0;
        let rowHeight = 0;
        
        for (const image of images) {
            const img = image.element;
            
            // Check if we need a new row
            if (currentX + img.width + padding > maxSize) {
                currentX = 0;
                currentY += rowHeight + padding;
                rowHeight = 0;
            }
            
            // Check if we're out of space
            if (currentY + img.height + padding > maxSize) {
                console.warn('Atlas size exceeded, some images may be missing');
                break;
            }
            
            // Draw image to atlas
            ctx.drawImage(img, currentX, currentY);
            
            // Store region info
            regions.set(image.path, {
                x: currentX,
                y: currentY,
                width: img.width,
                height: img.height,
                u: currentX / maxSize,
                v: currentY / maxSize,
                u2: (currentX + img.width) / maxSize,
                v2: (currentY + img.height) / maxSize
            });
            
            currentX += img.width + padding;
            rowHeight = Math.max(rowHeight, img.height);
        }
        
        return {
            canvas: canvas,
            texture: canvas,
            regions: regions,
            size: maxSize,
            type: 'atlas'
        };
    }
}

// Hot Reload Watcher
class HotReloadWatcher {
    constructor(assetManager) {
        this.assetManager = assetManager;
        this.watchedFiles = new Set();
        this.websocket = null;
        
        this.connect();
    }
    
    connect() {
        try {
            this.websocket = new WebSocket('ws://localhost:8081/hot-reload');
            
            this.websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                
                if (data.type === 'file-changed') {
                    this.assetManager.reloadAsset(data.path);
                }
            };
            
            this.websocket.onclose = () => {
                // Reconnect after delay
                setTimeout(() => this.connect(), 5000);
            };
            
        } catch (error) {
            console.warn('Hot reload connection failed:', error);
        }
    }
    
    watch(path) {
        this.watchedFiles.add(path);
        
        if (this.websocket && this.websocket.readyState === WebSocket.OPEN) {
            this.websocket.send(JSON.stringify({
                type: 'watch',
                path: path
            }));
        }
    }
}

// Additional loader classes would be implemented here...
class SpriteLoader extends ImageLoader {}
class CsvLoader extends TextLoader {}
class ScriptLoader extends TextLoader {}
class ShaderLoader extends TextLoader {}
class FontLoader extends TextLoader {}
class AnimationLoader extends JsonLoader {}
class CompressedLoader extends TextLoader {}
class BundleLoader extends JsonLoader {}

// Export for global access
window.AssetManager = AssetManager;