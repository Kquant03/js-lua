// server/api/assets.js - Complete Assets Management API
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const { Asset, User, Game } = require('../database/models');
const mongoose = require('mongoose');

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(__dirname, '../uploads');
        
        try {
            await fs.mkdir(uploadDir, { recursive: true });
            cb(null, uploadDir);
        } catch (error) {
            cb(error);
        }
    },
    filename: (req, file, cb) => {
        // Generate unique filename
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
    }
});

// File filter for security
const fileFilter = (req, file, cb) => {
    const allowedMimes = {
        image: ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'],
        audio: ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm'],
        video: ['video/mp4', 'video/webm', 'video/ogg'],
        font: ['font/ttf', 'font/otf', 'font/woff', 'font/woff2', 'application/font-woff'],
        data: ['application/json', 'text/plain', 'text/csv']
    };
    
    const allAllowed = Object.values(allowedMimes).flat();
    
    if (allAllowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error(`File type ${file.mimetype} not allowed`), false);
    }
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max file size
        files: 10 // Max 10 files per upload
    }
});

// Helper function to determine asset type from mime type
function getAssetType(mimetype) {
    if (mimetype.startsWith('image/')) return 'image';
    if (mimetype.startsWith('audio/')) return 'audio';
    if (mimetype.startsWith('video/')) return 'video';
    if (mimetype.includes('font')) return 'font';
    return 'data';
}

// Helper function to get file metadata
async function getFileMetadata(filePath, mimetype) {
    const metadata = {};
    
    try {
        if (mimetype.startsWith('image/')) {
            const imageInfo = await sharp(filePath).metadata();
            metadata.width = imageInfo.width;
            metadata.height = imageInfo.height;
            metadata.format = imageInfo.format;
            metadata.colorDepth = imageInfo.channels * 8;
        } else if (mimetype.startsWith('audio/')) {
            // For audio files, you'd typically use a library like node-ffprobe
            // For now, we'll use basic file stats
            const stats = await fs.stat(filePath);
            metadata.duration = null; // Would need audio analysis
            metadata.bitRate = null;
            metadata.channels = null;
        } else if (mimetype.startsWith('video/')) {
            // Similar to audio, would need video analysis
            metadata.duration = null;
            metadata.frameRate = null;
            metadata.width = null;
            metadata.height = null;
        }
    } catch (error) {
        console.warn('Failed to extract metadata:', error.message);
    }
    
    return metadata;
}

// Helper function to create thumbnail for images
async function createThumbnail(inputPath, outputPath) {
    try {
        await sharp(inputPath)
            .resize(200, 200, {
                fit: 'inside',
                withoutEnlargement: true
            })
            .jpeg({ quality: 80 })
            .toFile(outputPath);
        
        return outputPath;
    } catch (error) {
        console.warn('Failed to create thumbnail:', error.message);
        return null;
    }
}

