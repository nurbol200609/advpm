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