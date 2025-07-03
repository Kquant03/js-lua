// Community & Export System
// Handles game sharing, discovery, publishing, and deployment

class CommunitySystem {
    constructor(engine) {
        this.engine = engine;
        this.apiEndpoint = 'https://api.dreammaker.dev';
        this.user = null;
        this.games = new Map();
        this.following = new Set();
        this.feeds = new Map();
        
        // Community features
        this.marketplace = new GameMarketplace(this);
        this.socialFeatures = new SocialFeatures(this);
        this.discoveryEngine = new DiscoveryEngine(this);
        this.mentorship = new MentorshipSystem(this);
        
        this.initializeCommunity();
    }
    
    initializeCommunity() {
        this.loadUserProfile();
        this.setupEventHandlers();
        this.createCommunityUI();
    }
    
    loadUserProfile() {
        const saved = localStorage.getItem('dreammaker_user');
        if (saved) {
            this.user = JSON.parse(saved);
            this.authenticateUser();
        }
    }
    
    async authenticateUser() {
        try {
            const response = await fetch(`${this.apiEndpoint}/auth/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                }
            });
            
            if (response.ok) {
                const userData = await response.json();
                this.user = { ...this.user, ...userData };
                this.emit('userAuthenticated', this.user);
            } else {
                this.logout();
            }
        } catch (error) {
            console.warn('Authentication failed:', error);
        }
    }
    
    async login(email, password) {
        try {
            const response = await fetch(`${this.apiEndpoint}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.user = data.user;
                localStorage.setItem('dreammaker_user', JSON.stringify(this.user));
                this.emit('userLoggedIn', this.user);
                return true;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Login failed:', error);
            return false;
        }
    }
    
    async register(userData) {
        try {
            const response = await fetch(`${this.apiEndpoint}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });
            
            const data = await response.json();
            
            if (response.ok) {
                this.user = data.user;
                localStorage.setItem('dreammaker_user', JSON.stringify(this.user));
                this.emit('userRegistered', this.user);
                return true;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Registration failed:', error);
            return false;
        }
    }
    
    logout() {
        this.user = null;
        localStorage.removeItem('dreammaker_user');
        this.emit('userLoggedOut');
    }
    
    // Game publishing
    async publishGame(gameData, metadata) {
        if (!this.user) {
            throw new Error('Must be logged in to publish games');
        }
        
        const publishData = {
            ...metadata,
            gameData: gameData,
            authorId: this.user.id,
            publishedAt: new Date(),
            version: '1.0.0'
        };
        
        try {
            const response = await fetch(`${this.apiEndpoint}/games/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                },
                body: JSON.stringify(publishData)
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.emit('gamePublished', result);
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Publishing failed:', error);
            throw error;
        }
    }
    
    async updateGame(gameId, gameData, metadata) {
        try {
            const response = await fetch(`${this.apiEndpoint}/games/${gameId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                },
                body: JSON.stringify({ gameData, ...metadata })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.emit('gameUpdated', result);
                return result;
            } else {
                throw new Error(result.message);
            }
        } catch (error) {
            console.error('Update failed:', error);
            throw error;
        }
    }
    
    // Game discovery
    async searchGames(query, filters = {}) {
        const params = new URLSearchParams({
            q: query,
            ...filters
        });
        
        try {
            const response = await fetch(`${this.apiEndpoint}/games/search?${params}`);
            const data = await response.json();
            
            if (response.ok) {
                return data.games;
            } else {
                throw new Error(data.message);
            }
        } catch (error) {
            console.error('Search failed:', error);
            return [];
        }
    }
    
    async getFeaturedGames() {
        try {
            const response = await fetch(`${this.apiEndpoint}/games/featured`);
            const data = await response.json();
            return data.games || [];
        } catch (error) {
            console.error('Failed to load featured games:', error);
            return [];
        }
    }
    
    async getTrendingGames() {
        try {
            const response = await fetch(`${this.apiEndpoint}/games/trending`);
            const data = await response.json();
            return data.games || [];
        } catch (error) {
            console.error('Failed to load trending games:', error);
            return [];
        }
    }
    
    // Social features
    async followUser(userId) {
        if (!this.user) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/users/${userId}/follow`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.user.token}` }
            });
            
            if (response.ok) {
                this.following.add(userId);
                this.emit('userFollowed', userId);
                return true;
            }
        } catch (error) {
            console.error('Follow failed:', error);
        }
        return false;
    }
    
    async likeGame(gameId) {
        if (!this.user) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/games/${gameId}/like`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${this.user.token}` }
            });
            
            if (response.ok) {
                this.emit('gameLiked', gameId);
                return true;
            }
        } catch (error) {
            console.error('Like failed:', error);
        }
        return false;
    }
    
    async commentOnGame(gameId, comment) {
        if (!this.user) return false;
        
        try {
            const response = await fetch(`${this.apiEndpoint}/games/${gameId}/comments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                },
                body: JSON.stringify({ comment })
            });
            