module.exports = (authenticateToken, uploadLimiter) => {
    const router = express.Router();
    
    // Apply upload rate limiting
    router.use('/upload', uploadLimiter);
    
    // Upload single or multiple assets
    router.post('/upload', authenticateToken, upload.array('assets', 10), async (req, res) => {
        try {
            const { gameId, description, isPublic = false } = req.body;
            
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({
                    error: 'No files uploaded'
                });
            }
            
            // Validate game ownership if gameId provided
            if (gameId) {
                if (!mongoose.Types.ObjectId.isValid(gameId)) {
                    return res.status(400).json({
                        error: 'Invalid game ID'
                    });
                }
                
                const game = await Game.findById(gameId);
                
                if (!game) {
                    return res.status(404).json({
                        error: 'Game not found'
                    });
                }
                
                // Check if user has permission to upload to this game
                const isOwner = game.owner.toString() === req.user.userId;
                const isCollaborator = game.collaborators.some(
                    collab => collab.user.toString() === req.user.userId && 
                    collab.permissions.canEdit
                );
                
                if (!isOwner && !isCollaborator) {
                    return res.status(403).json({
                        error: 'No permission to upload assets to this game'
                    });
                }
            }
            
            // Check user's storage quota
            const user = await User.findById(req.user.userId);
            const totalFileSize = req.files.reduce((sum, file) => sum + file.size, 0);
            
            const storageQuotas = {
                free: 100 * 1024 * 1024, // 100MB
                pro: 10 * 1024 * 1024 * 1024, // 10GB
                team: 50 * 1024 * 1024 * 1024, // 50GB
                enterprise: Infinity
            };
            
            const quota = storageQuotas[user.subscription.plan] || storageQuotas.free;
            
            if (user.usage.storageUsed + totalFileSize > quota) {
                return res.status(413).json({
                    error: 'Storage quota exceeded',
                    currentUsage: user.usage.storageUsed,
                    quota,
                    required: totalFileSize
                });
            }
            
            const createdAssets = [];
            const errors = [];
            
            // Process each uploaded file
            for (const file of req.files) {
                try {
                    // Get file metadata
                    const metadata = await getFileMetadata(file.path, file.mimetype);
                    
                    // Create thumbnail for images
                    let thumbnailUrl = null;
                    if (file.mimetype.startsWith('image/')) {
                        const thumbnailName = `thumb-${file.filename}`;
                        const thumbnailPath = path.join(path.dirname(file.path), thumbnailName);
                        
                        const thumbnailCreated = await createThumbnail(file.path, thumbnailPath);
                        if (thumbnailCreated) {
                            thumbnailUrl = `/uploads/${thumbnailName}`;
                        }
                    }
                    
                    // Create asset record
                    const asset = new Asset({
                        name: path.parse(file.originalname).name,
                        originalName: file.originalname,
                        description: description || '',
                        type: getAssetType(file.mimetype),
                        mimeType: file.mimetype,
                        size: file.size,
                        url: `/uploads/${file.filename}`,
                        thumbnailUrl,
                        owner: req.user.userId,
                        game: gameId || null,
                        metadata,
                        sharing: {
                            public: isPublic === 'true' || isPublic === true
                        }
                    });
                    
                    await asset.save();
                    createdAssets.push(asset);
                    
                    // Update user storage usage
                    await User.findByIdAndUpdate(req.user.userId, {
                        $inc: { 'usage.storageUsed': file.size }
                    });
                    
                } catch (error) {
                    console.error(`Failed to process file ${file.originalname}:`, error);
                    errors.push({
                        filename: file.originalname,
                        error: error.message
                    });
                    
                    // Clean up failed file
                    try {
                        await fs.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Failed to clean up file:', unlinkError);
                    }
                }
            }
            
            if (createdAssets.length === 0) {
                return res.status(400).json({
                    error: 'No assets were successfully uploaded',
                    errors
                });
            }
            
            res.status(201).json({
                message: `${createdAssets.length} asset(s) uploaded successfully`,
                assets: createdAssets,
                errors: errors.length > 0 ? errors : undefined
            });
            
        } catch (error) {
            console.error('Asset upload error:', error);
            
            // Clean up uploaded files on error
            if (req.files) {
                for (const file of req.files) {
                    try {
                        await fs.unlink(file.path);
                    } catch (unlinkError) {
                        console.error('Failed to clean up file:', unlinkError);
                    }
                }
            }
            
            if (error instanceof multer.MulterError) {
                if (error.code === 'LIMIT_FILE_SIZE') {
                    return res.status(413).json({
                        error: 'File too large. Maximum size is 50MB per file.'
                    });
                }
                if (error.code === 'LIMIT_FILE_COUNT') {
                    return res.status(400).json({
                        error: 'Too many files. Maximum 10 files per upload.'
                    });
                }
            }
            
            res.status(500).json({
                error: 'Failed to upload assets'
            });
        }
    });
    
    // Get user's assets
    router.get('/', authenticateToken, async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                type,
                gameId,
                search,
                sort = 'createdAt',
                order = 'desc'
            } = req.query;
            
            // Build query
            const query = { owner: req.user.userId };
            
            if (type) {
                query.type = type;
            }
            
            if (gameId) {
                if (gameId === 'null' || gameId === 'none') {
                    query.game = null; // Unassigned assets
                } else if (mongoose.Types.ObjectId.isValid(gameId)) {
                    query.game = gameId;
                }
            }
            
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } },
                    { originalName: { $regex: search, $options: 'i' } }
                ];
            }
            
            // Build sort
            const sortObj = {};
            sortObj[sort] = order === 'desc' ? -1 : 1;
            
            const assets = await Asset.find(query)
                .populate('game', 'name')
                .sort(sortObj)
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await Asset.countDocuments(query);
            
            res.json({
                assets,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / parseInt(limit)),
                    count: assets.length,
                    totalAssets: total
                }
            });
            
        } catch (error) {
            console.error('Assets fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch assets'
            });
        }
    });
    
    // Get single asset
    router.get('/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid asset ID'
                });
            }
            
            const asset = await Asset.findById(id)
                .populate('owner', 'username profile.displayName')
                .populate('game', 'name');
            
            if (!asset) {
                return res.status(404).json({
                    error: 'Asset not found'
                });
            }
            
            // Check access permissions
            const isOwner = asset.owner._id.toString() === req.user.userId;
            const isPublic = asset.sharing.public;
            
            // Check if user has access through game collaboration
            let hasGameAccess = false;
            if (asset.game) {
                const game = await Game.findById(asset.game._id);
                if (game) {
                    hasGameAccess = game.collaborators.some(
                        collab => collab.user.toString() === req.user.userId
                    );
                }
            }
            
            if (!isOwner && !isPublic && !hasGameAccess) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Increment view count if not owner
            if (!isOwner) {
                await Asset.findByIdAndUpdate(id, {
                    $inc: { 'usage.views': 1 }
                });
            }
            
            res.json({ asset });
            
        } catch (error) {
            console.error('Asset fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch asset'
            });
        }
    });
    
    // Update asset
    router.put('/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            const { name, description, gameId, isPublic } = req.body;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid asset ID'
                });
            }
            
            const asset = await Asset.findById(id);
            
            if (!asset) {
                return res.status(404).json({
                    error: 'Asset not found'
                });
            }
            
            // Only owner can update
            if (asset.owner.toString() !== req.user.userId) {
                return res.status(403).json({
                    error: 'Only the owner can update this asset'
                });
            }
            
            // Validate game ownership if gameId provided
            if (gameId && gameId !== 'null') {
                if (!mongoose.Types.ObjectId.isValid(gameId)) {
                    return res.status(400).json({
                        error: 'Invalid game ID'
                    });
                }
                
                const game = await Game.findById(gameId);
                
                if (!game) {
                    return res.status(404).json({
                        error: 'Game not found'
                    });
                }
                
                const isOwner = game.owner.toString() === req.user.userId;
                const isCollaborator = game.collaborators.some(
                    collab => collab.user.toString() === req.user.userId
                );
                
                if (!isOwner && !isCollaborator) {
                    return res.status(403).json({
                        error: 'No access to the specified game'
                    });
                }
            }
            
            // Build update object
            const updates = {};
            
            if (name !== undefined) {
                if (name.length > 100) {
                    return res.status(400).json({
                        error: 'Asset name must be 100 characters or less'
                    });
                }
                updates.name = name.trim();
            }
            
            if (description !== undefined) {
                if (description.length > 500) {
                    return res.status(400).json({
                        error: 'Description must be 500 characters or less'
                    });
                }
                updates.description = description.trim();
            }
            
            if (gameId !== undefined) {
                updates.game = gameId === 'null' ? null : gameId;
            }
            
            if (isPublic !== undefined) {
                updates['sharing.public'] = isPublic;
            }
            
            const updatedAsset = await Asset.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true, runValidators: true }
            ).populate('game', 'name');
            
            res.json({
                message: 'Asset updated successfully',
                asset: updatedAsset
            });
            
        } catch (error) {
            console.error('Asset update error:', error);
            res.status(500).json({
                error: 'Failed to update asset'
            });
        }
    });
    
    // Delete asset
    router.delete('/:id', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid asset ID'
                });
            }
            
            const asset = await Asset.findById(id);
            
            if (!asset) {
                return res.status(404).json({
                    error: 'Asset not found'
                });
            }
            
            // Only owner can delete
            if (asset.owner.toString() !== req.user.userId) {
                return res.status(403).json({
                    error: 'Only the owner can delete this asset'
                });
            }
            
            // Delete files from storage
            const filesToDelete = [asset.url];
            if (asset.thumbnailUrl) {
                filesToDelete.push(asset.thumbnailUrl);
            }
            
            for (const fileUrl of filesToDelete) {
                try {
                    const filePath = path.join(__dirname, '..', fileUrl);
                    await fs.unlink(filePath);
                } catch (error) {
                    console.warn(`Failed to delete file ${fileUrl}:`, error.message);
                }
            }
            
            // Update user storage usage
            await User.findByIdAndUpdate(req.user.userId, {
                $inc: { 'usage.storageUsed': -asset.size }
            });
            
            // Delete asset record
            await Asset.findByIdAndDelete(id);
            
            res.json({
                message: 'Asset deleted successfully'
            });
            
        } catch (error) {
            console.error('Asset deletion error:', error);
            res.status(500).json({
                error: 'Failed to delete asset'
            });
        }
    });
    
    // Get public assets (marketplace)
    router.get('/public/browse', async (req, res) => {
        try {
            const {
                page = 1,
                limit = 20,
                type,
                search,
                sort = 'createdAt',
                order = 'desc'
            } = req.query;
            
            // Query for public assets
            const query = { 'sharing.public': true };
            
            if (type) {
                query.type = type;
            }
            
            if (search) {
                query.$or = [
                    { name: { $regex: search, $options: 'i' } },
                    { description: { $regex: search, $options: 'i' } }
                ];
            }
            
            const sortObj = {};
            sortObj[sort] = order === 'desc' ? -1 : 1;
            
            const assets = await Asset.find(query)
                .populate('owner', 'username profile.displayName profile.avatar')
                .select('-url') // Don't expose direct URLs in public browse
                .sort(sortObj)
                .limit(parseInt(limit))
                .skip((parseInt(page) - 1) * parseInt(limit));
            
            const total = await Asset.countDocuments(query);
            
            res.json({
                assets,
                pagination: {
                    current: parseInt(page),
                    total: Math.ceil(total / parseInt(limit)),
                    count: assets.length,
                    totalAssets: total
                }
            });
            
        } catch (error) {
            console.error('Public assets fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch public assets'
            });
        }
    });
    
    // Download asset (with access control)
    router.get('/:id/download', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid asset ID'
                });
            }
            
            const asset = await Asset.findById(id).populate('game');
            
            if (!asset) {
                return res.status(404).json({
                    error: 'Asset not found'
                });
            }
            
            // Check access permissions
            const isOwner = asset.owner.toString() === req.user.userId;
            const isPublic = asset.sharing.public;
            
            let hasGameAccess = false;
            if (asset.game) {
                hasGameAccess = asset.game.collaborators.some(
                    collab => collab.user.toString() === req.user.userId
                );
            }
            
            if (!isOwner && !isPublic && !hasGameAccess) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            // Get file path
            const filePath = path.join(__dirname, '..', asset.url);
            
            try {
                await fs.access(filePath);
            } catch (error) {
                return res.status(404).json({
                    error: 'File not found on server'
                });
            }
            
            // Increment download count
            await Asset.findByIdAndUpdate(id, {
                $inc: { 'usage.downloads': 1 }
            });
            
            // Set appropriate headers
            res.setHeader('Content-Type', asset.mimeType);
            res.setHeader('Content-Disposition', `attachment; filename="${asset.originalName}"`);
            
            // Stream file
            const fileStream = require('fs').createReadStream(filePath);
            fileStream.pipe(res);
            
        } catch (error) {
            console.error('Asset download error:', error);
            res.status(500).json({
                error: 'Failed to download asset'
            });
        }
    });
    
    // Get asset usage statistics
    router.get('/:id/stats', authenticateToken, async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(400).json({
                    error: 'Invalid asset ID'
                });
            }
            
            const asset = await Asset.findById(id);
            
            if (!asset) {
                return res.status(404).json({
                    error: 'Asset not found'
                });
            }
            
            // Only owner can view stats
            if (asset.owner.toString() !== req.user.userId) {
                return res.status(403).json({
                    error: 'Access denied'
                });
            }
            
            res.json({
                stats: {
                    views: asset.usage.views,
                    downloads: asset.usage.downloads,
                    createdAt: asset.createdAt,
                    size: asset.size,
                    type: asset.type
                }
            });
            
        } catch (error) {
            console.error('Asset stats error:', error);
            res.status(500).json({
                error: 'Failed to fetch asset statistics'
            });
        }
    });
    
    return router;
};