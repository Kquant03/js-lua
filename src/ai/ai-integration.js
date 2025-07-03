// AI Integration System
// Provides AI-assisted game development, code generation, and asset creation

class AIIntegrationSystem {
    constructor(engine) {
        this.engine = engine;
        this.apiKeys = new Map();
        this.models = new Map();
        this.cache = new Map();
        this.requestQueue = [];
        this.isProcessing = false;
        
        // AI Services
        this.codeAssistant = new CodeAssistant(this);
        this.assetGenerator = new AssetGenerator(this);
        this.gameBalancer = new GameBalancer(this);
        this.tutorialGenerator = new TutorialGenerator(this);
        this.playtester = new AIPlaytester(this);
        
        // Context tracking
        this.sessionContext = {
            projectType: 'game',
            currentScene: null,
            recentActions: [],
            userPreferences: {},
            codeStyle: 'beginner'
        };
        
        this.initializeAI();
    }
    
    initializeAI() {
        this.setupAPIConnections();
        this.loadUserPreferences();
        this.startContextTracking();
    }
    
    setupAPIConnections() {
        // Register available AI services
        this.registerService('openai', {
            name: 'OpenAI GPT',
            endpoint: 'https://api.openai.com/v1/chat/completions',
            models: ['gpt-4', 'gpt-3.5-turbo'],
            features: ['code', 'text', 'analysis']
        });
        
        this.registerService('anthropic', {
            name: 'Claude',
            endpoint: 'https://api.anthropic.com/v1/messages',
            models: ['claude-3-sonnet', 'claude-3-haiku'],
            features: ['code', 'text', 'analysis', 'reasoning']
        });
        
        this.registerService('stability', {
            name: 'Stable Diffusion',
            endpoint: 'https://api.stability.ai/v1/generation',
            models: ['stable-diffusion-xl'],
            features: ['image-generation']
        });
        
        this.registerService('elevenlabs', {
            name: 'ElevenLabs',
            endpoint: 'https://api.elevenlabs.io/v1',
            models: ['eleven-monolingual-v1'],
            features: ['audio-generation', 'voice-synthesis']
        });
    }
    
    registerService(name, config) {
        this.models.set(name, config);
    }
    
    setAPIKey(service, key) {
        this.apiKeys.set(service, key);
        localStorage.setItem(`ai_key_${service}`, key);
    }
    
    loadUserPreferences() {
        // Load saved preferences
        const saved = localStorage.getItem('ai_preferences');
        if (saved) {
            this.sessionContext.userPreferences = JSON.parse(saved);
        }
    }
    
    startContextTracking() {
        // Track user actions for better AI assistance
        this.engine.on('componentAdded', (data) => {
            this.addToContext('component_added', data);
        });
        
        this.engine.on('entityCreated', (data) => {
            this.addToContext('entity_created', data);
        });
        
        this.engine.on('sceneChanged', (data) => {
            this.sessionContext.currentScene = data.scene.name;
        });
    }
    
    addToContext(action, data) {
        this.sessionContext.recentActions.push({
            action,
            data,
            timestamp: Date.now()
        });
        
        // Keep only recent actions (last 50)
        if (this.sessionContext.recentActions.length > 50) {
            this.sessionContext.recentActions.shift();
        }
    }
    
    // Main AI request interface
    async request(service, prompt, options = {}) {
        const requestId = this.generateRequestId();
        
        // Check cache first
        const cacheKey = this.getCacheKey(service, prompt, options);
        if (this.cache.has(cacheKey) && !options.skipCache) {
            return this.cache.get(cacheKey);
        }
        
        // Add to queue
        const request = {
            id: requestId,
            service,
            prompt,
            options,
            timestamp: Date.now(),
            resolve: null,
            reject: null
        };
        
        const promise = new Promise((resolve, reject) => {
            request.resolve = resolve;
            request.reject = reject;
        });
        
        this.requestQueue.push(request);
        this.processQueue();
        
        return promise;
    }
    