            const result = await response.json();
            
            if (response.ok) {
                this.emit('commentAdded', result);
                return result;
            }
        } catch (error) {
            console.error('Comment failed:', error);
        }
        return false;
    }
    
    createCommunityUI() {
        this.ui = new CommunityUI(this);
    }
    
    setupEventHandlers() {
        // Listen for game events
        this.engine.on('gameCompleted', (data) => {
            this.trackGameplay(data);
        });
    }
    
    async trackGameplay(data) {
        if (!this.user) return;
        
        try {
            await fetch(`${this.apiEndpoint}/analytics/gameplay`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.user.token}`
                },
                body: JSON.stringify(data)
            });
        } catch (error) {
            console.warn('Analytics tracking failed:', error);
        }
    }
    
    // Event system
    emit(event, data) {
        if (this.engine && this.engine.emit) {
            this.engine.emit(`community:${event}`, data);
        }
    }
}

// Game Export and Deployment System
class ExportSystem {
    constructor(engine) {
        this.engine = engine;
        this.builders = new Map();
        this.platforms = new Map();
        
        this.registerDefaultBuilders();
        this.registerDefaultPlatforms();
    }
    
    registerDefaultBuilders() {
        this.registerBuilder('web', new WebBuilder());
        this.registerBuilder('desktop', new DesktopBuilder());
        this.registerBuilder('mobile', new MobileBuilder());
        this.registerBuilder('console', new ConsoleBuilder());
    }
    
    registerDefaultPlatforms() {
        // Web platforms
        this.registerPlatform('itch', new ItchPlatform());
        this.registerPlatform('newgrounds', new NewgroundsPlatform());
        this.registerPlatform('gamejolt', new GameJoltPlatform());
        
        // Mobile platforms
        this.registerPlatform('play-store', new PlayStorePlatform());
        this.registerPlatform('app-store', new AppStorePlatform());
        
        // Desktop platforms
        this.registerPlatform('steam', new SteamPlatform());
        this.registerPlatform('epic', new EpicPlatform());
        
        // Console platforms (if supported)
        this.registerPlatform('nintendo-switch', new NintendoPlatform());
    }
    
    registerBuilder(name, builder) {
        this.builders.set(name, builder);
    }
    
    registerPlatform(name, platform) {
        this.platforms.set(name, platform);
    }
    
    async exportGame(target, options = {}) {
        const builder = this.builders.get(target);
        if (!builder) {
            throw new Error(`No builder available for target: ${target}`);
        }
        
        const gameData = this.engine.serialize();
        const assetManifest = this.generateAssetManifest();
        
        const buildConfig = {
            gameData,
            assetManifest,
            target,
            options,
            timestamp: Date.now()
        };
        
        return await builder.build(buildConfig);
    }
    
    async deployToPlatform(platformName, buildResult, credentials) {
        const platform = this.platforms.get(platformName);
        if (!platform) {
            throw new Error(`Platform not supported: ${platformName}`);
        }
        
        return await platform.deploy(buildResult, credentials);
    }
    
    generateAssetManifest() {
        // Generate manifest of all game assets
        const manifest = {
            images: [],
            audio: [],
            data: [],
            scripts: [],
            totalSize: 0
        };
        
        // This would scan the asset manager for all loaded assets
        // and generate appropriate manifest data
        
        return manifest;
    }
}

// Platform-specific builders
class WebBuilder {
    async build(config) {
        console.log('Building for web platform...');
        
        const template = this.generateWebTemplate(config);
        const bundle = await this.bundleAssets(config);
        
        return {
            platform: 'web',
            files: {
                'index.html': template,
                'game.js': this.generateGameScript(config),
                'assets.json': JSON.stringify(bundle.manifest),
                ...bundle.assets
            },
            size: this.calculateBundleSize(bundle),
            deploymentReady: true
        };
    }
    
    generateWebTemplate(config) {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${config.options.title || 'My Game'}</title>
    <style>
        body { margin: 0; padding: 0; background: #000; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
        canvas { max-width: 100%; max-height: 100%; }
        .loading { color: white; font-family: Arial, sans-serif; }
    </style>
</head>
<body>
    <canvas id="gameCanvas" width="800" height="600"></canvas>
    <div class="loading" id="loading">Loading...</div>
    
    <script src="game.js"></script>
    <script>
        // Initialize game when loaded
        window.addEventListener('load', () => {
            const game = new DreamMakerGame();
            game.initialize('gameCanvas');
            game.load(${JSON.stringify(config.gameData)});
            document.getElementById('loading').style.display = 'none';
        });
    </script>
</body>
</html>`;
    }
    
    generateGameScript(config) {
        // This would bundle the engine code with the game data
        return `
// DreamMaker Runtime Engine (Minified)
class DreamMakerGame {
    constructor() {
        this.engine = new EngineCore();
        this.canvas = null;
        this.ctx = null;
    }
    
    initialize(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        // Initialize rendering and input systems
    }
    
    load(gameData) {
        this.engine.deserialize(gameData);
        this.engine.start();
        this.gameLoop();
    }
    
    gameLoop() {
        // Main game loop
        this.engine.update(1/60);
        this.render();
        requestAnimationFrame(() => this.gameLoop());
    }
    
    render() {
        // Render the game
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        // Render entities, etc.
    }
}

// Include engine components here...
        `;
    }
    
    async bundleAssets(config) {
        // Bundle and optimize all game assets
        return {
            manifest: config.assetManifest,
            assets: {},
            optimizations: []
        };
    }
    
    calculateBundleSize(bundle) {
        // Calculate total bundle size
        return 0;
    }
}

