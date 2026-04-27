import sqlite3
import sys

def main():
    db_path = "fertilizer.db"
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    # List tables
    c.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
    tables = c.fetchall()
    print("Tables:")
    for table in tables:
        print(f"  {table[0]}")
    
    # Check each table
    for table in tables:
        table_name = table[0]
        c.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = c.fetchone()[0]
        print(f"\n{table_name}: {count} rows")
        if count > 0:
            c.execute(f"SELECT * FROM {table_name} LIMIT 3")
            rows = c.fetchall()
            for row in rows:
                print(f"  {row}")
    
    conn.close()

if __name__ == "__main__":
    main()