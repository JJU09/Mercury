from fastapi import APIRouter, UploadFile, File, HTTPException
import httpx
import base64
import os
from app.config import get_logger

logger = get_logger(__name__)

router = APIRouter()

@router.post("/upload")
async def upload_image(file: UploadFile = File(...)):
    imgbb_api_key = os.getenv("IMGBB_API_KEY")
    if not imgbb_api_key:
        raise HTTPException(status_code=500, detail="IMGBB_API_KEY is not configured")

    try:
        content = await file.read()
        encoded_image = base64.b64encode(content).decode("utf-8")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                "https://api.imgbb.com/1/upload",
                data={
                    "key": imgbb_api_key,
                    "image": encoded_image
                }
            )
            response.raise_for_status()
            data = response.json()
            if data.get("success"):
                return {"url": data["data"]["url"]}
            else:
                raise HTTPException(status_code=500, detail="ImgBB upload failed")
    except Exception as e:
        import traceback
        logger.error(f"Image upload error: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Image upload failed: {str(e)}")
