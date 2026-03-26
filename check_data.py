import sqlite3

def check_data():
    try:
        conn = sqlite3.connect('test.db')
        cursor = conn.cursor()
        
        print("--- Workflows ---")
        cursor.execute("SELECT id, status FROM workflows;")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- Tasks (counts per workflow) ---")
        cursor.execute("SELECT workflow_id, COUNT(*) FROM tasks GROUP BY workflow_id;")
        for row in cursor.fetchall():
            print(row)
            
        print("\n--- Logs (counts per workflow) ---")
        cursor.execute("SELECT workflow_id, COUNT(*) FROM logs GROUP BY workflow_id;")
        for row in cursor.fetchall():
            print(row)
            
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    check_data()
