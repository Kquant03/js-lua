// server/api/auth.js - Complete Authentication API
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const { User } = require('../database/models');

// Stricter rate limiting for auth endpoints
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 requests per windowMs
    message: { error: 'Too many authentication attempts, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});

const forgotPasswordLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 3, // Only 3 password reset attempts per hour
    message: { error: 'Too many password reset attempts, please try again later.' },
});

module.exports = (authenticateToken) => {
    const router = express.Router();
    
    // Apply rate limiting to all auth routes
    router.use(authLimiter);
    
    // Register new user
    router.post('/register', async (req, res) => {
        try {
            const { username, email, password, confirmPassword } = req.body;
            
            // Validation
            if (!username || !email || !password || !confirmPassword) {
                return res.status(400).json({
                    error: 'All fields are required',
                    fields: ['username', 'email', 'password', 'confirmPassword']
                });
            }
            
            if (password !== confirmPassword) {
                return res.status(400).json({
                    error: 'Passwords do not match'
                });
            }
            
            if (password.length < 8) {
                return res.status(400).json({
                    error: 'Password must be at least 8 characters long'
                });
            }
            
            if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
                return res.status(400).json({
                    error: 'Username can only contain letters, numbers, underscores, and hyphens'
                });
            }
            
            if (username.length < 3 || username.length > 30) {
                return res.status(400).json({
                    error: 'Username must be between 3 and 30 characters'
                });
            }
            
            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [
                    { email: email.toLowerCase() },
                    { username: username.toLowerCase() }
                ]
            });
            
            if (existingUser) {
                const field = existingUser.email === email.toLowerCase() ? 'email' : 'username';
                return res.status(409).json({
                    error: `User with this ${field} already exists`
                });
            }
            
            // Create new user
            const user = new User({
                username: username.toLowerCase(),
                email: email.toLowerCase(),
                password, // Will be hashed by pre-save middleware
                verification: {
                    email: {
                        verified: false,
                        token: crypto.randomBytes(32).toString('hex'),
                        expires: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
                    }
                }
            });
            
            await user.save();
            
            // Generate JWT
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET || 'dreammaker-secret-key',
                { expiresIn: '7d' }
            );
            
            // TODO: Send verification email
            console.log(`Verification token for ${email}: ${user.verification.email.token}`);
            
            res.status(201).json({
                message: 'User created successfully',
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    settings: user.settings,
                    subscription: user.subscription,
                    verified: user.verification.email.verified
                }
            });
            
        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.code === 11000) {
                const field = Object.keys(error.keyPattern)[0];
                return res.status(409).json({
                    error: `${field} already exists`
                });
            }
            
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors
                });
            }
            
            res.status(500).json({
                error: 'Failed to create user'
            });
        }
    });
    
    // Login user
    router.post('/login', async (req, res) => {
        try {
            const { login, password } = req.body; // login can be username or email
            
            if (!login || !password) {
                return res.status(400).json({
                    error: 'Username/email and password are required'
                });
            }
            
            // Find user by username or email
            const user = await User.findOne({
                $or: [
                    { email: login.toLowerCase() },
                    { username: login.toLowerCase() }
                ]
            });
            
            if (!user) {
                return res.status(401).json({
                    error: 'Invalid credentials'
                });
            }
            
            // Check if account is locked
            if (user.isLocked) {
                return res.status(423).json({
                    error: 'Account temporarily locked due to too many failed login attempts',
                    lockUntil: user.security.lockUntil
                });
            }
            
            // Verify password
            const isValidPassword = await user.comparePassword(password);
            
            if (!isValidPassword) {
                // Increment login attempts
                await user.incrementLoginAttempts();
                
                return res.status(401).json({
                    error: 'Invalid credentials',
                    attemptsRemaining: Math.max(0, 5 - (user.security.loginAttempts + 1))
                });
            }
            
            // Reset login attempts on successful login
            if (user.security.loginAttempts > 0) {
                await User.updateOne(
                    { _id: user._id },
                    {
                        $unset: { 'security.loginAttempts': 1, 'security.lockUntil': 1 }
                    }
                );
            }
            
            // Update last login
            user.lastLogin = new Date();
            await user.save();
            
            // Generate JWT
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET || 'dreammaker-secret-key',
                { expiresIn: '7d' }
            );
            
            res.json({
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    settings: user.settings,
                    subscription: user.subscription,
                    verified: user.verification.email.verified
                }
            });
            
        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                error: 'Login failed'
            });
        }
    });
    
    // Verify JWT token and get user info
    router.get('/me', authenticateToken, async (req, res) => {
        try {
            const user = await User.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            res.json({
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    settings: user.settings,
                    subscription: user.subscription,
                    usage: user.usage,
                    verified: user.verification.email.verified,
                    createdAt: user.createdAt,
                    lastLogin: user.lastLogin
                }
            });
            
        } catch (error) {
            console.error('User fetch error:', error);
            res.status(500).json({
                error: 'Failed to fetch user information'
            });
        }
    });
    
    // Refresh JWT token
    router.post('/refresh', authenticateToken, async (req, res) => {
        try {
            const user = await User.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Generate new JWT
            const token = jwt.sign(
                { 
                    userId: user._id, 
                    username: user.username,
                    email: user.email 
                },
                process.env.JWT_SECRET || 'dreammaker-secret-key',
                { expiresIn: '7d' }
            );
            
            res.json({
                message: 'Token refreshed successfully',
                token
            });
            
        } catch (error) {
            console.error('Token refresh error:', error);
            res.status(500).json({
                error: 'Failed to refresh token'
            });
        }
    });
    
    // Update user profile
    router.put('/profile', authenticateToken, async (req, res) => {
        try {
            const allowedUpdates = [
                'profile.displayName',
                'profile.bio',
                'profile.website',
                'profile.location',
                'profile.skills',
                'profile.socialLinks',
                'settings.theme',
                'settings.language',
                'settings.notifications',
                'settings.privacy'
            ];
            
            const updates = {};
            
            // Build update object with only allowed fields
            Object.keys(req.body).forEach(key => {
                if (allowedUpdates.includes(key)) {
                    updates[key] = req.body[key];
                }
            });
            
            // Validate profile data
            if (updates['profile.displayName'] && updates['profile.displayName'].length > 50) {
                return res.status(400).json({
                    error: 'Display name must be 50 characters or less'
                });
            }
            
            if (updates['profile.bio'] && updates['profile.bio'].length > 500) {
                return res.status(400).json({
                    error: 'Bio must be 500 characters or less'
                });
            }
            
            if (updates['profile.skills'] && updates['profile.skills'].length > 10) {
                return res.status(400).json({
                    error: 'Maximum 10 skills allowed'
                });
            }
            
            const user = await User.findByIdAndUpdate(
                req.user.userId,
                { $set: updates },
                { new: true, runValidators: true }
            );
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            res.json({
                message: 'Profile updated successfully',
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    settings: user.settings
                }
            });
            
        } catch (error) {
            console.error('Profile update error:', error);
            
            if (error.name === 'ValidationError') {
                const validationErrors = Object.values(error.errors).map(err => err.message);
                return res.status(400).json({
                    error: 'Validation failed',
                    details: validationErrors
                });
            }
            
            res.status(500).json({
                error: 'Failed to update profile'
            });
        }
    });
    
    // Change password
    router.put('/password', authenticateToken, async (req, res) => {
        try {
            const { currentPassword, newPassword, confirmPassword } = req.body;
            
            if (!currentPassword || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    error: 'All password fields are required'
                });
            }
            
            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    error: 'New passwords do not match'
                });
            }
            
            if (newPassword.length < 8) {
                return res.status(400).json({
                    error: 'New password must be at least 8 characters long'
                });
            }
            
            const user = await User.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            // Verify current password
            const isValidPassword = await user.comparePassword(currentPassword);
            
            if (!isValidPassword) {
                return res.status(401).json({
                    error: 'Current password is incorrect'
                });
            }
            
            // Update password
            user.password = newPassword; // Will be hashed by pre-save middleware
            await user.save();
            
            res.json({
                message: 'Password updated successfully'
            });
            
        } catch (error) {
            console.error('Password change error:', error);
            res.status(500).json({
                error: 'Failed to update password'
            });
        }
    });
    
    // Forgot password
    router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
        try {
            const { email } = req.body;
            
            if (!email) {
                return res.status(400).json({
                    error: 'Email is required'
                });
            }
            
            const user = await User.findOne({ email: email.toLowerCase() });
            
            // Always return success to prevent email enumeration
            if (!user) {
                return res.json({
                    message: 'If an account with that email exists, a password reset link has been sent'
                });
            }
            
            // Generate reset token
            const resetToken = crypto.randomBytes(32).toString('hex');
            
            user.verification.passwordReset = {
                token: resetToken,
                expires: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
            };
            
            await user.save();
            
            // TODO: Send password reset email
            console.log(`Password reset token for ${email}: ${resetToken}`);
            
            res.json({
                message: 'If an account with that email exists, a password reset link has been sent'
            });
            
        } catch (error) {
            console.error('Forgot password error:', error);
            res.status(500).json({
                error: 'Failed to process password reset request'
            });
        }
    });
    
    // Reset password with token
    router.post('/reset-password', async (req, res) => {
        try {
            const { token, newPassword, confirmPassword } = req.body;
            
            if (!token || !newPassword || !confirmPassword) {
                return res.status(400).json({
                    error: 'All fields are required'
                });
            }
            
            if (newPassword !== confirmPassword) {
                return res.status(400).json({
                    error: 'Passwords do not match'
                });
            }
            
            if (newPassword.length < 8) {
                return res.status(400).json({
                    error: 'Password must be at least 8 characters long'
                });
            }
            
            const user = await User.findOne({
                'verification.passwordReset.token': token,
                'verification.passwordReset.expires': { $gt: new Date() }
            });
            
            if (!user) {
                return res.status(400).json({
                    error: 'Invalid or expired reset token'
                });
            }
            
            // Update password and clear reset token
            user.password = newPassword; // Will be hashed by pre-save middleware
            user.verification.passwordReset = undefined;
            
            // Clear any login attempts/locks
            user.security.loginAttempts = 0;
            user.security.lockUntil = undefined;
            
            await user.save();
            
            res.json({
                message: 'Password reset successfully'
            });
            
        } catch (error) {
            console.error('Reset password error:', error);
            res.status(500).json({
                error: 'Failed to reset password'
            });
        }
    });
    
    // Verify email
    router.post('/verify-email', async (req, res) => {
        try {
            const { token } = req.body;
            
            if (!token) {
                return res.status(400).json({
                    error: 'Verification token is required'
                });
            }
            
            const user = await User.findOne({
                'verification.email.token': token,
                'verification.email.expires': { $gt: new Date() }
            });
            
            if (!user) {
                return res.status(400).json({
                    error: 'Invalid or expired verification token'
                });
            }
            
            // Mark email as verified
            user.verification.email.verified = true;
            user.verification.email.token = undefined;
            user.verification.email.expires = undefined;
            
            await user.save();
            
            res.json({
                message: 'Email verified successfully'
            });
            
        } catch (error) {
            console.error('Email verification error:', error);
            res.status(500).json({
                error: 'Failed to verify email'
            });
        }
    });
    
    // Resend verification email
    router.post('/resend-verification', authenticateToken, async (req, res) => {
        try {
            const user = await User.findById(req.user.userId);
            
            if (!user) {
                return res.status(404).json({
                    error: 'User not found'
                });
            }
            
            if (user.verification.email.verified) {
                return res.status(400).json({
                    error: 'Email is already verified'
                });
            }
            
            // Generate new verification token
            user.verification.email.token = crypto.randomBytes(32).toString('hex');
            user.verification.email.expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
            
            await user.save();
            
            // TODO: Send verification email
            console.log(`New verification token for ${user.email}: ${user.verification.email.token}`);
            
            res.json({
                message: 'Verification email sent successfully'
            });
            
        } catch (error) {
            console.error('Resend verification error:', error);
            res.status(500).json({
                error: 'Failed to send verification email'
            });
        }
    });
    
    // Logout (client-side token invalidation)
    router.post('/logout', authenticateToken, (req, res) => {
        // In a more sophisticated system, you might maintain a blacklist of tokens
        // For now, we rely on client-side token removal
        res.json({
            message: 'Logged out successfully'
        });
    });
    
    return router;
};