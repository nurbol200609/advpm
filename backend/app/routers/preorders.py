from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import PreOrder
from app.schemas import PreOrderRequest, PreOrderResponse
from app.utils import decode_token
import json

router = APIRouter(prefix="/api/preorders", tags=["preorders"])

def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="no token")
    token = authorization.split(" ")[1]
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="invalid token")
    return payload

@router.post("/", response_model=PreOrderResponse)
def create_order(data: PreOrderRequest, db: Session = Depends(get_db), user=Depends(get_current_user)):
    total = sum(item.price * item.quantity for item in data.items)
    items_json = json.dumps([i.model_dump() for i in data.items])

    order = PreOrder(
        user_id=user["sub"],
        items=items_json,
        total_price=total,
        pickup_time=data.pickup_time,
        status="pending"
    )
    db.add(order)
    db.commit()
    db.refresh(order)
    return order

@router.get("/my", response_model=list[PreOrderResponse])
def my_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    orders = db.query(PreOrder).filter(
        PreOrder.user_id == user["sub"]
    ).order_by(PreOrder.created_at.desc()).all()
    return orders

@router.patch("/{order_id}/status")
def update_status(order_id: str, status: str, db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user["role"] not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="no access")

    order = db.query(PreOrder).filter(PreOrder.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="not found")

    allowed = ["pending", "ready", "picked_up"]
    if status not in allowed:
        raise HTTPException(status_code=400, detail="wrong status")

    order.status = status
    db.commit()
    return {"msg": "updated", "status": status}

@router.get("/all")
def all_orders(db: Session = Depends(get_db), user=Depends(get_current_user)):
    if user["role"] not in ["staff", "admin"]:
        raise HTTPException(status_code=403, detail="no access")
    orders = db.query(PreOrder).order_by(PreOrder.created_at.desc()).all()
    return [{"id": o.id, "status": o.status, "total": o.total_price, "pickup": o.pickup_time} for o in orders]