class DesktopBuilder {
    async build(config) {
        console.log('Building for desktop platform...');
        
        // Use Tauri or Electron for desktop builds
        const useElectron = config.options.framework === 'electron';
        
        if (useElectron) {
            return this.buildElectron(config);
        } else {
            return this.buildTauri(config);
        }
    }
    
    async buildTauri(config) {
        // Generate Tauri application
        const tauriConfig = {
            package: {
                productName: config.options.title || 'My Game',
                version: config.options.version || '1.0.0'
            },
            tauri: {
                bundle: {
                    active: true,
                    targets: ['msi', 'deb', 'dmg'],
                    identifier: config.options.bundleId || 'com.dreammaker.game'
                }
            }
        };
        
        return {
            platform: 'desktop',
            framework: 'tauri',
            config: tauriConfig,
            size: 0, // Would be calculated
            deploymentReady: true
        };
    }
    
    async buildElectron(config) {
        // Generate Electron application
        return {
            platform: 'desktop',
            framework: 'electron',
            size: 0,
            deploymentReady: true
        };
    }
}

class MobileBuilder {
    async build(config) {
        console.log('Building for mobile platform...');
        
        // Use Capacitor for mobile builds
        const capacitorConfig = {
            appId: config.options.bundleId || 'com.dreammaker.game',
            appName: config.options.title || 'My Game',
            webDir: 'dist',
            plugins: {
                SplashScreen: {
                    launchShowDuration: 3000
                }
            }
        };
        
        return {
            platform: 'mobile',
            framework: 'capacitor',
            config: capacitorConfig,
            size: 0,
            deploymentReady: true
        };
    }
}

// Platform deployment handlers
class ItchPlatform {
    async deploy(buildResult, credentials) {
        console.log('Deploying to itch.io...');
        
        // Use Butler API for itch.io deployment
        const deployment = {
            platform: 'itch',
            url: `https://${credentials.username}.itch.io/${credentials.gameSlug}`,
            status: 'uploading'
        };
        
        // Simulate deployment process
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve({
                    ...deployment,
                    status: 'deployed',
                    deployedAt: new Date()
                });
            }, 5000);
        });
    }
}

class SteamPlatform {
    async deploy(buildResult, credentials) {
        console.log('Deploying to Steam...');
        
        // Steam deployment would use Steamworks SDK
        return {
            platform: 'steam',
            status: 'pending-review',
            appId: credentials.appId
        };
    }
}

// Community UI Components
class CommunityUI {
    constructor(communitySystem) {
        this.community = communitySystem;
        this.isVisible = false;
        
        this.createUI();
        this.setupEventHandlers();
    }
    
