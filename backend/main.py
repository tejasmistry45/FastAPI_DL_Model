from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.responses import JSONResponse, HTMLResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import os
import shutil
from pathlib import Path
import tempfile
import uvicorn
from models.car_classifier import CarClassifier
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="Car Classification Full-Stack App", version="1.0.0")

# Serve static files (frontend)
app.mount("/static", StaticFiles(directory="static"), name='static')

# Add CORS middleware to allow frontend requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize model
MODEL_PATH = "./saved_models/car_classifier_20250731_210809.pth"
METADATA_PATH = "./saved_models/car_classifier_20250731_210809_metadata.json"

try:
    classifier = CarClassifier(MODEL_PATH, METADATA_PATH)
    print("Model Loaded Successfully")
except Exception as e:
    print(f"Error Loading Model: {e}")
    classifier = None

# Create uploads directory
UPLOAD_DIR = "uploads"
Path(UPLOAD_DIR).mkdir(exist_ok=True)

# ================== FRONTEND ROUTES ==================

@app.get("/", response_class=HTMLResponse)
async def serve_frontend():
    """Serve the main application page"""
    try: 
        html_path = Path("static/frontend/index.html")
        if html_path.exists():
            return FileResponse(html_path, media_type="text/html")
        else:
            return HTMLResponse(
                content="<h1>Frontend not found</h1><p>Please ensure index.html exists in the static directory.</p>", 
                status_code=404
            )
    except Exception as e:
        logger.error(f"Error serving frontend: {e}")
        return HTMLResponse(
            content=f"<h1>Error</h1><p>Failed to load frontend: {str(e)}</p>", 
            status_code=500
        )
    
# ================== API ROUTES ==================

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "model_loaded": classifier is not None,
        "supported_classes": classifier.classes if classifier else []
    }

@app.post("/api")
async def api_root():
    """API root endpoint"""
    return {"message": "Car Classification API is Running"}
    
@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "model_loaded": classifier is not None,
        "supported_classes": classifier.classes if classifier else []
    }

@app.post("/predict")
@app.post("/api/predict")
async def predict_image(file: UploadFile = File(...)):
    """
    Predict car class from uploaded image
    """

    if not classifier:
        raise HTTPException(status_code=500, detail="Model Not Loaded")
    
    # Validate file Type
    if not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File Must Be an Image.")
    
    # Save Uploaded file Temporarily
    tmp_file_path = None
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
            shutil.copyfileobj(file.file, tmp_file)
            tmp_file_path = tmp_file.name

        # Make Prediction
        prediction = classifier.predict(tmp_file_path)

        # Log the prediction
        logger.info(f"Prediction for {file.filename}: {prediction['predicted_class']}")

        return JSONResponse(content={
            "success": True,
            "filename": file.filename,
            "prediction": prediction
        })
    
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")
    
    finally:
        # Clean up temporary file
        if tmp_file_path and os.path.exists(tmp_file_path):
            try:
                os.unlink(tmp_file_path)
            except Exception as e:
                logger.warning(f"Failed to delete temporary file: {e}")

@app.get("/classes")
@app.get("/api/classes")
async def get_classes():
    """Get Available Classes"""
    if not classifier:
        raise HTTPException(status_code=500, detail="Model Not Loaded")
    
    return {
        "classes": classifier.classes,
        "total_classes": len(classifier.classes)
    }

# ================== ERROR HANDLERS ==================

@app.exception_handler(404)
async def not_found_handler(request: Request, exc: HTTPException):
    """Handle 404 errors - serve frontend for non-API routes"""
    if request.url.path.startswith("/api/"):
        return JSONResponse(
            status_code=404,
            content={"details": "API endPoint Not Found"}
        )
    else:
        # For non-API routes, serve the main app (SPA behavior)
        return await serve_frontend()
    
@app.on_event("startup")
async def startup_event():
    """Application startup"""
    logger.info("🚀 Car Classification App starting up...")
    logger.info(f"📁 Serving static files from: {Path('static').absolute()}")
    logger.info(f"🤖 Model status: {'✅ Loaded' if classifier else '❌ Not loaded'}")
    logger.info(f"🌐 Access the app at: http://localhost:8000")

# For production
PORT = int(os.getenv("PORT", 8000))

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=True)