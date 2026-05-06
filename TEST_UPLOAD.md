# Testing Upload Endpoint - Step by Step Guide

## Step 1: Verify Server is Running

1. Start the server:
   ```bash
   cd backend
   npm start
   ```

2. Check server startup logs:
   - Look for: `🚀 SERVER STARTED SUCCESSFULLY`
   - Look for: `✅ Upload route: POST /api/upload-resume`
   - If you see `❌ MISSING: POST /api/upload-resume`, the route is NOT registered!

## Step 2: Test Health Endpoint

Open in browser: `http://localhost:4000/api/health`

Should return:
```json
{
  "status": "ok",
  "message": "Server is running",
  "timestamp": "..."
}
```

## Step 3: List All Routes

Open in browser: `http://localhost:4000/api/routes`

Should show all registered routes including `POST /api/upload-resume`

## Step 4: Test Upload Route Registration

Open in browser: `http://localhost:4000/api/test-upload-route`

Should return:
```json
{
  "message": "Upload route is registered",
  "endpoint": "POST /api/upload-resume",
  "multer": "configured"
}
```

## Step 5: Test File Upload

1. Open frontend: `http://localhost:3000`
2. Click "Upload Resume PDF"
3. Select a PDF file
4. Check backend console for:
   - `📤 ===== UPLOAD REQUEST RECEIVED =====`
   - `📄 Processing uploaded file...`
   - `✅ Upload response prepared`

## Troubleshooting

### If you get 404:

1. **Check server logs** - Do you see the route in startup?
2. **Restart server** - Routes are registered at startup
3. **Check URL** - Make sure frontend uses `http://localhost:4000`
4. **Check browser console** - Look for CORS errors
5. **Check network tab** - See the actual request URL

### If route is not registered:

1. Check for syntax errors: `node --check backend/server.js`
2. Check server logs for errors on startup
3. Verify the route code is correct in `server.js`
4. Make sure `app.post("/api/upload-resume", ...)` is defined BEFORE the 404 handler

## Quick Test Commands

```bash
# Test health
curl http://localhost:4000/api/health

# List routes
curl http://localhost:4000/api/routes

# Test upload route
curl http://localhost:4000/api/test-upload-route
```

