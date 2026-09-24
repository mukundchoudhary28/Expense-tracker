def make_expense(**overrides):
    data = {
        "description": "Lunch",
        "amount": "250.00",
        "category": "Food",
        "date": "2026-09-20",
    }
    data.update(overrides)
    return data


def test_health(client):
    res = client.get("/api/health")
    assert res.status_code == 200
    assert res.json() == {"status": "ok"}


def test_create_expense(client):
    res = client.post("/api/expenses", json=make_expense())
    assert res.status_code == 201
    body = res.json()
    assert body["id"] == 1
    assert body["description"] == "Lunch"
    assert body["amount"] == "250.00"


def test_list_starts_empty(client):
    res = client.get("/api/expenses")
    assert res.status_code == 200
    assert res.json() == []


def test_list_returns_newest_first(client):
    client.post(
        "/api/expenses", json=make_expense(description="Old", date="2026-01-01")
    )
    client.post(
        "/api/expenses", json=make_expense(description="New", date="2026-09-01")
    )

    descriptions = [e["description"] for e in client.get("/api/expenses").json()]
    assert descriptions == ["New", "Old"]


def test_amount_keeps_two_decimal_places(client):
    res = client.post("/api/expenses", json=make_expense(amount="10.5"))
    assert res.json()["amount"] == "10.50"


def test_rejects_negative_amount(client):
    res = client.post("/api/expenses", json=make_expense(amount="-5"))
    assert res.status_code == 422


def test_rejects_zero_amount(client):
    res = client.post("/api/expenses", json=make_expense(amount="0"))
    assert res.status_code == 422


def test_rejects_empty_description(client):
    res = client.post("/api/expenses", json=make_expense(description=""))
    assert res.status_code == 422


def test_rejects_invalid_date(client):
    res = client.post("/api/expenses", json=make_expense(date="not-a-date"))
    assert res.status_code == 422


def test_rejects_missing_date(client):
    data = make_expense()
    del data["date"]
    res = client.post("/api/expenses", json=data)
    assert res.status_code == 422
