# model_utils.py
import os
import joblib
import numpy as np
import pandas as pd

ARTIFACT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "artifact"))
MODEL_PATH = os.path.join(ARTIFACT_DIR, "model.pkl")
PREPROC_PATH = os.path.join(ARTIFACT_DIR, "preprocessor.pkl")
META_PATH = os.path.join(ARTIFACT_DIR, "metadata.json")

# load once (module-level) to reuse
_model_bundle = None
_preprocessor = None
_metadata = None

def load_artifact():
    global _model_bundle, _preprocessor, _metadata
    if _model_bundle is None:
        _model_bundle = joblib.load(MODEL_PATH)
    if _preprocessor is None:
        _preprocessor = joblib.load(PREPROC_PATH)
    if _metadata is None:
        import json
        with open(META_PATH, "r") as f:
            _metadata = json.load(f)
    return {"model_bundle": _model_bundle, "preprocessor": _preprocessor, "metadata": _metadata}

def predict_from_input(input_dict):
    """
    input_dict should contain the features used in training.
    Returns dictionary of predictions for each target.
    """
    art = load_artifact()
    preproc = art["preprocessor"]
    models = art["model_bundle"]["models"]

    # ensure columns order
    features = art["metadata"]["features"]
    X_df = pd.DataFrame([input_dict])
    X_df = X_df[features]  # will raise if missing keys

    Xp = preproc.transform(X_df)
    out = {}
    for target, model in models.items():
        pred = model.predict(Xp)[0]
        out[target] = float(pred)
    return out


def refresh_artifact_cache():
    """
    Clear cached model/preprocessor so the next prediction loads latest artifacts.
    """
    global _model_bundle, _preprocessor, _metadata
    _model_bundle = None
    _preprocessor = None
    _metadata = None