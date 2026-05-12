#!/usr/bin/env python3
"""
Database Seeding Script
Run this to populate your database with a demo user, realistic farms, and historical predictions.
Perfect for portfolio showcases and stakeholder demos.
"""

import asyncio
import random
from datetime import datetime, timedelta, timezone
from src.db.session import AsyncSessionLocal, engine
from src.db.models import User, Plot, Prediction, Base
from src.auth.utils import hash_password
from sqlalchemy import select

async def seed():
    print("🌱 Seeding database with realistic dummy data...")
    
    async with AsyncSessionLocal() as session:
        # 1. Create a Demo User
        email = "demo@agtech.com"
        q = await session.execute(select(User).where(User.email == email))
        user = q.scalars().first()
        
        if not user:
            user = User(
                email=email,
                hashed_password=hash_password("demo123"),
                role="user",
                is_active=True
            )
            session.add(user)
            await session.commit()
            await session.refresh(user)
            print(f"✅ Created demo user: {email} / Password: demo123")
        else:
            print(f"ℹ️ Demo user {email} already exists.")

        # 2. Create Dummy Plots (Farms)
        regions = ["Kolhapur", "Pune", "Sangli", "Satara", "Solapur"]
        crops = ["Sugarcane", "Wheat", "Maize", "Cotton", "Soybean"]
        
        plots_data = []
        for i in range(5):
            crop = random.choice(crops)
            region = random.choice(regions)
            plot = Plot(
                user_id=user.id,
                name=f"Field {chr(65+i)} - {crop}",
                data={
                    "crop_type": crop,
                    "soil_type": "Black",
                    "region": region,
                    "avg_temp": round(random.uniform(22.0, 32.0), 1),
                    "rainfall_mm": random.randint(400, 1200),
                    "crop_duration_days": 120,
                    "soil_N": random.randint(20, 80),
                    "soil_P": random.randint(10, 50),
                    "soil_K": random.randint(100, 250),
                    "pH": round(random.uniform(5.5, 8.0), 1),
                    "organic_matter_pct": round(random.uniform(1.0, 3.5), 1),
                    "irrigation_type": "irrigated",
                    "area_acre": round(random.uniform(2.0, 15.0), 1)
                }
            )
            session.add(plot)
            plots_data.append(plot)
            
        await session.commit()
        for p in plots_data:
            await session.refresh(p)
        print(f"✅ Created {len(plots_data)} farm plots.")

        # 3. Create Historical Predictions (to populate the Trend Chart)
        print("📊 Generating historical prediction trends...")
        now = datetime.now(timezone.utc)
        
        for plot in plots_data:
            # Create 3-5 historical predictions per plot spanning the last 6 months
            num_preds = random.randint(3, 5)
            
            for j in range(num_preds):
                days_ago = (num_preds - j) * 30 + random.randint(-5, 5)
                pred_date = now - timedelta(days=days_ago)
                
                # Simulate improving yields and decreasing carbon footprint over time
                base_yield = random.randint(4000, 8000)
                yield_val = base_yield + (j * 200) # Yield goes up over time
                actual_yield = yield_val + random.randint(-300, 300) if j < num_preds - 1 else None
                
                carbon_val = 1200.0 - (j * 50.0) # Carbon goes down over time
                
                pred = Prediction(
                    plot_id=plot.id,
                    model_version="v1.0",
                    result={
                        "predictions": {
                            "N_kg_ha": round(random.uniform(80, 150), 1),
                            "P_kg_ha": round(random.uniform(30, 70), 1),
                            "K_kg_ha": round(random.uniform(40, 100), 1),
                            "yield_kg_ha": yield_val
                        },
                        "carbon_kg_ha": carbon_val,
                        "feedback": {"actual_yield_kg_ha": actual_yield} if actual_yield else {},
                        "insights": ["Soil pH is optimal.", "Consider split application for nitrogen."]
                    }
                )
                # Override the creation date to simulate history
                pred.created_at = pred_date
                session.add(pred)
                
        await session.commit()
        print("✅ Added historical predictions and harvest feedback.")
        print("\n🎉 Database Seeded Successfully! You can now log in with demo@agtech.com")

if __name__ == "__main__":
    # Handle Windows async loop policy if needed
    import sys
    if sys.platform.startswith("win"):
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(seed())