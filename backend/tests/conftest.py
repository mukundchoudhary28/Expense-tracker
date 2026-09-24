import os

os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+psycopg://app:app@127.0.0.1:5432/expenses_test?connect_timeout=5",
)

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.database import engine
from app.main import app


@pytest.fixture(autouse=True)
def clean_db():
    """Empty the table before each test so testst never affect each other."""
    with engine.begin() as conn:
        conn.execute(text("TRUNCATE TABLE expenses RESTART IDENTITY CASCADE;"))
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c
