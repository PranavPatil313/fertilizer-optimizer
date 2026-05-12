import os
import logging

logger = logging.getLogger(__name__)

async def generate_agronomic_insights(plot_data, predictions, weather_risk=None):
    """
    Generates natural language insights asynchronously using Google Gemini.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            logger.warning("GEMINI_API_KEY not set. Falling back to default insights.")
            return []  # Return empty list; allows rule-based insights to still be shown

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert agronomist. Given the following plot data, machine learning predictions, and weather risk, 
        provide 3 brief, actionable insights for the farmer. Keep them concise.
        
        Plot Data:
        Crop: {plot_data.get('crop_type', 'Unknown')}
        Soil Type: {plot_data.get('soil_type', 'Unknown')}
        Region: {plot_data.get('region', 'Unknown')}
        
        Predictions:
        N Needed: {predictions.get('N_kg_ha', 0)} kg/ha
        P Needed: {predictions.get('P_kg_ha', 0)} kg/ha
        K Needed: {predictions.get('K_kg_ha', 0)} kg/ha
        Expected Yield: {predictions.get('yield_kg_ha', 0)} kg/ha
        
        Weather Risk:
        {weather_risk.get('weather_risk_band', 'None') if weather_risk else 'None'}
        
        Provide the insights as a plain text list with each point starting with a dash (-).
        """
        
        response = await model.generate_content_async(prompt)
        insights = [line.strip('- *').strip() for line in response.text.split('\n') if line.strip()]
        return insights[:3]
        
    except Exception as e:
        logger.error(f"Failed to generate LLM insights: {e}")
        return []  # Return empty list on error