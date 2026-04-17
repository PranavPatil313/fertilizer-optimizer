# tests/test_api_plots.py
import asyncio
import os
import pytest
from httpx import AsyncClient
from src.api.main import app
from src.db.session import AsyncSessionLocal
from src.db.models import User, Plot, Prediction
from src.auth.jwt import create_access_token

@pytest.mark.asyncio
async def test_plots_endpoint_roundtrip():
    # create a temporary user in DB
    async with AsyncSessionLocal() as session:
        user = User(email="test_user_for_tests@example.com", hashed_password="fakehash", is_active=1)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        user_id = user.id

        # create a plot
        plot = Plot(user_id=user_id, name="test-plot", data={"crop_type":"wheat"})
        session.add(plot)
        await session.commit()
        await session.refresh(plot)

        # create a prediction linked to that plot
        pred = Prediction(plot_id=plot.id, model_version="vtest", result={"N_kg_ha":10.0, "yield_kg_ha":100})
        session.add(pred)
        await session.commit()
        await session.refresh(pred)

    # create token for user
    token = create_access_token({"sub": str(user.email), "user_id": user.id})

    async with AsyncClient(app=app, base_url="http://testserver") as client:
        headers = {"Authorization": f"Bearer {token}"}
        r = await client.get("/api/plots", headers=headers)
        assert r.status_code == 200
        data = r.json()
        assert "plots" in data
        assert any(p["id"] == plot.id for p in data["plots"])
        # cleanup: optional - leaving test objects is ok for dev DB, but ideally drop them