    createUI() {
        const panel = document.createElement('div');
        panel.className = 'community-panel';
        panel.innerHTML = `
            <div class="community-header">
                <span class="community-title">🌟 Community</span>
                <button class="community-toggle" id="communityToggle">📱</button>
            </div>
            
            <div class="community-content" id="communityContent">
                <div class="community-tabs">
                    <div class="tab active" data-tab="discover">Discover</div>
                    <div class="tab" data-tab="library">Library</div>
                    <div class="tab" data-tab="profile">Profile</div>
                </div>
                
                <div class="tab-content" id="tabContent">
                    <!-- Content will be populated based on active tab -->
                </div>
                
                <div class="community-actions">
                    <button class="action-btn primary" onclick="publishCurrentGame()">
                        🚀 Publish Game
                    </button>
                    <button class="action-btn" onclick="openMarketplace()">
                        🏪 Marketplace
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.addStyles();
        this.showDiscoverTab();
    }
    
    setupEventHandlers() {
        document.getElementById('communityToggle').addEventListener('click', () => {
            this.toggle();
        });
        
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('tab')) {
                this.switchTab(e.target.dataset.tab);
            }
        });
        
        // Listen for community events
        this.community.engine.on('community:gamePublished', (data) => {
            this.showNotification('Game published successfully!', 'success');
        });
    }
    
    toggle() {
        this.isVisible = !this.isVisible;
        const content = document.getElementById('communityContent');
        content.style.display = this.isVisible ? 'block' : 'none';
    }
    
    switchTab(tabName) {
        // Update tab states
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
        
        // Switch content
        switch (tabName) {
            case 'discover':
                this.showDiscoverTab();
                break;
            case 'library':
                this.showLibraryTab();
                break;
            case 'profile':
                this.showProfileTab();
                break;
        }
    }
    
    async showDiscoverTab() {
        const content = document.getElementById('tabContent');
        content.innerHTML = `
            <div class="discover-content">
                <div class="search-bar">
                    <input type="text" placeholder="Search games..." id="gameSearch" />
                    <button onclick="searchGames()">🔍</button>
                </div>
                
                <div class="game-sections">
                    <div class="section">
                        <h3>Featured Games</h3>
                        <div class="game-grid" id="featuredGames">
                            <div class="loading">Loading...</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>Trending</h3>
                        <div class="game-grid" id="trendingGames">
                            <div class="loading">Loading...</div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <h3>New Releases</h3>
                        <div class="game-grid" id="newGames">
                            <div class="loading">Loading...</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Load featured and trending games
        this.loadFeaturedGames();
        this.loadTrendingGames();
    }
    
    async loadFeaturedGames() {
        try {
            const games = await this.community.getFeaturedGames();
            const container = document.getElementById('featuredGames');
            container.innerHTML = games.map(game => this.createGameCard(game)).join('');
        } catch (error) {
            console.error('Failed to load featured games:', error);
        }
    }
    
    async loadTrendingGames() {
        try {
            const games = await this.community.getTrendingGames();
            const container = document.getElementById('trendingGames');
            container.innerHTML = games.map(game => this.createGameCard(game)).join('');
        } catch (error) {
            console.error('Failed to load trending games:', error);
        }
    }
    
    createGameCard(game) {
        return `
            <div class="game-card" onclick="openGame('${game.id}')">
                <div class="game-thumbnail">
                    <img src="${game.thumbnail || '/default-game.png'}" alt="${game.title}" />
                </div>
                <div class="game-info">
                    <h4 class="game-title">${game.title}</h4>
                    <p class="game-author">by ${game.author}</p>
                    <div class="game-stats">
                        <span>❤️ ${game.likes || 0}</span>
                        <span>🎮 ${game.plays || 0}</span>
                        <span>⭐ ${game.rating || 0}</span>
                    </div>
                </div>
            </div>
        `;
    }
    
