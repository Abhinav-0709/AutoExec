import os
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()

api_key = os.environ.get("GOOGLE_API_KEY")
print(f"API Key found: {api_key is not None}")

try:
    genai.configure(api_key=api_key)
    model = genai.GenerativeModel('gemini-2.5-flash')
    print("Model initialized successfully")
except Exception as e:
    print(f"Error initializing Gemini: {e}")