    async processQueue() {
        if (this.isProcessing || this.requestQueue.length === 0) return;
        
        this.isProcessing = true;
        
        while (this.requestQueue.length > 0) {
            const request = this.requestQueue.shift();
            
            try {
                const result = await this.executeRequest(request);
                
                // Cache result
                const cacheKey = this.getCacheKey(request.service, request.prompt, request.options);
                this.cache.set(cacheKey, result);
                
                request.resolve(result);
                
            } catch (error) {
                console.error(`AI request failed:`, error);
                request.reject(error);
            }
            
            // Rate limiting
            await this.delay(1000);
        }
        
        this.isProcessing = false;
    }
    
    async executeRequest(request) {
        const { service, prompt, options } = request;
        const serviceConfig = this.models.get(service);
        
        if (!serviceConfig) {
            throw new Error(`Unknown AI service: ${service}`);
        }
        
        const apiKey = this.apiKeys.get(service);
        if (!apiKey) {
            throw new Error(`No API key configured for ${service}`);
        }
        
        // Build context-aware prompt
        const contextualPrompt = this.buildContextualPrompt(prompt, options);
        
        switch (service) {
            case 'openai':
                return this.requestOpenAI(contextualPrompt, options, apiKey);
            case 'anthropic':
                return this.requestAnthropic(contextualPrompt, options, apiKey);
            case 'stability':
                return this.requestStability(contextualPrompt, options, apiKey);
            case 'elevenlabs':
                return this.requestElevenLabs(contextualPrompt, options, apiKey);
            default:
                throw new Error(`Service not implemented: ${service}`);
        }
    }
    
    buildContextualPrompt(prompt, options) {
        if (options.noContext) return prompt;
        
        let context = `You are an AI assistant helping with game development in a web-based game engine similar to Unity but running in browsers.

Current Context:
- Project Type: ${this.sessionContext.projectType}
- Current Scene: ${this.sessionContext.currentScene || 'None'}
- User Skill Level: ${this.sessionContext.codeStyle}

Recent Actions:
${this.sessionContext.recentActions.slice(-5).map(action => 
    `- ${action.action}: ${JSON.stringify(action.data).substring(0, 100)}`
).join('\n')}

User Request: ${prompt}

Please provide helpful, context-aware assistance.`;

        if (options.codeGeneration) {
            context += `

Code Guidelines:
- Use modern JavaScript/Lua syntax
- Include helpful comments
- Follow the engine's component-based architecture
- Ensure code is beginner-friendly if user skill level is 'beginner'
- Use the engine's built-in systems (Transform, Physics, Sprite, etc.)`;
        }
        
        return context;
    }
    
    async requestOpenAI(prompt, options, apiKey) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: options.model || 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a helpful AI assistant specialized in game development.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: options.maxTokens || 1000,
                temperature: options.temperature || 0.7
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'OpenAI request failed');
        }
        
        return {
            text: data.choices[0].message.content,
            usage: data.usage,
            model: data.model
        };
    }
    
    async requestAnthropic(prompt, options, apiKey) {
        const response = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: options.model || 'claude-3-sonnet-20240229',
                max_tokens: options.maxTokens || 1000,
                messages: [
                    {
                        role: 'user',
                        content: prompt
                    }
                ]
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error?.message || 'Anthropic request failed');
        }
        
        return {
            text: data.content[0].text,
            usage: data.usage,
            model: data.model
        };
    }
    
    async requestStability(prompt, options, apiKey) {
        const response = await fetch('https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                text_prompts: [
                    {
                        text: prompt,
                        weight: 1
                    }
                ],
                cfg_scale: options.cfgScale || 7,
                height: options.height || 512,
                width: options.width || 512,
                steps: options.steps || 30,
                samples: options.samples || 1
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Stability AI request failed');
        }
        
        return {
            images: data.artifacts.map(artifact => ({
                base64: artifact.base64,
                seed: artifact.seed
            }))
        };
    }
    
    // High-level AI assistance methods
    async generateCode(description, type = 'component') {
        const prompt = `Generate ${type} code for: ${description}`;
        
        const response = await this.request('openai', prompt, {
            codeGeneration: true,
            maxTokens: 1500
        });
        
        return this.codeAssistant.processCodeResponse(response.text, type);
    }
    
    async generateAsset(description, assetType = 'sprite') {
        switch (assetType) {
            case 'sprite':
            case 'background':
            case 'ui':
                return this.assetGenerator.generateImage(description, assetType);
            case 'sound':
            case 'music':
                return this.assetGenerator.generateAudio(description, assetType);
            case 'dialogue':
                return this.assetGenerator.generateText(description, assetType);
            default:
                throw new Error(`Unsupported asset type: ${assetType}`);
        }
    }
    
    async optimizeGame() {
        const gameData = this.engine.serialize();
        return this.gameBalancer.analyze(gameData);
    }
    
    async generateTutorial(topic) {
        return this.tutorialGenerator.create(topic);
    }
    
    async runPlaytest() {
        return this.playtester.run();
    }
    
    // Utility methods
    generateRequestId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    getCacheKey(service, prompt, options) {
        return `${service}:${this.hashString(prompt)}:${this.hashString(JSON.stringify(options))}`;
    }
    
    hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32bit integer
        }
        return hash.toString(36);
    }
    
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