    showLibraryTab() {
        const content = document.getElementById('tabContent');
        content.innerHTML = `
            <div class="library-content">
                <div class="library-header">
                    <h3>My Games</h3>
                    <button class="btn" onclick="createNewProject()">+ New Game</button>
                </div>
                
                <div class="game-list">
                    <div class="game-item">
                        <div class="game-icon">🎮</div>
                        <div class="game-details">
                            <h4>My Awesome Platformer</h4>
                            <p>Last edited: 2 hours ago</p>
                            <div class="game-actions">
                                <button class="btn-small">Edit</button>
                                <button class="btn-small">Publish</button>
                                <button class="btn-small">Share</button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="game-item">
                        <div class="game-icon">🏎️</div>
                        <div class="game-details">
                            <h4>Speed Racer Pro</h4>
                            <p>Published • 124 plays</p>
                            <div class="game-actions">
                                <button class="btn-small">Edit</button>
                                <button class="btn-small">Analytics</button>
                                <button class="btn-small">Update</button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }
    
    showProfileTab() {
        const content = document.getElementById('tabContent');
        const user = this.community.user;
        
        if (!user) {
            content.innerHTML = `
                <div class="auth-section">
                    <h3>Join the Community</h3>
                    <p>Sign in to publish games, follow creators, and join the community!</p>
                    
                    <div class="auth-forms">
                        <div class="login-form">
                            <h4>Sign In</h4>
                            <input type="email" placeholder="Email" id="loginEmail" />
                            <input type="password" placeholder="Password" id="loginPassword" />
                            <button class="btn primary" onclick="loginUser()">Sign In</button>
                        </div>
                        
                        <div class="register-form">
                            <h4>Create Account</h4>
                            <input type="text" placeholder="Username" id="regUsername" />
                            <input type="email" placeholder="Email" id="regEmail" />
                            <input type="password" placeholder="Password" id="regPassword" />
                            <button class="btn" onclick="registerUser()">Create Account</button>
                        </div>
                    </div>
                </div>
            `;
        } else {
            content.innerHTML = `
                <div class="profile-content">
                    <div class="profile-header">
                        <div class="profile-avatar">
                            <img src="${user.avatar || '/default-avatar.png'}" alt="${user.username}" />
                        </div>
                        <div class="profile-info">
                            <h3>${user.username}</h3>
                            <p>${user.bio || 'Game developer on DreamMaker'}</p>
                            <div class="profile-stats">
                                <span>🎮 ${user.gamesPublished || 0} games</span>
                                <span>👥 ${user.followers || 0} followers</span>
                                <span>⭐ ${user.totalLikes || 0} likes</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="profile-actions">
                        <button class="btn" onclick="editProfile()">Edit Profile</button>
                        <button class="btn" onclick="viewAnalytics()">Analytics</button>
                        <button class="btn" onclick="logoutUser()">Sign Out</button>
                    </div>
                </div>
            `;
        }
    }
    
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.remove();
            }, 300);
        }, 3000);
    }
    
    addStyles() {
        const styles = `
            .community-panel {
                position: fixed;
                left: 20px;
                top: 100px;
                width: 400px;
                background: rgba(13, 17, 23, 0.95);
                border: 1px solid rgba(75, 0, 130, 0.3);
                border-radius: 12px;
                color: #e8e3d8;
                font-family: 'Inter', sans-serif;
                z-index: 1002;
                backdrop-filter: blur(20px);
            }
            
            .community-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px 20px;
                border-bottom: 1px solid rgba(75, 0, 130, 0.2);
            }
            
            .community-title {
                font-weight: 600;
                font-size: 16px;
            }
            
            .community-toggle {
                background: rgba(75, 0, 130, 0.6);
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                cursor: pointer;
            }
            
            .community-content {
                display: none;
                max-height: 600px;
                overflow-y: auto;
            }
            
            .community-tabs {
                display: flex;
                background: rgba(22, 33, 62, 0.5);
                border-bottom: 1px solid rgba(75, 0, 130, 0.2);
            }
            
            .tab {
                flex: 1;
                padding: 12px 16px;
                text-align: center;
                font-size: 14px;
                cursor: pointer;
                transition: all 0.3s ease;
                border-right: 1px solid rgba(75, 0, 130, 0.2);
            }
            
            .tab:last-child {
                border-right: none;
            }
            
            .tab.active {
                background: rgba(75, 0, 130, 0.3);
                color: #fff;
            }
            
            .tab-content {
                padding: 20px;
            }
            
            .search-bar {
                display: flex;
                gap: 8px;
                margin-bottom: 20px;
            }
            
            .search-bar input {
                flex: 1;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(75, 0, 130, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
            }
            
            .search-bar button {
                background: rgba(75, 0, 130, 0.6);
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                cursor: pointer;
            }
            
            .game-sections .section {
                margin-bottom: 24px;
            }
            
            .game-sections h3 {
                margin-bottom: 12px;
                font-size: 16px;
                color: rgba(232, 227, 216, 0.9);
            }
            
            .game-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
                gap: 12px;
            }
            
