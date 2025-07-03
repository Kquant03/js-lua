// server/api/games.js - Complete Games/Projects API
const express = require('express');
const { Game, User, Asset, Rating } = require('../database/models');
const mongoose = require('mongoose');

module.exports = (authenticateToken, optionalAuth) => {
    const router = express.Router();
    
    // Get all games (with optional authentication for personalized results)
    router.get('/', optionalAuth, async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                sort = 'createdAt',
                order = 'desc',
                genre,
                featured,
                search,
                owner,
                status = 'public'
            } = req.query;
            
            // Build query
            const query = {};
            
            // Filter by status
            if (req.user) {
                // Authenticated users can see their own private games
                if (status === 'mine') {
                    query.owner = req.user.userId;
                } else if (status === 'collaborated') {
                    query['collaborators.user'] = req.user.userId;
                } else {
                    query['publishing.status'] = { $in: ['public', 'published'] };
                }
            } else {
                // Public users only see public games
                query['publishing.status'] = { $in: ['public', 'published'] };
            }
            
            // Apply filters
            if (genre) {
                query['metadata.genre'] = genre;
            }
            
            if (featured === 'true') {
                query['publishing.featured'] = true;
            }
            
            if (owner) {
                query.owner = owner;
            }
            
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { 'metadata.tags': { $regex: search, $options: 'i' } }
                ];
            }
            
            // Build sort object
            const sortObj = {};
            sortObj[sort] = order === 'desc' ? -1 : 1;
            
            // Execute query with pagination
            const games = await Game.find(query)
                .populate('owner', 'username profile.displayName profile.avatar')
                .populate('collaborators.user', 'username profile.displayName profile.avatar')
                .select('-gameData') // Exclude heavy game data from list view
                .sort(sortObj)
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await Game.countDocuments(query);
            
            res.json({
                games,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / parseInt(limit)),
                    count: games.length,
                    totalGames: total
                }
            });
            
        } catch (error) {
            console.error('Games fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch games'
            });
        }
    });
    
    // Get single game by ID
    router.get('/:id', optionalAuth, async (req, res) => {
        try {
            const { id } = req.params;
            const { includeGameData = 'false' } = req.query;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            // Build projection based on request
            let projection = {};
            if (includeGameData === 'false') {
                projection.gameData = 0; // Exclude game data for performance
            }
            
            const game = await Game.findById(id, projection)
                .populate('owner', 'username profile.displayName profile.avatar')
                .populate('collaborators.user', 'username profile.displayName profile.avatar');
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Check access permissions
            const isOwner = req.user && game.owner._id.toString() === req.user.userId;
            const isCollaborator = req.user && game.collaborators.some(
                collab => collab.user._id.toString() === req.user.userId
            );
            const isPublic = ['public', 'published'].includes(game.publishing.status);
            
            if (!isPublic && !isOwner && !isCollaborator) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Increment view count if public access
            if (!isOwner && !isCollaborator) {
                await Game.findByIdAndUpdate(id, {
                    $inc: { 'publishing.views': 1 }
                });
            }
            
            // Add user permissions to response
            let userPermissions = null;
            if (req.user) {
                if (isOwner) {
                    userPermissions = {
                        canEdit: true,
                        canInvite: true,
                        canExport: true,
                        canDelete: true,
                        role: 'owner'
                    };
                } else if (isCollaborator) {
                    const collaboration = game.collaborators.find(
                        collab => collab.user._id.toString() === req.user.userId
                    );
                    userPermissions = {
                        ...collaboration.permissions,
                        role: collaboration.role
                    };
                }
            }
            
            res.json({
                game,
                userPermissions
            });
            
        } catch (error) {
            console.error('Game fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch game'
            });
        }
    });
    
    // Create new game
    router.post('/', authenticateToken, async (req, res) => {
        try {
            const { name, description, genre = 'other', template } = req.body;
            
            if (!name || name.trim().length === 0) {
                return res.status(400).json({
                    error: 'Game name is required'
                });
            }
            
            if (name.length > 100) {
                return res.status(400).json({
                    error: 'Game name must be 100 characters or less'
                });
            }
            
            // Check user's project limit based on subscription
            const user = await User.findById(req.user.userId);
            const projectCount = await Game.countDocuments({ owner: req.user.userId });
            
            const projectLimits = {
                free: 3,
                pro: 100,
                team: 500,
                enterprise: Infinity
            };
            
            const limit = projectLimits[user.subscription.plan] || projectLimits.free;
            
            if (projectCount >= limit) {
                return res.status(403).json({
                    error: `Project limit reached. ${user.subscription.plan} plan allows ${limit} projects.`,
                    upgradeRequired: user.subscription.plan === 'free'
                });
            }
            
            // Create default game data structure
            const defaultGameData = {
                settings: {
                    title: name,
                    genre,
                    targetPlatform: ['web'],
                    resolution: { width: 800, height: 600 },
                    fps: 60,
                    pixelPerfect: false
                },
                entities: new Map(),
                scenes: new Map([
                    ['main', {
                        id: 'main',
                        name: 'Main Scene',
                        entities: [],
                        cameras: [{
                            id: 'main-camera',
                            position: { x: 0, y: 0, z: 10 },
                            target: { x: 0, y: 0, z: 0 },
                            fov: 75,
                            near: 0.1,
                            far: 1000
                        }],
                        lighting: {
                            ambient: '#404040',
                            directional: [{
                                direction: { x: -1, y: -1, z: -1 },
                                color: '#ffffff',
                                intensity: 1
                            }]
                        },
                        physics: {
                            gravity: { x: 0, y: -9.81 },
                            enabled: true
                        }
                    }]
                ]),
                scripts: new Map(),
                assets: {
                    sprites: new Map(),
                    sounds: new Map(),
                    tilemaps: new Map()
                }
            };
            
            // Apply template if specified
            if (template) {
                // TODO: Load template data
                console.log(`Applying template: ${template}`);
            }
            
            const game = new Game({
                name: name.trim(),
                description: description?.trim() || '',
                owner: req.user.userId,
                gameData: defaultGameData,
                metadata: {
                    genre,
                    tags: [],
                    targetAudience: 'everyone',
                    difficulty: 'medium'
                },
                collaborators: [{
                    user: req.user.userId,
                    role: 'owner',
                    permissions: {
                        canEdit: true,
                        canInvite: true,
                        canExport: true,
                        canDelete: true
                    }
                }]
            });
            
            await game.save();
            
            // Update user's project count
            await User.findByIdAndUpdate(req.user.userId, {
                $inc: { 'usage.projectsCreated': 1 }
            });
            
            // Populate owner for response
            await game.populate('owner', 'username profile.displayName profile.avatar');
            
            res.status(201).json({
                message: 'Game created successfully',
                game
            });
            
        } catch (error) {
            console.error('Game creation error:', error);
            res.status(500).json({
                error: 'Failed to create game'
            });
        }
    });
    
    // Update game
    router.put('/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            const game = await Game.findById(id);
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Check permissions
            const isOwner = game.owner.toString() === req.user.userId;
            const collaborator = game.collaborators.find(
                collab => collab.user.toString() === req.user.userId
            );
            
            if (!isOwner && (!collaborator || !collaborator.permissions.canEdit)) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Define updatable fields based on user role
            const allowedUpdates = isOwner 
                ? ['name', 'description', 'gameData', 'metadata', 'publishing']
                : ['gameData']; // Collaborators can only update game data
            
            const updates = {};
            
            Object.keys(req.body).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    updates[key] = req.body[key];
                }
            });
            
            // Validate updates
            if (updates.name && updates.name.length > 100) {
                return res.status(400).json({
                    error: 'Game name must be 100 characters or less'
                });
            }
            
            if (updates.description && updates.description.length > 1000) {
                return res.status(400).json({
                    error: 'Description must be 1000 characters or less'
                });
            }
            
            // Create version snapshot if game data is being updated
            if (updates.gameData && game.gameData) {
                const version = {
                    version: `v${game.versions.length + 1}`,
                    changelog: req.body.changelog || 'Auto-saved changes',
                    gameData: game.gameData,
                    createdBy: req.user.userId
                };
                
                updates.$push = { versions: version };
            }
            
            const updatedGame = await Game.findByIdAndUpdate(
                id,
                { ...updates, updatedAt: new Date() },
                { new: true, runValidators: true }
            ).populate('owner', 'username profile.displayName profile.avatar')
             .populate('collaborators.user', 'username profile.displayName profile.avatar');
            
            res.json({
                message: 'Game updated successfully',
                game: updatedGame
            });
            
        } catch (error) {
            console.error('Game update error:', error);
            res.status(500).json({
                error: 'Failed to update game'
            });
        }
    });
    
    // Delete game
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            const game = await Game.findById(id);
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Only owner can delete
            if (game.owner.toString() !== req.user.userId) {
                return res.status(403).json({
                    error: 'Only the owner can delete this game'
                });
            }
            
            // Delete associated assets
            await Asset.deleteMany({ game: id });
            
            // Delete the game
            await Game.findByIdAndDelete(id);
            
            res.json({
                message: 'Game deleted successfully'
            });
            
        } catch (error) {
            console.error('Game deletion error:', error);
            res.status(500).json({
                error: 'Failed to delete game'
            });
        }
    });
    
    // Invite collaborator
    router.post('/:id/collaborators', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { username, role = 'editor' } = req.body;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            const game = await Game.findById(id);
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Check permissions
            const isOwner = game.owner.toString() === req.user.userId;
            const collaborator = game.collaborators.find(
                collab => collab.user.toString() === req.user.userId
            );
            
            if (!isOwner && (!collaborator || !collaborator.permissions.canInvite)) {
                return res.status(403).json({
                    error: 'You do not have permission to invite collaborators'
                });
            }
            
            // Find user to invite
            const userToInvite = await User.findOne({ username: username.toLowerCase() });
            
            if (!userToInvite) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Check if user is already a collaborator
            const existingCollaborator = game.collaborators.find(
                collab => collab.user.toString() === userToInvite._id.toString()
            );
            
            if (existingCollaborator) {
                return res.status(409).json({
                    error: 'User is already a collaborator'
                });
            }
            
            // Add collaborator
            const permissions = {
                canEdit: ['owner', 'editor'].includes(role),
                canInvite: role === 'owner',
                canExport: ['owner', 'editor'].includes(role),
                canDelete: role === 'owner'
            };
            
            game.collaborators.push({
                user: userToInvite._id,
                role,
                permissions
            });
            
            await game.save();
            
            // Populate the new collaborator data
            await game.populate('collaborators.user', 'username profile.displayName profile.avatar');
            
            res.json({
                message: 'Collaborator added successfully',
                collaborator: game.collaborators[game.collaborators.length - 1]
            });
            
        } catch (error) {
            console.error('Collaborator invitation error:', error);
            res.status(500).json({
                error: 'Failed to add collaborator'
            });
        }
    });
    
    // Remove collaborator
    router.delete('/:id/collaborators/:userId', authenticateToken, async (req, res) => {
        try {
            const { id, userId } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id) || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({
                    error: 'Invalid ID'
                });
            }
            
            const game = await Game.findById(id);
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Only owner can remove collaborators (or users can remove themselves)
            const isOwner = game.owner.toString() === req.user.userId;
            const isSelf = userId === req.user.userId;
            
            if (!isOwner && !isSelf) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Can't remove the owner
            if (userId === game.owner.toString()) {
                return res.status(400).json({
                    error: 'Cannot remove the owner'
                });
            }
            
            // Remove collaborator
            game.collaborators = game.collaborators.filter(
                collab => collab.user.toString() !== userId
            );
            
            await game.save();
            
            res.json({
                message: 'Collaborator removed successfully'
            });
            
        } catch (error) {
            console.error('Collaborator removal error:', error);
            res.status(500).json({
                error: 'Failed to remove collaborator'
            });
        }
    });
    
    // Rate game
    router.post('/:id/rating', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { rating, review } = req.body;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            if (!rating || rating < 1 || rating > 5) {
                return res.status(400).json({
                    error: 'Rating must be between 1 and 5'
                });
            }
            
            const game = await Game.findById(id);
            
            if (!game) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Can't rate your own game
            if (game.owner.toString() === req.user.userId) {
                return res.status(400).json({
                    error: 'Cannot rate your own game'
                });
            }
            
            // Create or update rating
            const existingRating = await Rating.findOne({
                game: id,
                user: req.user.userId
            });
            
            if (existingRating) {
                existingRating.rating = rating;
                existingRating.review = review || '';
                await existingRating.save();
            } else {
                await Rating.create({
                    game: id,
                    user: req.user.userId,
                    rating,
                    review: review || ''
                });
            }
            
            // Update game rating statistics
            const ratings = await Rating.find({ game: id });
            const average = ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length;
            
            await Game.findByIdAndUpdate(id, {
                'publishing.rating.average': Math.round(average * 10) / 10,
                'publishing.rating.count': ratings.length
            });
            
            res.json({
                message: 'Rating submitted successfully',
                rating: {
                    average: Math.round(average * 10) / 10,
                    count: ratings.length
                }
            });
            
        } catch (error) {
            console.error('Rating submission error:', error);
            res.status(500).json({
                error: 'Failed to submit rating'
            });
        }
    });
    
    // Get game ratings
    router.get('/:id/ratings', async (req, res) => {
        try {
            const { id } = req.params;
            const { page = 1, limit = 10 } = req.query;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            const ratings = await Rating.find({ game: id })
                .populate('user', 'username profile.displayName profile.avatar')
                .sort({ createdAt: -1 })
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await Rating.countDocuments({ game: id });
            
            res.json({
                ratings,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / parseInt(limit)),
                    count: ratings.length,
                    totalRatings: total
                }
            });
            
        } catch (error) {
            console.error('Ratings fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch ratings'
            });
        }
    });
    
    // Duplicate/Clone game
    router.post('/:id/clone', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { name } = req.body;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid game ID'
                });
            }
            
            const originalGame = await Game.findById(id);
            
            if (!originalGame) {
                return res.status(404).json({
                    error: 'Game not found'
                });
            }
            
            // Check if game is public or user has access
            const isOwner = originalGame.owner.toString() === req.user.userId;
            const isCollaborator = originalGame.collaborators.some(
                collab => collab.user.toString() === req.user.userId
            );
            const isPublic = ['public', 'published'].includes(originalGame.publishing.status);
            
            if (!isPublic && !isOwner && !isCollaborator) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Create cloned game
            const clonedGame = new Game({
                name: name || `${originalGame.name} (Copy)`,
                description: `Cloned from ${originalGame.name}`,
                owner: req.user.userId,
                gameData: originalGame.gameData,
                metadata: {
                    ...originalGame.metadata,
                    tags: [...originalGame.metadata.tags, 'clone']
                },
                collaborators: [{
                    user: req.user.userId,
                    role: 'owner',
                    permissions: {
                        canEdit: true,
                        canInvite: true,
                        canExport: true,
                        canDelete: true
                    }
                }]
            });
            
            await clonedGame.save();
            
            // Populate owner for response
            await clonedGame.populate('owner', 'username profile.displayName profile.avatar');
            
            res.status(201).json({
                message: 'Game cloned successfully',
                game: clonedGame
            });
            
        } catch (error) {
            console.error('Game cloning error:', error);
            res.status(500).json({
                error: 'Failed to clone game'
            });
        }
    });
    
    return router;
};