// AI Assistant Modules
class CodeAssistant {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
        this.codeTemplates = new Map();
        this.setupTemplates();
    }
    
    setupTemplates() {
        this.codeTemplates.set('component', `
// {name} Component
class {name}Component {
    constructor() {
        {properties}
    }
    
    update(deltaTime) {
        {updateLogic}
    }
}
        `);
        
        this.codeTemplates.set('system', `
// {name} System
class {name}System {
    constructor(engine) {
        this.engine = engine;
        this.active = true;
    }
    
    update(deltaTime) {
        const entities = this.engine.query({components});
        
        for (const entity of entities) {
            {systemLogic}
        }
    }
}
        `);
    }
    
    async generateComponent(description) {
        const prompt = `Create a game component for: ${description}
        
Please provide:
1. Component name
2. Properties it should have
3. Update logic if needed
4. Any special methods

Format as JavaScript class.`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            codeGeneration: true
        });
        
        return this.processCodeResponse(response.text, 'component');
    }
    
    async generateSystem(description) {
        const prompt = `Create a game system for: ${description}
        
The system should:
1. Query entities with specific components
2. Process them in the update loop
3. Follow ECS architecture patterns

Format as JavaScript class.`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            codeGeneration: true
        });
        
        return this.processCodeResponse(response.text, 'system');
    }
    
    async generateScript(description) {
        const prompt = `Create a game script for: ${description}
        
The script should:
1. Work with the entity component system
2. Handle game logic
3. Be beginner-friendly with comments

Provide working JavaScript code.`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            codeGeneration: true
        });
        
        return this.processCodeResponse(response.text, 'script');
    }
    
    processCodeResponse(response, type) {
        // Extract code from response
        const codeMatch = response.match(/```(?:javascript|js)?\n([\s\S]*?)\n```/);
        let code = codeMatch ? codeMatch[1] : response;
        
        // Clean up code
        code = code.trim();
        
        // Validate syntax
        try {
            new Function(code);
        } catch (error) {
            console.warn('Generated code has syntax errors:', error);
        }
        
        return {
            code,
            type,
            explanation: this.extractExplanation(response),
            suggestions: this.extractSuggestions(response)
        };
    }
    
    extractExplanation(response) {
        // Extract explanation text (everything before code block)
        const codeMatch = response.match(/```/);
        return codeMatch ? response.substring(0, codeMatch.index).trim() : '';
    }
    
    extractSuggestions(response) {
        // Extract suggestions or tips from the response
        const suggestions = [];
        const lines = response.split('\n');
        
        for (const line of lines) {
            if (line.includes('tip:') || line.includes('suggestion:') || line.includes('note:')) {
                suggestions.push(line.trim());
            }
        }
        
        return suggestions;
    }
}

class AssetGenerator {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
    }
    
    async generateImage(description, type = 'sprite') {
        let prompt = this.buildImagePrompt(description, type);
        
        const response = await this.aiSystem.request('stability', prompt, {
            width: type === 'background' ? 1024 : 512,
            height: type === 'background' ? 512 : 512,
            steps: 30
        });
        
        // Convert base64 to usable image
        const images = response.images.map(img => this.base64ToImage(img.base64));
        
        return {
            type: 'image',
            assetType: type,
            images,
            prompt,
            description
        };
    }
    
    buildImagePrompt(description, type) {
        const styleMap = {
            'sprite': 'pixel art, 32x32, transparent background, game sprite',
            'background': 'game background, detailed, colorful, landscape',
            'ui': 'game UI element, clean, modern interface design',
            'character': 'game character, full body, pixel art style',
            'item': 'game item, icon style, clean design'
        };
        
        const style = styleMap[type] || styleMap.sprite;
        
        return `${description}, ${style}, high quality, game asset`;
    }
    
    base64ToImage(base64Data) {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.src = `data:image/png;base64,${base64Data}`;
        });
    }
    
    async generateAudio(description, type = 'sound') {
        // For now, return a placeholder - would integrate with audio generation APIs
        return {
            type: 'audio',
            assetType: type,
            description,
            placeholder: true,
            suggestion: 'Audio generation coming soon! For now, try freesound.org for free audio assets.'
        };
    }
    
    async generateText(description, type = 'dialogue') {
        const prompt = `Generate ${type} text for a game: ${description}
        
Requirements:
- Engaging and appropriate for games
- Multiple options if applicable
- Consider pacing and player engagement`;
        
        const response = await this.aiSystem.request('openai', prompt);
        
        return {
            type: 'text',
            assetType: type,
            content: response.text,
            description
        };
    }
}

class GameBalancer {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
    }
    
    async analyze(gameData) {
        const prompt = `Analyze this game data for balance and optimization:
        
Game Structure:
- Entities: ${gameData.entities?.length || 0}
- Current Scene: ${gameData.scene || 'Unknown'}

Please provide:
1. Performance optimization suggestions
2. Game balance recommendations
3. Potential issues to address
4. Player experience improvements

Game Data: ${JSON.stringify(gameData, null, 2).substring(0, 1000)}...`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            maxTokens: 1500
        });
        
        return this.parseAnalysis(response.text);
    }
    
    parseAnalysis(analysis) {
        return {
            performance: this.extractSection(analysis, 'performance'),
            balance: this.extractSection(analysis, 'balance'),
            issues: this.extractSection(analysis, 'issues'),
            improvements: this.extractSection(analysis, 'improvements'),
            fullAnalysis: analysis
        };
    }
    
    extractSection(text, section) {
        const regex = new RegExp(`${section}[^:]*:([^\\n]*)`, 'i');
        const match = text.match(regex);
        return match ? match[1].trim() : '';
    }
}

class TutorialGenerator {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
    }
    
    async create(topic) {
        const prompt = `Create a step-by-step tutorial for: ${topic}
        
The tutorial should:
1. Be beginner-friendly
2. Include practical examples
3. Have clear, actionable steps
4. Explain concepts simply
5. Include tips for troubleshooting

Format as a structured tutorial with sections.`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            maxTokens: 2000
        });
        
        return this.parseTutorial(response.text, topic);
    }
    
    parseTutorial(content, topic) {
        const sections = content.split(/#{1,3}\s+/).filter(s => s.trim());
        
        return {
            topic,
            sections: sections.map((section, index) => ({
                id: index,
                title: this.extractTitle(section),
                content: this.extractContent(section),
                steps: this.extractSteps(section)
            })),
            fullContent: content
        };
    }
    
    extractTitle(section) {
        const lines = section.split('\n');
        return lines[0]?.trim() || 'Untitled';
    }
    
    extractContent(section) {
        const lines = section.split('\n');
        return lines.slice(1).join('\n').trim();
    }
    
    extractSteps(section) {
        const steps = [];
        const lines = section.split('\n');
        
        for (const line of lines) {
            if (/^\d+\./.test(line.trim())) {
                steps.push(line.trim());
            }
        }
        
        return steps;
    }
}

class AIPlaytester {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
    }
    
    async run() {
        // Simulate AI playing the game and providing feedback
        const gameState = this.captureGameState();
        
        const prompt = `Act as an AI playtester for this game state:
        
${JSON.stringify(gameState, null, 2)}

Provide feedback on:
1. Player experience
2. Difficulty curve
3. Potential bugs or issues
4. Engagement factors
5. Suggestions for improvement

Be specific and actionable.`;
        
        const response = await this.aiSystem.request('openai', prompt, {
            maxTokens: 1500
        });
        
        return {
            feedback: response.text,
            timestamp: Date.now(),
            gameState,
            recommendations: this.extractRecommendations(response.text)
        };
    }
    
    captureGameState() {
        // Capture current game state for analysis
        return {
            entities: this.aiSystem.engine.entities.size,
            currentScene: this.aiSystem.sessionContext.currentScene,
            recentActions: this.aiSystem.sessionContext.recentActions.slice(-10),
            timestamp: Date.now()
        };
    }
    
    extractRecommendations(feedback) {
        const recommendations = [];
        const lines = feedback.split('\n');
        
        for (const line of lines) {
            if (line.includes('recommend') || line.includes('suggest') || line.includes('should')) {
                recommendations.push(line.trim());
            }
        }
        
        return recommendations;
    }
}

// AI UI Components
class AIAssistantUI {
    constructor(aiSystem) {
        this.aiSystem = aiSystem;
        this.chatHistory = [];
        this.isOpen = false;
        
        this.createUI();
        this.setupEventHandlers();
    }
    
    createUI() {
        const panel = document.createElement('div');
        panel.className = 'ai-assistant-panel';
        panel.innerHTML = `
            <div class="ai-header">
                <span class="ai-title">🤖 AI Assistant</span>
                <button class="ai-toggle" id="aiToggle">💬</button>
            </div>
            
            <div class="ai-content" id="aiContent">
                <div class="ai-chat" id="aiChat">
                    <div class="ai-welcome">
                        Hello! I'm your AI assistant. I can help you with:
                        <ul>
                            <li>🔧 Code generation and debugging</li>
                            <li>🎨 Asset creation and optimization</li>
                            <li>⚖️ Game balance analysis</li>
                            <li>📚 Tutorials and learning</li>
                            <li>🎮 Playtesting feedback</li>
                        </ul>
                        What would you like to work on?
                    </div>
                </div>
                
                <div class="ai-input-container">
                    <input type="text" id="aiInput" placeholder="Ask me anything about game development..." />
                    <button id="aiSend">Send</button>
                </div>
                
                <div class="ai-quick-actions">
                    <button class="quick-action" data-action="generate-code">Generate Code</button>
                    <button class="quick-action" data-action="create-asset">Create Asset</button>
                    <button class="quick-action" data-action="optimize-game">Optimize Game</button>
                    <button class="quick-action" data-action="tutorial">Tutorial</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(panel);
        this.addStyles();
    }
    
    setupEventHandlers() {
        document.getElementById('aiToggle').addEventListener('click', () => {
            this.toggle();
        });
        
        document.getElementById('aiSend').addEventListener('click', () => {
            this.sendMessage();
        });
        
        document.getElementById('aiInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
        
        document.querySelectorAll('.quick-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleQuickAction(e.target.dataset.action);
            });
        });
    }
    
    toggle() {
        this.isOpen = !this.isOpen;
        const content = document.getElementById('aiContent');
        content.style.display = this.isOpen ? 'block' : 'none';
    }
    
    async sendMessage() {
        const input = document.getElementById('aiInput');
        const message = input.value.trim();
        
        if (!message) return;
        
        this.addMessage('user', message);
        input.value = '';
        
        try {
            const response = await this.aiSystem.request('openai', message);
            this.addMessage('ai', response.text);
        } catch (error) {
            this.addMessage('ai', 'Sorry, I encountered an error. Please try again.');
            console.error('AI request failed:', error);
        }
    }
    
    addMessage(sender, content) {
        const chat = document.getElementById('aiChat');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${sender}`;
        
        messageDiv.innerHTML = `
            <div class="message-content">${content}</div>
            <div class="message-time">${new Date().toLocaleTimeString()}</div>
        `;
        
        chat.appendChild(messageDiv);
        chat.scrollTop = chat.scrollHeight;
        
        this.chatHistory.push({ sender, content, timestamp: Date.now() });
    }
    
    async handleQuickAction(action) {
        switch (action) {
            case 'generate-code':
                this.addMessage('ai', 'What kind of code would you like me to generate? (component, system, script, etc.)');
                break;
                
            case 'create-asset':
                this.addMessage('ai', 'What asset would you like me to create? Describe the sprite, background, or other asset you need.');
                break;
                
            case 'optimize-game':
                this.addMessage('ai', 'Analyzing your game for optimization opportunities...');
                try {
                    const analysis = await this.aiSystem.optimizeGame();
                    this.addMessage('ai', `Game Analysis Complete!\n\n${analysis.fullAnalysis}`);
                } catch (error) {
                    this.addMessage('ai', 'Unable to analyze game at the moment. Please try again.');
                }
                break;
                
            case 'tutorial':
                this.addMessage('ai', 'What topic would you like a tutorial on? (physics, animations, UI, etc.)');
                break;
        }
    }
    
    addStyles() {
        const styles = `
            .ai-assistant-panel {
                position: fixed;
                right: 340px;
                top: 100px;
                width: 400px;
                background: rgba(13, 17, 23, 0.95);
                border: 1px solid rgba(75, 0, 130, 0.3);
                border-radius: 12px;
                color: #e8e3d8;
                font-family: 'Source Code Pro', monospace;
                z-index: 1001;
                backdrop-filter: blur(20px);
            }
            
            .ai-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 16px;
                border-bottom: 1px solid rgba(75, 0, 130, 0.2);
            }
            
            .ai-title {
                font-weight: 600;
                color: #e8e3d8;
            }
            
            .ai-toggle {
                background: rgba(75, 0, 130, 0.6);
                border: none;
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                cursor: pointer;
                font-size: 14px;
            }
            
            .ai-content {
                display: none;
                padding: 16px;
            }
            
            .ai-chat {
                height: 300px;
                overflow-y: auto;
                margin-bottom: 16px;
                padding: 12px;
                background: rgba(0, 0, 0, 0.2);
                border-radius: 8px;
            }
            
            .ai-welcome {
                color: rgba(232, 227, 216, 0.8);
                font-size: 14px;
                line-height: 1.5;
            }
            
            .ai-welcome ul {
                margin: 12px 0;
                padding-left: 20px;
            }
            
            .ai-message {
                margin-bottom: 12px;
                padding: 8px 12px;
                border-radius: 8px;
                font-size: 13px;
                line-height: 1.4;
            }
            
            .ai-message.user {
                background: rgba(75, 0, 130, 0.2);
                margin-left: 20px;
            }
            
            .ai-message.ai {
                background: rgba(139, 69, 19, 0.2);
                margin-right: 20px;
            }
            
            .message-time {
                font-size: 11px;
                color: rgba(232, 227, 216, 0.5);
                margin-top: 4px;
            }
            
            .ai-input-container {
                display: flex;
                gap: 8px;
                margin-bottom: 12px;
            }
            
            .ai-input-container input {
                flex: 1;
                background: rgba(0, 0, 0, 0.3);
                border: 1px solid rgba(75, 0, 130, 0.3);
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                font-size: 13px;
            }
            
            .ai-input-container button {
                background: rgba(75, 0, 130, 0.6);
                border: none;
                border-radius: 6px;
                padding: 8px 16px;
                color: #e8e3d8;
                cursor: pointer;
                font-size: 13px;
            }
            
            .ai-quick-actions {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 8px;
            }
            
            .quick-action {
                background: rgba(139, 69, 19, 0.3);
                border: 1px solid rgba(139, 69, 19, 0.4);
                border-radius: 6px;
                padding: 8px 12px;
                color: #e8e3d8;
                cursor: pointer;
                font-size: 12px;
                transition: all 0.3s ease;
            }
            
            .quick-action:hover {
                background: rgba(139, 69, 19, 0.5);
                transform: translateY(-1px);
            }
        `;
        
        const styleSheet = document.createElement('style');
        styleSheet.textContent = styles;
        document.head.appendChild(styleSheet);
    }
}

// Export for global access
window.AIIntegrationSystem = AIIntegrationSystem;
window.AIAssistantUI = AIAssistantUI;