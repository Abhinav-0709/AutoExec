import sqlite3

def migrate_db():
    try:
        conn = sqlite3.connect('test.db')
        cursor = conn.cursor()
        
        print("Starting migration...")
        
        # Add 'confidence' column
        try:
            cursor.execute("ALTER TABLE tasks ADD COLUMN confidence VARCHAR;")
            print("Added 'confidence' column to 'tasks'.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("'confidence' column already exists.")
            else:
                raise e
        
        # Add 'reason' column
        try:
            cursor.execute("ALTER TABLE tasks ADD COLUMN reason TEXT;")
            print("Added 'reason' column to 'tasks'.")
        except sqlite3.OperationalError as e:
            if "duplicate column name" in str(e).lower():
                print("'reason' column already exists.")
            else:
                raise e
        
        conn.commit()
        conn.close()
        print("Migration complete.")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    migrate_db()
