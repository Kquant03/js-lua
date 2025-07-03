# DreamMaker Platform - Complete API Documentation

## Table of Contents
- [Authentication](#authentication)
- [Base URLs and Headers](#base-urls-and-headers)
- [Error Handling](#error-handling)
- [Rate Limiting](#rate-limiting)
- [Authentication Endpoints](#authentication-endpoints)
- [User Management](#user-management)
- [Games/Projects](#gamesprojects)
- [Asset Management](#asset-management)
- [AI Services](#ai-services)
- [Community Features](#community-features)

---

## Authentication

All protected endpoints require a Bearer token in the Authorization header:

```http
Authorization: Bearer <jwt_token>
```

Tokens are valid for 7 days and can be refreshed using the `/api/auth/refresh` endpoint.

## Base URLs and Headers

**Development:** `http://localhost:8080`  
**Production:** `https://api.dreammaker.dev`

### Required Headers
```http
Content-Type: application/json
Authorization: Bearer <token> (for protected endpoints)
```

### Optional Headers
```http
X-Client-Version: 1.0.0
X-Request-ID: unique-request-id
```

## Error Handling

All API responses follow a consistent error format:

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {
    "field": "specific error details"
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### HTTP Status Codes
- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `413` - Payload Too Large
- `429` - Too Many Requests
- `500` - Internal Server Error

## Rate Limiting

Rate limits vary by endpoint type:

- **Authentication:** 20 requests per 15 minutes
- **General API:** 1000 requests per 15 minutes
- **File Uploads:** 100 requests per hour
- **AI Services:** Based on subscription plan

Rate limit headers are included in responses:
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1642234800
```

---

# Authentication Endpoints

## POST /api/auth/register

Register a new user account.

**Request Body:**
```json
{
  "username": "string (3-30 chars, alphanumeric + _ -)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)",
  "confirmPassword": "string (must match password)"
}
```

**Response (201):**
```json
{
  "message": "User created successfully",
  "token": "jwt_token_string",
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "profile": {
      "displayName": "Display Name",
      "avatar": null,
      "bio": "",
      "website": "",
      "location": "",
      "skills": [],
      "socialLinks": {}
    },
    "settings": {
      "theme": "auto",
      "language": "en",
      "notifications": {},
      "privacy": {}
    },
    "subscription": {
      "plan": "free",
      "status": "active"
    },
    "verified": false
  }
}
```

**Errors:**
- `400` - Validation failed
- `409` - Username or email already exists

---

## POST /api/auth/login

Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "login": "username_or_email",
  "password": "user_password"
}
```

**Response (200):**
```json
{
  "message": "Login successful",
  "token": "jwt_token_string",
  "user": {
    // Same user object as registration
  }
}
```

**Errors:**
- `401` - Invalid credentials
- `423` - Account locked (too many failed attempts)

---

## GET /api/auth/me

Get current user information (requires authentication).

**Response (200):**
```json
{
  "user": {
    "id": "user_id",
    "username": "username",
    "email": "email@example.com",
    "profile": {},
    "settings": {},
    "subscription": {},
    "usage": {
      "projectsCreated": 5,
      "aiRequestsThisMonth": 45,
      "storageUsed": 1048576,
      "collaborationMinutesThisMonth": 120
    },
    "verified": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "lastLogin": "2024-01-15T10:30:00Z"
  }
}
```

---

## POST /api/auth/refresh

Refresh JWT token (requires valid token).

**Response (200):**
```json
{
  "message": "Token refreshed successfully",
  "token": "new_jwt_token_string"
}
```

---

## PUT /api/auth/profile

Update user profile information.

**Request Body:**
```json
{
  "profile.displayName": "New Display Name",
  "profile.bio": "Updated bio text",
  "profile.website": "https://example.com",
  "profile.location": "City, Country",
  "profile.skills": ["JavaScript", "Game Design"],
  "profile.socialLinks": {
    "twitter": "username",
    "github": "username"
  },
  "settings.theme": "dark",
  "settings.notifications.email": false
}
```

**Response (200):**
```json
{
  "message": "Profile updated successfully",
  "user": {
    // Updated user object
  }
}
```

---

## PUT /api/auth/password

Change user password.

**Request Body:**
```json
{
  "currentPassword": "current_password",
  "newPassword": "new_password",
  "confirmPassword": "new_password"
}
```

**Response (200):**
```json
{
  "message": "Password updated successfully"
}
```

---

## POST /api/auth/forgot-password

Request password reset email.

**Request Body:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "message": "If an account with that email exists, a password reset link has been sent"
}
```

---

## POST /api/auth/reset-password

Reset password using token from email.

**Request Body:**
```json
{
  "token": "reset_token_from_email",
  "newPassword": "new_password",
  "confirmPassword": "new_password"
}
```

**Response (200):**
```json
{
  "message": "Password reset successfully"
}
```

---

# User Management

## GET /api/users/:username

Get public user profile.

**Parameters:**
- `username` (path) - Username to fetch

**Response (200):**
```json
{
  "user": {
    "id": "user_id",
    "username": "username",
    "profile": {
      "displayName": "Display Name",
      "avatar": "avatar_url",
      "bio": "User bio",
      "website": "https://example.com",
      "location": "City, Country",
      "skills": ["JavaScript", "Game Design"],
      "socialLinks": {}
    },
    "stats": {
      "gamesCreated": 15,
      "totalViews": 1250,
      "totalLikes": 89,
      "averageRating": 4.2
    },
    "joinedAt": "2024-01-01T00:00:00Z"
  }
}
```

---

## GET /api/users/:username/games

Get user's public games.

**Parameters:**
- `username` (path) - Username
- `page` (query) - Page number (default: 1)
- `limit` (query) - Items per page (default: 12, max: 50)
- `sort` (query) - Sort field (createdAt, updatedAt, name, views, likes)
- `order` (query) - Sort order (asc, desc)

**Response (200):**
```json
{
  "games": [
    {
      "id": "game_id",
      "name": "Game Name",
      "description": "Game description",
      "thumbnail": "thumbnail_url",
      "owner": {
        "username": "owner_username",
        "profile": {
          "displayName": "Owner Name",
          "avatar": "avatar_url"
        }
      },
      "metadata": {
        "genre": "platformer",
        "tags": ["2d", "pixel-art"],
        "targetAudience": "everyone",
        "difficulty": "medium"
      },
      "publishing": {
        "status": "published",
        "views": 450,
        "likes": 23,
        "downloads": 15,
        "rating": {
          "average": 4.1,
          "count": 8
        }
      },
      "createdAt": "2024-01-01T00:00:00Z",
      "updatedAt": "2024-01-10T15:30:00Z"
    }
  ],
  "pagination": {
    "current": 1,
    "total": 3,
    "count": 12,
    "totalGames": 25
  }
}
```

---

## GET /api/users/me/dashboard

Get personal dashboard statistics (authenticated).

**Response (200):**
```json
{
  "dashboard": {
    "totals": {
      "games": 15,
      "publicGames": 8,
      "assets": 45,
      "views": 1250,
      "likes": 89,
      "downloads": 156
    },
    "recent": {
      "gamesCreated": 2,
      "assetsUploaded": 8
    },
    "storage": {
      "used": 52428800,
      "quota": 104857600,
      "percentage": 50
    },
    "subscription": {
      "plan": "pro",
      "status": "active"
    }
  }
}
```

---

## GET /api/users/me/activity

Get user activity feed (authenticated).

**Parameters:**
- `page` (query) - Page number (default: 1)
- `limit` (query) - Items per page (default: 20)
- `type` (query) - Filter by activity type

**Response (200):**
```json
{
  "activities": [
    {
      "type": "game_created",
      "timestamp": "2024-01-15T10:30:00Z",
      "data": {
        "gameId": "game_id",
        "gameName": "New Game"
      }
    },
    {
      "type": "asset_uploaded",
      "timestamp": "2024-01-15T09:15:00Z",
      "data": {
        "assetId": "asset_id",
        "assetName": "Character Sprite",
        "assetType": "image"
      }
    }
  ],
  "pagination": {
    "current": 1,
    "total": 5,
    "count": 20,
    "totalActivities": 89
  }
}
```

---

# Games/Projects

## GET /api/games

Get games list with filtering and pagination.

**Parameters:**
- `page` (query) - Page number (default: 1)
- `limit` (query) - Items per page (default: 20, max: 50)
- `sort` (query) - Sort field (createdAt, updatedAt, name, views, likes)
- `order` (query) - Sort order (asc, desc)
- `genre` (query) - Filter by genre
- `featured` (query) - Show only featured games (true/false)
- `search` (query) - Search in name, description, tags
- `owner` (query) - Filter by owner ID
- `status` (query) - Filter by status (public, mine, collaborated)

**Response (200):**
```json
{
  "games": [
    // Array of game objects (same structure as user games)
  ],
  "pagination": {
    "current": 1,
    "total": 10,
    "count": 20,
    "totalGames": 200
  }
}
```

---

## GET /api/games/:id

Get single game details.

**Parameters:**
- `id` (path) - Game ID
- `includeGameData` (query) - Include full game data (true/false, default: false)

**Response (200):**
```json
{
  "game": {
    "id": "game_id",
    "name": "Game Name",
    "description": "Game description",
    "thumbnail": "thumbnail_url",
    "owner": {
      "id": "owner_id",
      "username": "owner_username",
      "profile": {
        "displayName": "Owner Name",
        "avatar": "avatar_url"
      }
    },
    "collaborators": [
      {
        "user": {
          "id": "user_id",
          "username": "collaborator",
          "profile": {
            "displayName": "Collaborator Name",
            "avatar": "avatar_url"
          }
        },
        "role": "editor",
        "permissions": {
          "canEdit": true,
          "canInvite": false,
          "canExport": true,
          "canDelete": false
        },
        "joinedAt": "2024-01-05T00:00:00Z"
      }
    ],
    "gameData": {
      // Full game data object (if includeGameData=true)
      "settings": {},
      "entities": {},
      "scenes": {},
      "scripts": {},
      "assets": {}
    },
    "metadata": {
      "genre": "platformer",
      "tags": ["2d", "pixel-art"],
      "targetAudience": "everyone",
      "estimatedPlayTime": 30,
      "difficulty": "medium"
    },
    "publishing": {
      "status": "public",
      "publishedAt": "2024-01-10T00:00:00Z",
      "featured": false,
      "downloads": 156,
      "views": 1250,
      "likes": 89,
      "rating": {
        "average": 4.2,
        "count": 15
      }
    },
    "versions": [
      {
        "version": "v1",
        "changelog": "Initial release",
        "createdAt": "2024-01-01T00:00:00Z",
        "createdBy": "user_id"
      }
    ],
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "userPermissions": {
    "canEdit": true,
    "canInvite": true,
    "canExport": true,
    "canDelete": true,
    "role": "owner"
  }
}
```

---

## POST /api/games

Create a new game.

**Request Body:**
```json
{
  "name": "My New Game",
  "description": "A description of my game",
  "genre": "platformer",
  "template": "platformer-template" // optional
}
```

**Response (201):**
```json
{
  "message": "Game created successfully",
  "game": {
    // Full game object
  }
}
```

**Errors:**
- `400` - Invalid name or validation failed
- `403` - Project limit reached (upgrade required)

---

## PUT /api/games/:id

Update game information.

**Parameters:**
- `id` (path) - Game ID

**Request Body:**
```json
{
  "name": "Updated Game Name",
  "description": "Updated description",
  "gameData": {
    // Updated game data structure
  },
  "metadata": {
    "genre": "adventure",
    "tags": ["3d", "story-driven"],
    "targetAudience": "teens",
    "difficulty": "hard"
  },
  "publishing": {
    "status": "published"
  },
  "changelog": "Updated level design and added new mechanics"
}
```

**Response (200):**
```json
{
  "message": "Game updated successfully",
  "game": {
    // Updated game object
  }
}
```

**Errors:**
- `403` - No permission to edit
- `404` - Game not found

---

## DELETE /api/games/:id

Delete a game (owner only).

**Parameters:**
- `id` (path) - Game ID

**Response (200):**
```json
{
  "message": "Game deleted successfully"
}
```

---

## POST /api/games/:id/collaborators

Invite a collaborator to the game.

**Parameters:**
- `id` (path) - Game ID

**Request Body:**
```json
{
  "username": "collaborator_username",
  "role": "editor" // owner, editor, viewer
}
```

**Response (200):**
```json
{
  "message": "Collaborator added successfully",
  "collaborator": {
    "user": {
      "id": "user_id",
      "username": "collaborator",
      "profile": {
        "displayName": "Collaborator Name",
        "avatar": "avatar_url"
      }
    },
    "role": "editor",
    "permissions": {
      "canEdit": true,
      "canInvite": false,
      "canExport": true,
      "canDelete": false
    },
    "joinedAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## DELETE /api/games/:id/collaborators/:userId

Remove a collaborator from the game.

**Parameters:**
- `id` (path) - Game ID
- `userId` (path) - User ID to remove

**Response (200):**
```json
{
  "message": "Collaborator removed successfully"
}
```

---

## POST /api/games/:id/rating

Rate a game.

**Parameters:**
- `id` (path) - Game ID

**Request Body:**
```json
{
  "rating": 5, // 1-5 stars
  "review": "Amazing game! Great mechanics and art style."
}
```

**Response (200):**
```json
{
  "message": "Rating submitted successfully",
  "rating": {
    "average": 4.3,
    "count": 16
  }
}
```

---

## GET /api/games/:id/ratings

Get game ratings and reviews.

**Parameters:**
- `id` (path) - Game ID
- `page` (query) - Page number
- `limit` (query) - Items per page

**Response (200):**
```json
{
  "ratings": [
    {
      "id": "rating_id",
      "user": {
        "username": "reviewer",
        "profile": {
          "displayName": "Reviewer Name",
          "avatar": "avatar_url"
        }
      },
      "rating": 5,
      "review": "Amazing game!",
      "helpful": 3,
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "current": 1,
    "total": 2,
    "count": 10,
    "totalRatings": 16
  }
}
```

---

## POST /api/games/:id/clone

Clone/duplicate a game.

**Parameters:**
- `id` (path) - Game ID to clone

**Request Body:**
```json
{
  "name": "My Cloned Game" // optional, defaults to "Original Name (Copy)"
}
```

**Response (201):**
```json
{
  "message": "Game cloned successfully",
  "game": {
    // New cloned game object
  }
}
```

---

# Asset Management

## POST /api/assets/upload

Upload one or more assets.

**Content-Type:** `multipart/form-data`

**Form Fields:**
- `assets` (files) - Array of files to upload (max 10 files, 50MB each)
- `gameId` (string, optional) - Game ID to associate assets with
- `description` (string, optional) - Asset description
- `isPublic` (boolean, optional) - Make assets publicly available

**Response (201):**
```json
{
  "message": "3 asset(s) uploaded successfully",
  "assets": [
    {
      "id": "asset_id",
      "name": "Character Sprite",
      "originalName": "character.png",
      "description": "",
      "type": "image",
      "mimeType": "image/png",
      "size": 15360,
      "url": "/uploads/asset-1642234800123-random.png",
      "thumbnailUrl": "/uploads/thumb-asset-1642234800123-random.png",
      "owner": "user_id",
      "game": "game_id",
      "metadata": {
        "width": 64,
        "height": 64,
        "format": "png",
        "colorDepth": 32
      },
      "processing": {
        "status": "completed",
        "progress": 100
      },
      "sharing": {
        "public": false
      },
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ],
  "errors": [] // Any failed uploads
}
```

**Errors:**
- `400` - No files uploaded or invalid files
- `413` - File too large or storage quota exceeded
- `415` - Unsupported file type

---

## GET /api/assets

Get user's assets.

**Parameters:**
- `page` (query) - Page number (default: 1)
- `limit` (query) - Items per page (default: 20, max: 50)
- `type` (query) - Filter by asset type (image, audio, video, font, data)
- `gameId` (query) - Filter by game ID (use 'null' for unassigned assets)
- `search` (query) - Search in name, description
- `sort` (query) - Sort field (createdAt, name, size, type)
- `order` (query) - Sort order (asc, desc)

**Response (200):**
```json
{
  "assets": [
    {
      // Asset object (same structure as upload response)
    }
  ],
  "pagination": {
    "current": 1,
    "total": 5,
    "count": 20,
    "totalAssets": 89
  }
}
```

---

## GET /api/assets/:id

Get single asset details.

**Parameters:**
- `id` (path) - Asset ID

**Response (200):**
```json
{
  "asset": {
    "id": "asset_id",
    "name": "Character Sprite",
    "originalName": "character.png",
    "description": "Main character walking animation",
    "type": "image",
    "mimeType": "image/png",
    "size": 15360,
    "url": "/uploads/asset-1642234800123-random.png",
    "thumbnailUrl": "/uploads/thumb-asset-1642234800123-random.png",
    "owner": {
      "username": "creator",
      "profile": {
        "displayName": "Asset Creator"
      }
    },
    "game": {
      "id": "game_id",
      "name": "Game Name"
    },
    "metadata": {
      "width": 64,
      "height": 64,
      "format": "png",
      "colorDepth": 32
    },
    "usage": {
      "views": 15,
      "downloads": 3
    },
    "sharing": {
      "public": false,
      "marketplace": {
        "listed": false,
        "price": 0,
        "license": "proprietary"
      }
    },
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

## PUT /api/assets/:id

Update asset information.

**Parameters:**
- `id` (path) - Asset ID

**Request Body:**
```json
{
  "name": "Updated Asset Name",
  "description": "Updated description",
  "gameId": "new_game_id", // or null to unassign
  "isPublic": true
}
```

**Response (200):**
```json
{
  "message": "Asset updated successfully",
  "asset": {
    // Updated asset object
  }
}
```

---

## DELETE /api/assets/:id

Delete an asset.

**Parameters:**
- `id` (path) - Asset ID

**Response (200):**
```json
{
  "message": "Asset deleted successfully"
}
```

---

## GET /api/assets/:id/download

Download an asset file.

**Parameters:**
- `id` (path) - Asset ID

**Response (200):**
- Binary file content with appropriate headers
- `Content-Type`: Original file MIME type
- `Content-Disposition`: attachment; filename="original_name.ext"

---

## GET /api/assets/public/browse

Browse public assets marketplace.

**Parameters:**
- `page` (query) - Page number
- `limit` (query) - Items per page
- `type` (query) - Filter by asset type
- `search` (query) - Search query
- `sort` (query) - Sort field
- `order` (query) - Sort order

**Response (200):**
```json
{
  "assets": [
    {
      // Public asset objects (without direct URLs)
    }
  ],
  "pagination": {
    "current": 1,
    "total": 50,
    "count": 20,
    "totalAssets": 1000
  }
}
```

---

# AI Services

## POST /api/ai/openai

Proxy to OpenAI Chat Completions API.

**Request Body:**
```json
{
  "model": "gpt-4",
  "messages": [
    {
      "role": "user",
      "content": "Generate a simple platform game concept"
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7
}
```

**Response (200):**
```json
{
  "id": "chatcmpl-123",
  "object": "chat.completion",
  "created": 1642234800,
  "model": "gpt-4",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "Here's a platform game concept..."
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 25,
    "completion_tokens": 150,
    "total_tokens": 175
  }
}
```

**Errors:**
- `429` - Rate limit exceeded
- `402` - Payment required (quota exceeded)

---

## POST /api/ai/claude

Proxy to Anthropic Claude API.

**Request Body:**
```json
{
  "messages": [
    {
      "role": "user",
      "content": "Help me design a character for my game"
    }
  ],
  "max_tokens": 2048,
  "temperature": 0.7
}
```

**Response (200):**
```json
{
  "id": "msg_123",
  "type": "message",
  "role": "assistant",
  "content": [
    {
      "type": "text",
      "text": "I'd be happy to help you design a character..."
    }
  ],
  "model": "claude-3-sonnet-20240229",
  "stop_reason": "end_turn",
  "usage": {
    "input_tokens": 20,
    "output_tokens": 120
  }
}
```

---

## POST /api/ai/stability

Generate images using Stability AI.

**Request Body:**
```json
{
  "prompt": "A pixel art character sprite for a platformer game",
  "style_preset": "pixel-art",
  "aspect_ratio": "1:1"
}
```

**Response (200):**
- Binary image data (PNG format)
- `Content-Type`: image/png

---

# Health and Status Endpoints

## GET /health

Basic health check endpoint.

**Response (200):**
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00Z",
  "version": "1.0.0",
  "environment": "production",
  "uptime": 86400,
  "database": {
    "status": "connected",
    "readyState": 1
  },
  "memory": {
    "rss": 128,
    "heapTotal": 64,
    "heapUsed": 32,
    "external": 8
  },
  "connections": {
    "websockets": 45
  }
}
```

---

# Error Response Examples

## Validation Error (400)
```json
{
  "error": "Validation failed",
  "details": [
    "Username is required",
    "Password must be at least 8 characters"
  ],
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Authentication Error (401)
```json
{
  "error": "Invalid or expired token",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Rate Limit Error (429)
```json
{
  "error": "Too many requests, please try again later",
  "retryAfter": 900,
  "limit": 1000,
  "remaining": 0,
  "resetTime": "2024-01-15T11:00:00Z",
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Server Error (500)
```json
{
  "error": "Internal server error",
  "requestId": "req_123456",
  "timestamp": "2024-01-15T10:30:00Z"
}
```