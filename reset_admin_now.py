#!/usr/bin/env python3
"""
Non-interactive admin password reset.
Generates a random password and updates the SQLite database.
"""

import os
import sys
import sqlite3
import secrets
import string
from pathlib import Path

def main():
    print("="*60)
    print("Fertilizer Optimizer - Admin Password Reset (Auto)")
    print("="*60)
    
    # Get admin email
    env_path = Path(".env")
    admin_email = "pranavpatil6717@gmail.com"  # default
    if env_path.exists():
        with open(env_path, 'r') as f:
            for line in f:
                line = line.strip()
                if line.startswith("ADMIN_EMAILS="):
                    emails = line.split("=", 1)[1].strip()
                    if "," in emails:
                        admin_email = emails.split(",")[0].strip()
                    else:
                        admin_email = emails
                    break
    
    print(f"Admin email: {admin_email}")
    
    # Check SQLite database
    db_path = Path("fertilizer.db")
    if not db_path.exists():
        print("ERROR: SQLite database (fertilizer.db) not found!")
        print("\nPossible solutions:")
        print("1. Run database migrations: alembic upgrade head")
        print("2. Start PostgreSQL with Docker: docker compose up -d postgres")
        print("3. Create SQLite database by removing DATABASE_URL from .env and starting the app")
        return 1
    
    # Generate random password
    alphabet = string.ascii_letters + string.digits
    new_password = ''.join(secrets.choice(alphabet) for _ in range(12))
    
    print(f"Generated password: {new_password}")
    
    # Try bcrypt first, fallback to simple hash
    try:
        import bcrypt
        hashed = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        print("Using bcrypt for password hashing")
    except ImportError:
        print("WARNING: bcrypt not installed. Using SHA256 (NOT production secure)")
        import hashlib
        salt = "fertilizer_salt"
        hashed = hashlib.sha256((new_password + salt).encode()).hexdigest()
        hashed = f"sha256${salt}${hashed}"
    
    # Connect to SQLite
    try:
        conn = sqlite3.connect(str(db_path))
        cursor = conn.cursor()
        
        # Check if users table exists
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='users'")
        if not cursor.fetchone():
            print("ERROR: 'users' table not found!")
            print("The database may need to be initialized.")
            print("Run: alembic upgrade head")
            conn.close()
            return 1
        
        # Check if user exists
        cursor.execute("SELECT id, email, role FROM users WHERE email = ?", (admin_email,))
        user = cursor.fetchone()
        
        if user:
            user_id, email, role = user
            print(f"Found existing user: ID={user_id}, Role={role}")
            cursor.execute("UPDATE users SET hashed_password = ? WHERE email = ?", (hashed, admin_email))
            print(f"Updated password for {email}")
        else:
            print(f"User not found. Creating new admin user...")
            cursor.execute(
                "INSERT INTO users (email, hashed_password, role, is_active) VALUES (?, ?, ?, ?)",
                (admin_email, hashed, "admin", 1)
            )
            user_id = cursor.lastrowid
            print(f"Created new admin user with ID {user_id}")
        
        conn.commit()
        
        # Verify the update
        cursor.execute("SELECT email, role FROM users WHERE email = ?", (admin_email,))
        updated_user = cursor.fetchone()
        conn.close()
        
        if updated_user:
            print("\n" + "="*60)
            print("SUCCESS: Admin password reset!")
            print("="*60)
            print(f"Email: {admin_email}")
            print(f"Password: {new_password}")
            print("\nUse these credentials to log in.")
            print("IMPORTANT: Change password after first login.")
            print("="*60)
            return 0
        else:
            print("ERROR: Failed to verify user creation")
            return 1
            
    except sqlite3.Error as e:
        print(f"Database error: {e}")
        return 1
    except Exception as e:
        print(f"Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return 1

if __name__ == "__main__":
    sys.exit(main())