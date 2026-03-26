import sqlite3

def check_schema():
    try:
        conn = sqlite3.connect('test.db')
        cursor = conn.cursor()
        
        # Check tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
        tables = cursor.fetchall()
        print("Tables in test.db:", tables)
        
        for table in tables:
            print(f"\nSchema for {table[0]}:")
            cursor.execute(f"PRAGMA table_info({table[0]});")
            for col in cursor.fetchall():
                print(col)
        
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_schema()
