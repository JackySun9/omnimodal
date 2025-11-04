# Frontend Troubleshooting Guide

## Issue: Blank UI

If you're seeing a blank screen, here are the fixes applied:

### 1. **Missing HTML file** ✅ FIXED
Created `index.html` in the frontend root directory.

### 2. **Missing CSS** ✅ FIXED
Created `src/styles.css` with complete styling for the application.

### 3. **CSS import missing** ✅ FIXED
Updated `src/main.tsx` to import the styles.

### 4. **Sidebar class names fixed** ✅ FIXED
Updated Sidebar component to use correct CSS class names.

## How to Start the Application

### Backend (Terminal 1)
```bash
cd backend
uv sync --dev
uv run uvicorn app.main:app --reload
```

The backend should start on `http://localhost:8000`

### Frontend (Terminal 2)
```bash
cd frontend
pnpm install
pnpm dev
```

The frontend will start on `http://localhost:1420`

## Common Issues

### 1. **Backend not running**
If the backend is not running, the frontend will load but show API errors in the Dashboard.

**Solution**: Make sure the backend is running on port 8000.

### 2. **Port conflicts**
If port 1420 or 8000 is already in use:

**Solution**: Kill the process using that port or change the port in `vite.config.ts` (frontend) or when starting uvicorn (backend).

### 3. **Dependencies not installed**

**Backend**:
```bash
cd backend
uv sync --dev
```

**Frontend**:
```bash
cd frontend
pnpm install
```

### 4. **Browser cache**
If you still see a blank page after the fixes:

**Solution**: 
- Hard refresh: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)
- Clear browser cache
- Try incognito/private window

### 5. **Check browser console**
Open Developer Tools (F12) and check the Console tab for any error messages.

## Verification Steps

1. **Backend health check**:
   ```bash
   curl http://localhost:8000/docs
   ```
   Should return the FastAPI Swagger UI HTML.

2. **Frontend is serving**:
   Open `http://localhost:1420` in your browser.

3. **API connectivity**:
   Check browser Network tab to see if API calls to `http://localhost:8000/api/v1/*` are successful.

## Expected UI

You should see:
- Left sidebar with navigation (Dashboard, Models, Settings)
- Main content area with:
  - **Dashboard**: Hardware profile and local models list
  - **Models**: Model discovery and download interface
  - **Settings**: Configuration options

## Next Steps

Once the UI loads:

1. **Check Hardware**: Dashboard page should show your CPU, GPU, and RAM
2. **Browse Models**: Go to Models page and search HuggingFace
3. **Download a Model**: Select a model and download it
4. **Open Workspace**: Once downloaded, open a model to interact with it

## Still Having Issues?

Check:
1. Node.js version: `node --version` (should be 20+)
2. pnpm version: `pnpm --version`
3. Python version: `python --version` (should be 3.11+)
4. Browser console for JavaScript errors
5. Backend logs for any errors

If the issue persists, restart both backend and frontend:
```bash
# Kill both processes (Ctrl+C)
# Restart backend
cd backend && uv run uvicorn app.main:app --reload

# In another terminal, restart frontend
cd frontend && pnpm dev
```
