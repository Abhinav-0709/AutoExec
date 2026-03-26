import asyncio
from database import engine, Base
import models # Ensure tables are imported before creating

async def init_db():
    async with engine.begin() as conn:
        # Create all tables. In production use Alembic.
        await conn.run_sync(Base.metadata.create_all)
    print("Database tables created.")

if __name__ == "__main__":
    asyncio.run(init_db())
