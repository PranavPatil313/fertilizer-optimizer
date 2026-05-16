import os
import logging
import json

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

async def explain_prediction(plot_data, predictions):
    """
    Provides an Explainable AI (XAI) summary of why the ML model made specific predictions.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini API key is not configured. Explanation unavailable."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert Explainable AI (XAI) assistant for an agronomy machine learning platform.
        Your job is to explain WHY the model made these specific predictions based on the input data.
        Explain it in simple, easy-to-understand terms for a farmer or local agronomist.

        Input Plot Data: {plot_data}
        Model Predictions: {predictions}

        Highlight the key driving factors (e.g., "The model recommended high Nitrogen because your soil N is very low (15 ppm)").
        Keep the explanation concise, professional, and under 3 short paragraphs.
        """
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Failed to generate explanation: {e}")
        return "An error occurred while generating the explanation. Please try again later."

async def chat_with_agronomist(message, plot_context=None, history=None):
    """
    Maintains a continuous chat session with Gemini acting as an Agronomist.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini API key is not configured. Chat unavailable."

        genai.configure(api_key=api_key)
        
        sys_instruct = "You are a helpful, expert agronomist AI assistant."
        settings_path = os.path.join(os.path.dirname(__file__), "..", "data", "settings.json")
        try:
            if os.path.exists(settings_path):
                with open(settings_path, "r") as f:
                    settings = json.load(f)
                    sys_instruct = settings.get("chat_prompt", sys_instruct)
        except Exception as e:
            logger.warning(f"Could not load custom prompt: {e}")
            
        if plot_context:
            sys_instruct += f" You are currently helping a farmer with this plot context: {plot_context}."
            
        model = genai.GenerativeModel('gemini-1.5-flash', system_instruction=sys_instruct)
        
        formatted_history = []
        if history:
            for msg in history:
                # Map roles correctly to Gemini's expected 'user' or 'model'
                role = "model" if msg.get("role") in ["model", "assistant"] else "user"
                content = msg.get("content", "")
                
                # Gemini requires strictly alternating roles (user -> model -> user). 
                # We merge consecutive identical roles to prevent the 400 InvalidArgument error.
                if formatted_history and formatted_history[-1]["role"] == role:
                    formatted_history[-1]["parts"][0] += f"\n\n{content}"
                else:
                    formatted_history.append({"role": role, "parts": [content]})
        
        # If the history ends with a 'user' message, sending a new 'user' message via send_message_async 
        # will cause consecutive 'user' roles and crash. Extract it and merge with the current message.
        if formatted_history and formatted_history[-1]["role"] == "user":
            last_user_msg = formatted_history.pop()
            if last_user_msg["parts"][0].strip() != message.strip():
                message = last_user_msg["parts"][0] + "\n\n" + message
        
        chat = model.start_chat(history=formatted_history)
        
        # Lower safety thresholds to prevent false positives when discussing crop chemicals
        safety_settings = [
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_ONLY_HIGH"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_ONLY_HIGH"}
        ]
        
        response = await chat.send_message_async(message, safety_settings=safety_settings)
        
        try:
            return response.text
        except ValueError:
            return "I couldn't generate a response due to AI safety filters. Please try rephrasing."
            
    except Exception as e:
        logger.error(f"Failed to chat with agronomist: {e}")
        
        # Return the actual error message dynamically so users know if it's an API Key or Quota issue
        error_str = str(e).lower()
        if "api_key" in error_str or "403" in error_str:
            return "There is an issue with the Gemini API Key configuration. Please check your settings."
        elif "429" in error_str or "quota" in error_str:
            return "The AI quota has been exceeded. Please try again later."
            
        return f"I'm having trouble connecting right now ({str(e)}). Please try again."

async def analyze_crop_image(image_bytes: bytes, mime_type: str, plot_data: dict):
    """
    Analyzes an uploaded crop image for diseases, pests, or nutrient deficiencies
    using Gemini Vision capabilities.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini API key is not configured. Vision analysis unavailable."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert plant pathologist and agronomist. 
        Analyze this crop image.
        
        Consider the farmer's soil and plot data: {plot_data}
        
        Is this a disease, pest, or nutrient deficiency? 
        What is your diagnosis and what remedy do you suggest?
        Provide a concise, easy-to-understand response for a farmer.
        """
        
        response = await model.generate_content_async([
            prompt,
            {"mime_type": mime_type, "data": image_bytes}
        ])
        return response.text
    except Exception as e:
        logger.error(f"Failed to analyze image: {e}")
        return "An error occurred while analyzing the image. Please try again later."

async def analyze_roi(plot_data: dict, predictions: dict, blend: dict):
    """
    Provides an economic analysis (ROI) based on the crop, yield prediction, and fertilizer blend.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini API key is not configured. ROI analysis unavailable."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert agricultural economist. Calculate a rough Return on Investment (ROI) estimate for this farm.
        Use approximate current market prices in India (INR) for the crop and fertilizers. 
        
        Input Plot Data: {plot_data}
        Model Predictions: {predictions}
        Fertilizer Blend: {blend}

        Provide:
        1. Estimated Gross Revenue (based on expected yield).
        2. Estimated Fertilizer Cost.
        3. Projected Profit Margin.
        4. One actionable tip for cost optimization.
        """
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Failed to generate ROI analysis: {e}")
        return "An error occurred while generating the ROI analysis. Please try again later."

async def generate_sms_summary(plot_data: dict, blend: dict, language: str = "Marathi"):
    """
    Translates complex agronomy plans into highly localized, simplified SMS/WhatsApp messages.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return f"Gemini API key is not configured. {language} SMS unavailable."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an agricultural extension officer. Translate this agronomy plan into colloquial {language} suitable for a local farmer via SMS or WhatsApp.
        Focus ONLY on what fertilizers they need to buy and when to apply them. 
        Keep it very simple, short, encouraging, and use bullet points or emojis. 
        Do not include complex metrics like CO2eq or organic matter %.

        Plot Context: Crop: {plot_data.get('crop_type')}, Area: {plot_data.get('area_acre')} acres.
        Recommended Fertilizer Blend: {blend}
        """
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Failed to generate SMS summary: {e}")
        return f"An error occurred while generating the {language} SMS. Please try again."

async def generate_organic_plan(plot_data: dict, current_plan: dict):
    """
    Generates a 3-Year step-down plan to transition the farm to 100% organic/regenerative agriculture.
    """
    try:
        import google.generativeai as genai
        
        api_key = os.getenv("GEMINI_API_KEY")
        if not api_key:
            return "Gemini API key is not configured. Organic transition planner unavailable."

        genai.configure(api_key=api_key)
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
        You are an expert regenerative agriculture planner. Generate a step-by-step, 3-year roadmap 
        for this farm to transition from synthetic fertilizers to 100% organic/regenerative agriculture 
        without crashing their crop yields.

        Plot Data: {plot_data}
        Current Synthetic Plan: {current_plan}

        Include: Year 1 (Reduction & Soil Prep), Year 2 (Biological Transition), Year 3 (Full Organic).
        Be practical, mention specific cover crops or bio-fertilizers applicable to their crop type.
        """
        response = await model.generate_content_async(prompt)
        return response.text
    except Exception as e:
        logger.error(f"Failed to generate organic plan: {e}")
        return "An error occurred while generating the organic transition plan."