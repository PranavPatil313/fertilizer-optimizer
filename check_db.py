#!/usr/bin/env python3
import sqlite3
import sys

def main():
    db_path = "fertilizer.db"
    
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # List tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
        tables = cursor.fetchall()
        
        if not tables:
            print("No tables found in database!")
            return
        
        print("Tables in database:")
        for table in tables:
            print(f"  - {table[0]}")
        
        # Check for users table
        users_table = None
        for table in tables:
            if table[0].lower() == 'users':
                users_table = table[0]
                break
        
        if not users_table:
            print("\nNo 'users' table found!")
            # Check for any user-related table
            for table in tables:
                if 'user' in table[0].lower():
                    print(f"Found similar table: {table[0]}")
                    users_table = table[0]
                    break
        
        if users_table:
            print(f"\nExamining '{users_table}' table:")
            
            # Get table structure
            cursor.execute(f"PRAGMA table_info({users_table})")
            columns = cursor.fetchall()
            print("Columns:")
            for col in columns:
                col_id, col_name, col_type, not_null, default_val, pk = col
                print(f"  {col_name} ({col_type}) {'PK' if pk else ''}")
            
            # Get sample data
            cursor.execute(f"SELECT * FROM {users_table} LIMIT 5")
            rows = cursor.fetchall()
            print(f"\nSample data ({len(rows)} rows):")
            for row in rows:
                print(f"  {row}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"SQLite error: {e}")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()