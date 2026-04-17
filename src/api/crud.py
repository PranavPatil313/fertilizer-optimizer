# src/api/crud.py

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from src.db.session import AsyncSessionLocal
from src.db.models import User, Plot, Prediction, PlotWeather


# --------------------------
# SAVE PLOT
# --------------------------
async def save_plot(user_id: int, data: dict, name: str = None):
    async with AsyncSessionLocal() as session:
        plot = Plot(user_id=user_id, data=data, name=name)
        session.add(plot)
        await session.commit()
        await session.refresh(plot)
        return plot


# --------------------------
# SAVE PREDICTION
# --------------------------
async def save_prediction(plot_id: int, model_version: str, result: dict):
    async with AsyncSessionLocal() as session:
        pred = Prediction(
            plot_id=plot_id,
            model_version=model_version,
            result=result
        )
        session.add(pred)
        await session.commit()
        await session.refresh(pred)
        return pred


# --------------------------
# GET USER
# --------------------------
async def get_user_by_email(email: str):
    async with AsyncSessionLocal() as session:
        query = select(User).where(User.email == email)
        result = await session.execute(query)
        return result.scalar_one_or_none()


# --------------------------
# CREATE USER
# --------------------------
async def create_user(email: str, password_hash: str):
    async with AsyncSessionLocal() as session:
        user = User(email=email, hashed_password=password_hash)
        session.add(user)
        await session.commit()
        await session.refresh(user)
        return user
    

    # src/api/crud.py  (append these functions)

async def get_plots_for_user(user_id: int):
    async with AsyncSessionLocal() as session:
        query = select(Plot).where(Plot.user_id == user_id).order_by(Plot.created_at.desc())
        res = await session.execute(query)
        plots = res.scalars().all()
        # eager load predictions for each plot (simple second query)
        out = []
        for p in plots:
            q2 = select(Prediction).where(Prediction.plot_id == p.id).order_by(Prediction.created_at.desc())
            r2 = await session.execute(q2)
            preds = r2.scalars().all()
            out.append({
                "id": p.id,
                "name": p.name,
                "data": p.data,
                "created_at": p.created_at.isoformat() if p.created_at else None,
                "predictions": [
                    {
                        "id": pr.id,
                        "model_version": pr.model_version,
                        "result": pr.result,
                        "created_at": pr.created_at.isoformat() if pr.created_at else None
                    } for pr in preds
                ]
            })
        return out

async def get_predictions_for_user(user_id: int):
    async with AsyncSessionLocal() as session:
        # join via plots table
        query = (
            select(Prediction)
            .join(Plot, Prediction.plot_id == Plot.id)
            .where(Plot.user_id == user_id)
            .order_by(Prediction.created_at.desc())
        )
        res = await session.execute(query)
        preds = res.scalars().all()
        return [
            {
                "id": p.id,
                "plot_id": p.plot_id,
                "model_version": p.model_version,
                "result": p.result,
                "created_at": p.created_at.isoformat() if p.created_at else None
            } for p in preds
        ]


async def delete_plot_for_user(user_id: int, plot_id: int):
    async with AsyncSessionLocal() as session:
        query = select(Plot).where(Plot.id == plot_id, Plot.user_id == user_id)
        res = await session.execute(query)
        plot = res.scalar_one_or_none()
        if not plot:
            return False
        await session.execute(
            delete(Prediction).where(Prediction.plot_id == plot_id)
        )
        await session.execute(
            delete(PlotWeather).where(PlotWeather.plot_id == plot_id)
        )
        await session.delete(plot)
        await session.commit()
        return True


# --------------------------
# SAVE PLOT WEATHER SNAPSHOT
# --------------------------
async def save_plot_weather(plot_id: int, snapshot: dict, risk: dict):
    """
    Persist a compact weather snapshot linked to a plot.
    """
    current = snapshot.get("current") or {}
    forecast = snapshot.get("forecast_3d") or {}
    async with AsyncSessionLocal() as session:
        rec = PlotWeather(
            plot_id=plot_id,
            temp_avg_c=forecast.get("avgtemp_c"),
            rainfall_3d_mm=forecast.get("totalprecip_mm"),
            humidity=current.get("humidity"),
            wind_kph=current.get("wind_kph"),
            risk_summary=risk,
            raw_json=snapshot.get("raw"),
        )
        session.add(rec)
        await session.commit()
        await session.refresh(rec)
        return rec

