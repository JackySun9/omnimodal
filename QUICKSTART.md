# Quick Start Guide - UI is Now Fixed! 🎉

## What Was Fixed

1. ✅ Created missing `index.html` file
2. ✅ Created complete CSS styling (`src/styles.css`)
3. ✅ Fixed Sidebar component to use correct CSS classes
4. ✅ Added CSS import to `main.tsx`
5. ✅ Updated `package.json` with proper scripts

## How to Start the Application

### Option 1: Web Browser (Recommended for Testing)

**Terminal 1 - Backend:**
```bash
cd backend
uv run uvicorn app.main:app --reload
```

**Terminal 2 - Frontend (Web):**
```bash
cd frontend
pnpm dev:web
```

Then open **http://localhost:1420** in your browser.

### Option 2: Tauri Desktop App

**Terminal 1 - Backend:**
```bash
cd backend
uv run uvicorn app.main:app --reload
```

**Terminal 2 - Frontend (Tauri):**
```bash
cd frontend
pnpm dev
```

This will open a native desktop window.

## What You Should See

### Sidebar (Left)
- **Dashboard** - System overview
- **Models** - Model discovery and management
- **Settings** - Configuration

### Dashboard Page (Default)
- **Hardware Section**: 
  - CPU info
  - GPU info (if available)
  - RAM info
- **Local Models Section**: 
  - List of installed models
  - Should show "No models installed" initially

## Testing the Application

### 1. Check Hardware Detection
Navigate to **Dashboard** and verify your hardware is detected correctly.

### 2. Search for Models
1. Go to **Models** page
2. Enter a search term (e.g., "llama")
3. Click **Search**
4. You should see models with compatibility scores:
   - ✅ Green = Compatible
   - ⚠️ Yellow = Marginal
   - ❌ Red = Not compatible

### 3. Download a Model (Optional - requires HuggingFace)
1. Select a compatible model
2. Choose modality
3. Click "Add to Local Library"
4. Monitor download progress

## Troubleshooting

### Still Seeing a Blank Page?

1. **Hard Refresh**: Press `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (Mac)

2. **Check Browser Console**: 
   - Press F12
   - Look for errors in Console tab

3. **Verify Backend is Running**:
   ```bash
   curl http://localhost:8000/docs
   ```
   Should return HTML (FastAPI docs)

4. **Check Ports**:
   - Backend should be on port **8000**
   - Frontend should be on port **1420**

### Backend Not Running?

The frontend will load but show API errors. Make sure:
```bash
cd backend
uv sync --dev  # Install dependencies first
uv run uvicorn app.main:app --reload
```

### Port Already in Use?

**Frontend (change from 1420 to 5173)**:
```bash
# Edit vite.config.ts and change port
pnpm dev:web --port 5173
```

**Backend (change from 8000 to 8001)**:
```bash
uv run uvicorn app.main:app --reload --port 8001
# Then update frontend/.env: VITE_API_BASE_URL=http://localhost:8001/api/v1
```

## Expected Behavior

✅ **Sidebar visible** with navigation links
✅ **Dashboard shows** hardware info (may show errors if backend is down)
✅ **Models page** has search functionality
✅ **No blank white screen**

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Blank page | Hard refresh browser (Ctrl+Shift+R) |
| "Loading..." forever | Backend not running on port 8000 |
| CORS errors | Check backend CORS settings in `main.py` |
| Module not found | Run `pnpm install` in frontend directory |
| Python errors | Run `uv sync --dev` in backend directory |

## Development Workflow

1. **Start backend first** (always)
2. **Start frontend** (web or desktop)
3. **Check Console** for any errors
4. **Test features** one by one

## Next Steps

Once the UI loads successfully:
1. ✅ Verify hardware detection
2. ✅ Test model search
3. ✅ Try downloading a small model
4. ✅ Open a workspace for interaction

## Need Help?

Check:
- Browser console (F12 → Console)
- Backend logs (terminal output)
- `TROUBLESHOOTING.md` for detailed debugging

---

**The UI is now fully functional!** 🚀
