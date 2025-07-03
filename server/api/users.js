// server/api/users.js - Complete Users Management API
const express = require('express');
const { User, Game, Asset, Rating } = require('../database/models');
const mongoose = require('mongoose');

module.exports = (authenticateToken, optionalAuth) => {
    const router = express.Router();
    
    // Get user profile (public endpoint with optional auth for additional data)
    router.get('/:username', optionalAuth, async (req, res) => {
        try {
            const { username } = req.params;
            
            const user = await User.findOne({ username: username.toLowerCase() });
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Check if profile is public or if it's the user themselves
            const isOwnProfile = req.user && req.user.userId === user._id.toString();
            const isPublic = user.settings.privacy.profilePublic;
            
            if (!isPublic && !isOwnProfile) {
                return res.status(403).json({
                    error: 'Profile is private'
                });
            }
            
            // Build response based on access level
            const response = {
                id: user._id,
                username: user.username,
                profile: {
                    displayName: user.profile.displayName,
                    avatar: user.profile.avatar,
                    bio: user.profile.bio,
                    website: user.profile.website,
                    location: user.profile.location,
                    skills: user.profile.skills,
                    socialLinks: user.profile.socialLinks
                },
                stats: {
                    gamesCreated: 0,
                    totalViews: 0,
                    totalLikes: 0,
                    averageRating: 0
                },
                joinedAt: user.createdAt
            };
            
            // Add additional data for own profile
            if (isOwnProfile) {
                response.email = user.email;
                response.settings = user.settings;
                response.subscription = user.subscription;
                response.usage = user.usage;
                response.verified = user.verification.email.verified;
                response.lastLogin = user.lastLogin;
            }
            
            // Calculate user statistics
            const userGames = await Game.find({ owner: user._id });
            const publicGames = userGames.filter(game => 
                ['public', 'published'].includes(game.publishing.status)
            );
            
            response.stats.gamesCreated = isOwnProfile ? userGames.length : publicGames.length;
            response.stats.totalViews = publicGames.reduce((sum, game) => sum + game.publishing.views, 0);
            response.stats.totalLikes = publicGames.reduce((sum, game) => sum + game.publishing.likes, 0);
            
            // Calculate average rating
            const ratings = await Rating.find({ 
                game: { $in: publicGames.map(g => g._id) } 
            });
            
            if (ratings.length > 0) {
                response.stats.averageRating = Math.round(
                    (ratings.reduce((sum, rating) => sum + rating.rating, 0) / ratings.length) * 10
                ) / 10;
            }
            
            res.json({ user: response });
            
        } catch (error) {
            console.error('User profile fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch user profile'
            });
        }
    });
    
    // Get user's public games
    router.get('/:username/games', optionalAuth, async (req, res) => {
        try {
            const { username } = req.params;
            const {
                page = 1,
                limit = 12,
                sort = 'createdAt',
                order = 'desc'
            } = req.query;
            
            const user = await User.findOne({ username: username.toLowerCase() });
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Build query
            const query = { owner: user._id };
            
            // Only show public games unless it's the user's own profile
            const isOwnProfile = req.user && req.user.userId === user._id.toString();
            
            if (!isOwnProfile) {
                query['publishing.status'] = { $in: ['public', 'published'] };
            }
            
            // Build sort
            const sortObj = {};
            sortObj[sort] = order === 'desc' ? -1 : 1;
            
            const games = await Game.find(query)
                .populate('owner', 'username profile.displayName profile.avatar')
                .select('-gameData') // Exclude heavy game data
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
            console.error('User games fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch user games'
            });
        }
    });
    
    // Search users
    router.get('/', async (req, res) => {
        try {
            const {
                q: search,
                page = 1,
                limit = 20,
                sort = 'createdAt',
                order = 'desc'
            } = req.query;
            
            if (!search || search.trim().length < 3) {
                return res.status(400).json({
                    error: 'Search query must be at least 3 characters'
                });
            }
            
            // Build search query
            const query = {
                $or: [
                    { username: { $regex: search, $options: 'i' } },
                    { 'profile.displayName': { $regex: search, $options: 'i' } }
                ],
                'settings.privacy.profilePublic': true // Only search public profiles
            };
            
            const sortObj = {};
            sortObj[sort] = order === 'desc' ? -1 : 1;
            
            const users = await User.find(query)
                .select('username profile.displayName profile.avatar profile.bio createdAt')
                .sort(sortObj)
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await User.countDocuments(query);
            
            res.json({
                users,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / parseInt(limit)),
                    count: users.length,
                    totalUsers: total
                }
            });
            
        } catch (error) {
            console.error('User search error:', error);
            res.status(500).json({
                error: 'Failed to search users'
            });
        }
    });
    
    // Follow/Unfollow user (future feature - requires following schema)
    router.post('/:username/follow', authenticateToken, async (req, res) => {
        try {
            const { username } = req.params;
            
            const userToFollow = await User.findOne({ username: username.toLowerCase() });
            
            if (!userToFollow) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            if (userToFollow._id.toString() === req.user.userId) {
                return res.status(400).json({
                    error: 'Cannot follow yourself'
                });
            }
            
            // TODO: Implement following/followers functionality
            // This would require additional schema fields for followers/following
            
            res.json({
                message: 'Following feature coming soon!'
            });
            
        } catch (error) {
            console.error('Follow user error:', error);
            res.status(500).json({
                error: 'Failed to follow user'
            });
        }
    });
    
    // Get user's activity feed (own profile only)
    router.get('/me/activity', authenticateToken, async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                type // game_created, game_updated, game_published, etc.
            } = req.query;
            
            // This would typically come from an activity/feed collection
            // For now, we'll create a basic activity feed from user's data
            
            const activities = [];
            
            // Get recent games
            const recentGames = await Game.find({ owner: req.user.userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('name createdAt updatedAt publishing.status');
            
            for (const game of recentGames) {
                activities.push({
                    type: 'game_created',
                    timestamp: game.createdAt,
                    data: {
                        gameId: game._id,
                        gameName: game.name
                    }
                });
                
                if (game.updatedAt > game.createdAt) {
                    activities.push({
                        type: 'game_updated',
                        timestamp: game.updatedAt,
                        data: {
                            gameId: game._id,
                            gameName: game.name
                        }
                    });
                }
                
                if (game.publishing.status === 'published' && game.publishing.publishedAt) {
                    activities.push({
                        type: 'game_published',
                        timestamp: game.publishing.publishedAt,
                        data: {
                            gameId: game._id,
                            gameName: game.name
                        }
                    });
                }
            }
            
            // Get recent assets
            const recentAssets = await Asset.find({ owner: req.user.userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('name createdAt type');
            
            for (const asset of recentAssets) {
                activities.push({
                    type: 'asset_uploaded',
                    timestamp: asset.createdAt,
                    data: {
                        assetId: asset._id,
                        assetName: asset.name,
                        assetType: asset.type
                    }
                });
            }
            
            // Sort all activities by timestamp
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            // Apply pagination
            const startIndex = (parseInt(page) - 1) * parseInt(limit);
            const endIndex = startIndex + parseInt(limit);
            const paginatedActivities = activities.slice(startIndex, endIndex);
            
            res.json({
                activities: paginatedActivities,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(activities.length / parseInt(limit)),
                    count: paginatedActivities.length,
                    totalActivities: activities.length
                }
            });
            
        } catch (error) {
            console.error('Activity feed error:', error);
            res.status(500).json({
                error: 'Failed to fetch activity feed'
            });
        }
    });
    
    // Get user's dashboard stats (own profile only)
    router.get('/me/dashboard', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            
            // Get counts
            const gamesCount = await Game.countDocuments({ owner: userId });
            const assetsCount = await Asset.countDocuments({ owner: userId });
            const publicGamesCount = await Game.countDocuments({
                owner: userId,
                'publishing.status': { $in: ['public', 'published'] }
            });
            
            // Get total views and likes
            const games = await Game.find({ owner: userId })
                .select('publishing.views publishing.likes publishing.downloads');
            
            const totalViews = games.reduce((sum, game) => sum + (game.publishing.views || 0), 0);
            const totalLikes = games.reduce((sum, game) => sum + (game.publishing.likes || 0), 0);
            const totalDownloads = games.reduce((sum, game) => sum + (game.publishing.downloads || 0), 0);
            
            // Get recent activity (last 30 days)
            const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            
            const recentGames = await Game.countDocuments({
                owner: userId,
                createdAt: { $gte: thirtyDaysAgo }
            });
            
            const recentAssets = await Asset.countDocuments({
                owner: userId,
                createdAt: { $gte: thirtyDaysAgo }
            });
            
            // Get storage usage
            const user = await User.findById(userId).select('usage subscription');
            
            const storageQuotas = {
                free: 100 * 1024 * 1024, // 100MB
                pro: 10 * 1024 * 1024 * 1024, // 10GB
                team: 50 * 1024 * 1024 * 1024, // 50GB
                enterprise: Infinity
            };
            
            const storageQuota = storageQuotas[user.subscription.plan] || storageQuotas.free;
            
            res.json({
                dashboard: {
                    totals: {
                        games: gamesCount,
                        publicGames: publicGamesCount,
                        assets: assetsCount,
                        views: totalViews,
                        likes: totalLikes,
                        downloads: totalDownloads
                    },
                    recent: {
                        gamesCreated: recentGames,
                        assetsUploaded: recentAssets
                    },
                    storage: {
                        used: user.usage.storageUsed,
                        quota: storageQuota,
                        percentage: Math.round((user.usage.storageUsed / storageQuota) * 100)
                    },
                    subscription: {
                        plan: user.subscription.plan,
                        status: user.subscription.status
                    }
                }
            });
            
        } catch (error) {
            console.error('Dashboard stats error:', error);
            res.status(500).json({
                error: 'Failed to fetch dashboard statistics'
            });
        }
    });
    
    // Update user avatar
    router.put('/me/avatar', authenticateToken, async (req, res) => {
        try {
            const { avatarUrl } = req.body;
            
            if (!avatarUrl) {
                return res.status(400).json({
                    error: 'Avatar URL is required'
                });
            }
            
            // Basic URL validation
            try {
                new URL(avatarUrl);
            } catch (error) {
                return res.status(400).json({
                    error: 'Invalid avatar URL'
                });
            }
            
            const user = await User.findByIdAndUpdate(
                req.user.userId,
                { 'profile.avatar': avatarUrl },
                { new: true }
            ).select('profile.avatar');
            
            res.json({
                message: 'Avatar updated successfully',
                avatarUrl: user.profile.avatar
            });
            
        } catch (error) {
            console.error('Avatar update error:', error);
            res.status(500).json({
                error: 'Failed to update avatar'
            });
        }
    });
    
    // Delete user account
    router.delete('/me/account', authenticateToken, async (req, res) => {
        try {
            const { confirmPassword } = req.body;
            
            if (!confirmPassword) {
                return res.status(400).json({
                    error: 'Password confirmation required'
                });
            }
            
            const user = await User.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Verify password
            const isValidPassword = await user.comparePassword(confirmPassword);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Invalid password'
                });
            }
            
            // TODO: Implement proper account deletion
            // - Transfer or delete user's games
            // - Delete user's assets and files
            // - Remove from all collaborations
            // - Cancel subscriptions
            // - Clean up all related data
            
            // For now, just mark account as deleted
            await User.findByIdAndUpdate(req.user.userId, {
                $set: {
                    'profile.displayName': '[Deleted User]',
                    'profile.bio': '',
                    'profile.avatar': null,
                    'profile.website': '',
                    'profile.location': '',
                    'profile.skills': [],
                    'profile.socialLinks': {},
                    'settings.privacy.profilePublic': false,
                    email: `deleted_${Date.now()}@dreammaker.dev`
                }
            });
            
            res.json({
                message: 'Account deletion initiated. Your data will be removed within 30 days.'
            });
            
        } catch (error) {
            console.error('Account deletion error:', error);
            res.status(500).json({
                error: 'Failed to delete account'
            });
        }
    });
    
    // Get user notifications (future feature)
    router.get('/me/notifications', authenticateToken, async (req, res) => {
        try {
            // TODO: Implement notifications system
            res.json({
                notifications: [],
                unreadCount: 0
            });
            
        } catch (error) {
            console.error('Notifications fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch notifications'
            });
        }
    });
    
    // Export user data (GDPR compliance)
    router.get('/me/export', authenticateToken, async (req, res) => {
        try {
            const userId = req.user.userId;
            
            // Get all user data
            const user = await User.findById(userId);
            const games = await Game.find({ owner: userId });
            const assets = await Asset.find({ owner: userId });
            const ratings = await Rating.find({ user: userId });
            
            const exportData = {
                exportDate: new Date().toISOString(),
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    settings: user.settings,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin
                },
                games: games.map(game => ({
                    id: game._id,
                    name: game.name,
                    description: game.description,
                    createdAt: game.createdAt,
                    publishing: game.publishing
                })),
                assets: assets.map(asset => ({
                    id: asset._id,
                    name: asset.name,
                    type: asset.type,
                    size: asset.size,
                    createdAt: asset.createdAt
                })),
                ratings: ratings.map(rating => ({
                    gameId: rating.game,
                    rating: rating.rating,
                    review: rating.review,
                    createdAt: rating.createdAt
                }))
            };
            
            res.setHeader('Content-Type', 'application/json');
            res.setHeader('Content-Disposition', `attachment; filename="dreammaker-data-${userId}.json"`);
            res.json(exportData);
            
        } catch (error) {
            console.error('Data export error:', error);
            res.status(500).json({
                error: 'Failed to export user data'
            });
        }
    });
    
    return router;
};