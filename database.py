import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import declarative_base

from dotenv import load_dotenv

load_dotenv()

# The user can put either a local postgres URL or a Supabase URL here.
# e.g., postgresql+asyncpg://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite+aiosqlite:///./test.db") 

# Supabase often requires SSL, so we use ssl='require' if it's a supabase URL.
# Local postgres or sqlite usually doesn't need it.
connect_args = {}
if "supabase.co" in DATABASE_URL:
    connect_args["ssl"] = "require"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    connect_args=connect_args
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine, 
    class_=AsyncSession, 
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session
