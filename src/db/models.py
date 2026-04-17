# src/db/models.py
from sqlalchemy import Integer, String, Column, JSON, Float, DateTime, ForeignKey, func, Text
from sqlalchemy.orm import declarative_base, relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_active = Column(Integer, default=1)
    role = Column(String, default="user")

class Plot(Base):
    __tablename__ = "plots"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=True)
    data = Column(JSON, nullable=False)   # raw input
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User")

class Prediction(Base):
    __tablename__ = "predictions"
    id = Column(Integer, primary_key=True, index=True)
    plot_id = Column(Integer, ForeignKey("plots.id"))
    model_version = Column(String, nullable=False)
    result = Column(JSON, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    plot = relationship("Plot")


class Dataset(Base):
    __tablename__ = "datasets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    original_filename = Column(String, nullable=False)
    storage_path = Column(String, nullable=False)
    processed_path = Column(String, nullable=True)
    status = Column(String, default="uploaded")
    filesize_bytes = Column(Integer, nullable=False)
    row_count = Column(Integer, nullable=True)
    column_count = Column(Integer, nullable=True)
    processing_log = Column(Text, nullable=True)
    uploaded_by = Column(Integer, ForeignKey("users.id"))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    user = relationship("User")


class TrainingJob(Base):
    __tablename__ = "training_jobs"
    id = Column(Integer, primary_key=True, index=True)
    model_name = Column(String, nullable=False)
    dataset_ids = Column(JSON, nullable=False)  # store list of dataset IDs
    status = Column(String, default="pending")
    triggered_by = Column(Integer, ForeignKey("users.id"))
    log = Column(Text, nullable=True)
    artifact_path = Column(String, nullable=True)
    started_at = Column(DateTime(timezone=True), nullable=True)
    finished_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    user = relationship("User")


class PlotWeather(Base):
    __tablename__ = "plot_weather"
    id = Column(Integer, primary_key=True, index=True)
    plot_id = Column(Integer, ForeignKey("plots.id"), index=True, nullable=False)
    temp_avg_c = Column(Float, nullable=True)
    rainfall_3d_mm = Column(Float, nullable=True)
    humidity = Column(Float, nullable=True)
    wind_kph = Column(Float, nullable=True)
    risk_summary = Column(JSON, nullable=True)  # nitrogen risk, weather risk score, etc.
    raw_json = Column(JSON, nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    plot = relationship("Plot")
