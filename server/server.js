#!/usr/bin/env node

/**
 * DreamMaker Platform - Main Server
 * Production-ready Express.js server with WebSocket support
 */

// Load environment variables first
require('dotenv').config();

const express = require('express');
const http = require('http');
const path = require('path');
const mongoose = require('mongoose');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const { Server } = require('socket.io');
const fileUpload = require('express-fileupload');
const winston = require('winston');

// Only initialize Sentry if DSN is valid
let Sentry = null;
if (process.env.SENTRY_DSN && !process.env.SENTRY_DSN.includes('your-sentry-dsn')) {
  Sentry = require('@sentry/node');
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development'
  });
}

// Import collaboration system with fallback
let WebSocketHandler;
try {
  WebSocketHandler = require('./collaboration/websocket-server');
} catch (error) {
  console.warn('WebSocket collaboration system not available:', error.message);
  // Fallback minimal WebSocket handler
  WebSocketHandler = class {
    constructor(io) {
      this.io = io;
      console.log('Using minimal WebSocket fallback');
    }
    
    setupEventHandlers() {
      this.io.on('connection', (socket) => {
        console.log('Client connected:', socket.id);
        
        socket.on('disconnect', () => {
          console.log('Client disconnected:', socket.id);
        });
        
        // Basic echo for testing
        socket.on('test', (data) => {
          socket.emit('test-response', { message: 'Server is working', data });
        });
      });
    }
  };
}

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'dreammaker-server' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Configure Socket.IO
const io = new Server(server, {
  cors: {
    origin: (process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:8080").split(','),
    methods: ["GET", "POST"],
    credentials: true
  },
  transports: ['websocket', 'polling']
});

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };

  res.status(200).json(health);
});

// Basic middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// Serve main application
app.get('/', (req, res) => {
  res.json({ message: 'DreamMaker Platform Server', status: 'running' });
});

// Initialize WebSocket system
const wsHandler = new WebSocketHandler(io);
wsHandler.setupEventHandlers();

// Start server
async function startServer() {
  try {
    const PORT = process.env.PORT || 8080;
    server.listen(PORT, () => {
      logger.info(`🚀 DreamMaker server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      logger.info(`📡 WebSocket server initialized`);
      logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the server
startServer();
