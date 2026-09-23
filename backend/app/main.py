from fastapi import FastAPI, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from .database import Base, engine, get_db
from .models import Expense
from .schemas import ExpenseCreate, ExpenseRead

Base.metadata.create_all(bind=engine)

app = FastAPI(title="Expense Tracker API", version="1.0.0")

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/expenses", response_model=list[ExpenseRead])
def list_expenses(db: Session = Depends(get_db)):
    expenses = db.scalars(select(Expense).order_by(Expense.date.desc())).all()
    return expenses

@app.post("/api/expenses", response_model=ExpenseRead, status_code=201)
def create_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    new_expense = Expense(**expense.model_dump())
    db.add(new_expense)
    db.commit()
    db.refresh(new_expense)
    return new_expense