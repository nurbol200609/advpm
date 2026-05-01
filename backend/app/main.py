from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import bookings, timeslots, auth, preorders

# Создаём таблицы в БД
Base.metadata.create_all(bind=engine)

# Определяем FastAPI приложение
app = FastAPI(
    title="CampusFlow API",
    version="1.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Подключаем роутеры (ВАЖНО: до настройки OpenAPI)
app.include_router(auth.router)
app.include_router(timeslots.router)
app.include_router(bookings.router)
app.include_router(preorders.router)


@app.get("/")
def root():
    return {"msg": "CampusFlow API is running"}


@app.get("/health")
def health():
    return {"status": "ok"}


# Настройка Swagger UI с авторизацией (после всех роутеров)
def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = app.openapi()

    # Добавляем схему безопасности
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }

    # Добавляем security ко всем эндпоинтам, кроме auth
    for path in openapi_schema["paths"]:
        for method in openapi_schema["paths"][path]:
            if not path.startswith("/api/auth"):
                openapi_schema["paths"][path][method]["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema


app.openapi = custom_openapi