            .game-card {
                background: rgba(0, 0, 0, 0.3);
                border-radius: 8px;
                overflow: hidden;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .game-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(75, 0, 130, 0.3);
            }
            
            .game-thumbnail {
                width: 100%;
                height: 100px;
                background: rgba(75, 0, 130, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            
            .game-thumbnail img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }
            
            .game-info {
                padding: 12px;
            }
            
            .game-title {
                font-size: 14px;
                font-weight: 600;
                margin-bottom: 4px;
            }
            
            .game-author {
                font-size: 12px;
                color: rgba(232, 227, 216, 0.7);
                margin-bottom: 8px;
            }
            
            .game-stats {
                display: flex;
                gap: 12px;
                font-size: 11px;
                color: rgba(232, 227, 216, 0.6);
            }
            
            .community-actions {
                padding: 16px 20px;
                border-top: 1px solid rgba(75, 0, 130, 0.2);
                display: flex;
                gap: 12px;
            }
            
            .action-btn {
                flex: 1;
                background: rgba(75, 0, 130, 0.6);
                border: 1px solid rgba(75, 0, 130, 0.4);
                border-radius: 6px;
                padding: 10px 16px;
                color: #e8e3d8;
                font-size: 13px;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .action-btn.primary {
                background: linear-gradient(135deg, rgba(75, 0, 130, 0.8) 0%, rgba(139, 69, 19, 0.6) 100%);
            }
            
            .action-btn:hover {
                transform: translateY(-1px);
                box-shadow: 0 4px 12px rgba(75, 0, 130, 0.3);
            }
            
            .notification {
                position: fixed;
                top: 20px;
                right: 20px;
                background: rgba(13, 17, 23, 0.95);
                border: 1px solid rgba(75, 0, 130, 0.3);
                border-radius: 8px;
                padding: 16px 20px;
                color: #e8e3d8;
                font-size: 14px;
                z-index: 10000;
                transform: translateX(100%);
                transition: transform 0.3s ease;
            }
            
            .notification.show {
                transform: translateX(0);
            }
            
            .notification.success {
                border-color: rgba(34, 197, 94, 0.5);
                background: rgba(34, 197, 94, 0.1);
            }
            
            .loading {
                text-align: center;
                color: rgba(232, 227, 216, 0.6);
                padding: 20px;
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// Global functions for community interactions
async function publishCurrentGame() {
    if (!window.app || !window.app.currentProject) {
        alert('No project loaded to publish');
        return;
    }
    
    const gameData = window.app.engine.serialize();
    const metadata = {
        title: window.app.currentProject.name,
        description: window.app.currentProject.description,
        category: 'indie',
        tags: ['dreammaker', 'indie-game'],
        screenshots: [],
        isPublic: true
    };
    
    try {
        const result = await window.app.community.publishGame(gameData, metadata);
        console.log('Game published:', result);
    } catch (error) {
        console.error('Failed to publish game:', error);
        alert('Failed to publish game: ' + error.message);
    }
}

async function searchGames() {
    const query = document.getElementById('gameSearch').value;
    if (!query) return;
    
    try {
        const games = await window.app.community.searchGames(query);
        console.log('Search results:', games);
        // Update UI with results
    } catch (error) {
        console.error('Search failed:', error);
    }
}

function openGame(gameId) {
    console.log('Opening game:', gameId);
    // Implement game loading/playing
}

async function loginUser() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        alert('Please enter email and password');
        return;
    }
    
    try {
        const success = await window.app.community.login(email, password);
        if (success) {
            console.log('User logged in successfully');
            // Refresh UI
        }
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function registerUser() {
    const username = document.getElementById('regUsername').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    
    if (!username || !email || !password) {
        alert('Please fill in all fields');
        return;
    }
    
    try {
        const success = await window.app.community.register({
            username, email, password
        });
        if (success) {
            console.log('User registered successfully');
            // Refresh UI
        }
    } catch (error) {
        alert('Registration failed: ' + error.message);
    }
}

function logoutUser() {
    window.app.community.logout();
    console.log('User logged out');
    // Refresh UI
}

// Export for global access
window.CommunitySystem = CommunitySystem;
window.ExportSystem = ExportSystem;