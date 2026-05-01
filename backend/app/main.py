from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer
from app.database import engine, Base
from app.routers import bookings, timeslots, auth, preorders

# Создаём таблицы в БД
Base.metadata.create_all(bind=engine)

# Определяем FastAPI приложение ОДИН РАЗ
app = FastAPI(
    title="CampusFlow API",
    version="1.0.0",
    swagger_ui_init_oauth={
        "usePkceWithAuthorizationCodeGrant": True,
    }
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Схема безопасности для Swagger
security = HTTPBearer()

# Функция для добавления security схемы в OpenAPI
def add_security_schema():
    if app.openapi_schema:
        return app.openapi_schema

    openapi_schema = app.openapi()
    openapi_schema["components"]["securitySchemes"] = {
        "BearerAuth": {
            "type": "http",
            "scheme": "bearer",
            "bearerFormat": "JWT"
        }
    }

    # Добавляем security ко всем защищённым эндпоинтам
    for path in openapi_schema["paths"]:
        for method in openapi_schema["paths"][path]:
            if not path.startswith("/api/auth"):
                openapi_schema["paths"][path][method]["security"] = [{"BearerAuth": []}]

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = add_security_schema

# Подключаем роутеры
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