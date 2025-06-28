from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from supabase import create_client
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

app = FastAPI()

# Allow frontend origin and local dev
origins = [
    "https://propnexus-platform.vercel.app",  # your live frontend
    "http://localhost:3000",                  # local development
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Connect to Supabase
SUPABASE_URL = os.getenv("https://wsfemkhxttddztnhthkc.supabase.co")
SUPABASE_KEY = os.getenv("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzZmVta2h4dHRkZHp0bmh0aGtjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDk1NzUwNCwiZXhwIjoyMDY2NTMzNTA0fQ.ZE0B_yJUFO88oZ4OU7SDLQ2WHXIEwWC7mbKHdMb6BW4")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

@app.get("/properties")
async def get_properties():
    response = supabase.table("properties").select("*").execute()
    return response.data
