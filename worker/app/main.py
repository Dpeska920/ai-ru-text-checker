from fastapi import FastAPI

from app.api import router
from app.core import settings

app = FastAPI(
    title="Red Pen Worker",
    description="Document parsing and diff generation service",
    version="0.1.0",
)

app.include_router(router)


@app.get("/health")
async def health_check():
    return {"status": "ok"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.host,
        port=settings.port,
        reload=settings.debug,
    )
