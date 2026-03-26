import os
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_groq import ChatGroq
from dotenv import load_dotenv

load_dotenv()

def get_llm():
    if os.getenv("GOOGLE_API_KEY"):
        return ChatGoogleGenerativeAI(model="gemini-2.5-flash", temperature=0.2)
    elif os.getenv("GROQ_API_KEY"):
        return ChatGroq(model_name="llama3-8b-8192", temperature=0.2)
    else:
        raise ValueError("Neither GOOGLE_API_KEY nor GROQ_API_KEY is set in the environment.")
