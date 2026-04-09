from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import bookings, timeslots

app = FastAPI(
    title="University Queue System API",
    description="API для управления предзаказами и очередями в университете",
    version="1.0.0-alpha"
)

# Настройка CORS для фронтенда
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры
app.include_router(bookings.router)
app.include_router(timeslots.router)

@app.get("/")
async def root():
    return {
        "message": "University Queue System API",
        "version": "1.0.0-alpha",
        "endpoints": {
            "timeslots": "/api/timeslots/available",
            "bookings": "/api/bookings/",
            "docs": "/docs"
        }
    }

@app.get("/health")
async def health_check():
    return {"status": "healthy"}