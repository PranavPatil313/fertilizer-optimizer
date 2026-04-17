# src/api/plots.py
from fastapi import APIRouter, Depends, HTTPException, status
from src.api.deps import get_current_user_token
from src.api.crud import get_plots_for_user, get_predictions_for_user, delete_plot_for_user

router = APIRouter(prefix="/api", tags=["plots"])

@router.get("/plots")
async def read_my_plots(current_user: dict = Depends(get_current_user_token)):
    user_id = current_user["user_id"]
    plots = await get_plots_for_user(user_id)
    return {"plots": plots}

@router.get("/predictions")
async def read_my_predictions(current_user: dict = Depends(get_current_user_token)):
    user_id = current_user["user_id"]
    preds = await get_predictions_for_user(user_id)
    return {"predictions": preds}


@router.delete("/plots/{plot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_my_plot(plot_id: int, current_user: dict = Depends(get_current_user_token)):
    user_id = current_user["user_id"]
    deleted = await delete_plot_for_user(user_id, plot_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Plot not found")
    return {"status": "deleted"}
