from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import engine, Base
from app.routers import bookings, timeslots, auth, preorders

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="CampusFlow API",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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


from fastapi import Request
from sqlalchemy import text


@app.get("/debug")
def debug():
    results = {}

    # Тест БД
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        results["db_connection"] = "OK"
    except Exception as e:
        results["db_connection"] = f"FAIL: {str(e)}"

    # Тест таблицы users
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT COUNT(*) FROM users"))
        results["users_table"] = "OK"
    except Exception as e:
        results["users_table"] = f"FAIL: {str(e)}"

    # Тест argon2
    try:
        from app.utils import hash_password
        hash_password("test")
        results["argon2"] = "OK"
    except Exception as e:
        results["argon2"] = f"FAIL: {str(e)}"

    return results