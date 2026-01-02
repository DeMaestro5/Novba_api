# Server Connection Issue Analysis & Fix Guide

## 🔍 Problem Summary

**Error**: `connect ECONNREFUSED 127.0.0.1:3000`  
**Request URL**: `http://localhost:5000/test`  
**Issue**: Port mismatch and server likely not running

## 📋 Root Causes Identified

### 1. **Missing Environment Variables (CRITICAL)**
- The server reads `PORT` from `process.env.PORT` in `src/config.ts`
- If `PORT` is `undefined`, the server will fail to start or listen on an invalid port
- **No `.env` file exists** in your project root
- The README mentions `.env.example` but it doesn't exist in the codebase

### 2. **Port Configuration Mismatch**
- You're requesting: `http://localhost:5000/test`
- Error shows: `127.0.0.1:3000`
- This suggests:
  - Server might be trying to start on port 3000 (default or from Dockerfile)
  - Or server isn't running at all
  - Or there's a proxy/redirect happening

### 3. **Docker Configuration Present (Not Blocking, But You Want It Removed)**
- `Dockerfile` - Docker container configuration
- `docker-compose.yml` - Docker Compose setup
- `.dockerignore` - Docker ignore patterns
- These files don't prevent local development, but you want them removed

## 🛠️ Step-by-Step Fix Instructions

### STEP 1: Create `.env` File (REQUIRED)

Create a `.env` file in the project root with the following variables:

```env
# Server Configuration
PORT=5000
NODE_ENV=development
TZ=UTC

# Database Configuration (PostgreSQL - based on Prisma schema)
DATABASE_URL=postgresql://user:password@localhost:5432/dbname
DB_NAME=your_database_name
DB_HOST=localhost
DB_PORT=5432
DB_USER=your_db_user
DB_USER_PWD=your_db_password
DB_MIN_POOL_SIZE=5
DB_MAX_POOL_SIZE=10

# CORS Configuration
CORS_URL=http://localhost:3000

# JWT Token Configuration
ACCESS_TOKEN_VALIDITY_SEC=3600
REFRESH_TOKEN_VALIDITY_SEC=86400
TOKEN_ISSUER=your-app-name
TOKEN_AUDIENCE=your-app-name

# Logging
LOG_DIR=./logs

# Redis Configuration (if using Redis)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Cache Configuration
CONTENT_CACHE_DURATION_MILLIS=600000
```

**Important**: 
- Set `PORT=5000` to match your Postman request
- Update database credentials to match your local PostgreSQL setup
- Adjust other values as needed

### STEP 2: Verify Server Can Start

1. **Build the project**:
   ```bash
   npm run build
   ```

2. **Start the server**:
   ```bash
   npm start
   # OR for development with watch mode:
   npm run watch
   ```

3. **Check the console output**:
   - You should see: `server running on port : 5000`
   - If you see errors, note them down

### STEP 3: Remove Docker Files (Optional - As Requested)

Since you don't want Docker, you can remove these files:

1. **Delete Dockerfile**:
   ```bash
   rm Dockerfile
   ```

2. **Delete docker-compose.yml**:
   ```bash
   rm docker-compose.yml
   ```

3. **Delete .dockerignore** (if it exists):
   ```bash
   rm .dockerignore
   ```

4. **Update README.md** (optional):
   - Remove or comment out Docker-related instructions
   - Keep only the "Install Without Docker" section

### STEP 4: Fix Port Configuration in Code (If Needed)

If the server still doesn't start on the correct port, check:

1. **Verify `src/config.ts`**:
   ```typescript
   export const port = process.env.PORT;
   ```
   - This should read from `.env` file
   - Make sure `dotenv` is loading the `.env` file

2. **Check `package.json` scripts**:
   - `"serve": "node -r dotenv/config build/server.js"`
   - The `-r dotenv/config` flag should load your `.env` file

3. **Add fallback port** (optional safety measure):
   In `src/config.ts`, you could add:
   ```typescript
   export const port = process.env.PORT || '5000';
   ```
   But this is just a safety measure - the `.env` file should be the source of truth.

### STEP 5: Verify Database Connection

The server initializes the database in `src/app.ts`:
```typescript
import './database'; // initialize database
```

Make sure:
1. PostgreSQL is running locally
2. Database exists and matches your `DATABASE_URL`
3. Prisma client is generated: `npm run prisma:generate`
4. Run migrations if needed: `npx prisma migrate dev`

### STEP 6: Test the Connection

1. **Start the server**:
   ```bash
   npm start
   ```

2. **In Postman, test**:
   - URL: `http://localhost:5000/test`
   - Method: `GET`
   - Should return: `"Test route"`

## 🔍 Troubleshooting Checklist

If the server still doesn't connect:

- [ ] `.env` file exists in project root
- [ ] `PORT=5000` is set in `.env`
- [ ] Server process is running (check terminal output)
- [ ] No other process is using port 5000
- [ ] Database is running and accessible
- [ ] Prisma client is generated (`npm run prisma:generate`)
- [ ] TypeScript compilation succeeded (`npm run build`)
- [ ] Check server logs for errors
- [ ] Verify `dotenv` is loading `.env` correctly

## 📝 Files That Reference Docker (For Removal)

1. **Dockerfile** - Lines 1-23
2. **docker-compose.yml** - Entire file
3. **.dockerignore** - If exists
4. **README.md** - Lines 93-104 (Docker installation instructions)

## ⚠️ Important Notes

1. **Database**: The project uses Prisma with PostgreSQL. Make sure PostgreSQL is installed and running locally.

2. **Redis**: If you're using Redis caching, make sure Redis is running locally or remove Redis dependencies if not needed.

3. **Environment Variables**: The server **requires** a `.env` file. Without it, the server will fail to start properly.

4. **Port Conflicts**: Make sure port 5000 (or whatever port you choose) is not already in use:
   ```bash
   lsof -i :5000  # macOS/Linux
   netstat -ano | findstr :5000  # Windows
   ```

5. **Build Process**: Always run `npm run build` before `npm start` in production mode, or use `npm run watch` for development.

## 🎯 Quick Start (After Fixes)

1. Create `.env` file with `PORT=5000`
2. Install dependencies: `npm install`
3. Generate Prisma client: `npm run prisma:generate`
4. Start database (PostgreSQL)
5. Run migrations: `npx prisma migrate dev` (if needed)
6. Build: `npm run build`
7. Start: `npm start`
8. Test: `http://localhost:5000/test`

## 📚 Additional Resources

- Prisma Docs: https://www.prisma.io/docs
- Express.js Docs: https://expressjs.com/
- dotenv package: https://www.npmjs.com/package/dotenv

