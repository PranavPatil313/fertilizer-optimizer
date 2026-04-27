import sqlite3
import sys

def main():
    conn = sqlite3.connect('fertilizer.db')
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT * FROM training_jobs')
        rows = cursor.fetchall()
        if rows:
            print(f"Found {len(rows)} training jobs:")
            for row in rows:
                print(row)
        else:
            print("No training jobs found.")
    except sqlite3.OperationalError as e:
        print(f"Table training_jobs may not exist: {e}")
        # list all tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        print("Existing tables:", tables)
    conn.close()

if __name__ == '__main__':
    main()