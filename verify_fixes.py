#!/usr/bin/env python3
"""
Verification script for Railway deployment fixes.
Run this script to confirm all deployment fixes are working correctly.
"""

import os
import sys
import subprocess
from pathlib import Path

def check_gunicorn_installation():
    """Check if gunicorn is installed and available."""
    print("[CHECK] Checking gunicorn installation...")
    try:
        result = subprocess.run(
            ["python", "-c", "import gunicorn; print(f'Gunicorn version: {gunicorn.__version__}')"],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print(f"[OK] {result.stdout.strip()}")
            return True
        else:
            print(f"[FAIL] Gunicorn import failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"[FAIL] Error checking gunicorn: {e}")
        return False

def check_async_url_conversion():
    """Check if async URL conversion works correctly."""
    print("\n[CHECK] Checking async URL conversion...")
    
    # Test the get_async_database_url function
    test_code = """
import os
import sys
sys.path.insert(0, 'src')
from db.session import get_async_database_url

# Test 1: Railway-style URL
os.environ['DATABASE_URL'] = 'postgresql://user:pass@host:5432/db'
result1 = get_async_database_url()
print(f'Test 1 - Railway URL: {result1}')
assert '+asyncpg' in result1, f'Expected asyncpg driver, got: {result1}'

# Test 2: Already async URL
os.environ['DATABASE_URL'] = 'postgresql+asyncpg://user:pass@host:5432/db'
result2 = get_async_database_url()
print(f'Test 2 - Already async: {result2}')
assert '+asyncpg' in result2, f'Expected asyncpg driver, got: {result2}'

# Test 3: No DATABASE_URL (should use default)
os.environ.pop('DATABASE_URL', None)
result3 = get_async_database_url()
print(f'Test 3 - Default URL: {result3}')
assert '+asyncpg' in result3, f'Expected asyncpg driver, got: {result3}'

print('All async URL tests passed!')
"""
    
    try:
        result = subprocess.run(
            [sys.executable, "-c", test_code],
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("[OK] Async URL conversion working correctly")
            print(f"   Output: {result.stdout.strip()}")
            return True
        else:
            print(f"[FAIL] Async URL conversion failed: {result.stderr}")
            return False
    except Exception as e:
        print(f"[FAIL] Error checking async URL conversion: {e}")
        return False

def check_model_files():
    """Check if model files exist and are accessible."""
    print("\n[CHECK] Checking model files...")
    
    model_files = [
        "src/artifact/model.pkl",
        "src/artifact/model_artifact_v1.pkl", 
        "src/artifact/preprocessor.pkl",
        "src/artifact/metadata.json"
    ]
    
    all_exist = True
    for model_file in model_files:
        if Path(model_file).exists():
            size = Path(model_file).stat().st_size
            print(f"[OK] {model_file} exists ({size:,} bytes)")
        else:
            print(f"[FAIL] {model_file} NOT FOUND")
            all_exist = False
    
    return all_exist

def check_start_production_script():
    """Check if start_production.sh has the fixes."""
    print("\n[CHECK] Checking start_production.sh fixes...")
    
    script_path = "start_production.sh"
    if not Path(script_path).exists():
        print(f"[FAIL] {script_path} not found")
        return False
    
    with open(script_path, 'r') as f:
        content = f.read()
    
    checks = [
        ("Gunicorn fallback check", 'command -v gunicorn >/dev/null 2>&1'),
        ("Uvicorn fallback", 'Gunicorn not found, falling back to Uvicorn'),
        ("Model file check", 'if [ ! -f "src/artifact/model.pkl" ]'),
    ]
    
    all_passed = True
    for check_name, pattern in checks:
        if pattern in content:
            print(f"[OK] {check_name} present")
        else:
            print(f"[FAIL] {check_name} NOT FOUND")
            all_passed = False
    
    # Check line numbers (gunicorn exec should NOT be at line 61)
    lines = content.split('\n')
    for i, line in enumerate(lines, 1):
        if 'exec gunicorn' in line:
            print(f"[OK] Gunicorn exec found at line {i} (not line 61)")
            if i == 61:
                print("[FAIL] WARNING: Gunicorn exec at line 61 - this is the OLD version!")
                all_passed = False
            break
    
    return all_passed

def check_dockerfile():
    """Check if Dockerfile has runtime package installation."""
    print("\n[CHECK] Checking Dockerfile fixes...")
    
    dockerfile_path = "Dockerfile"
    if not Path(dockerfile_path).exists():
        print(f"[FAIL] {dockerfile_path} not found")
        return False
    
    with open(dockerfile_path, 'r') as f:
        content = f.read()
    
    # Check for runtime package installation
    if 'RUN pip install --no-cache-dir -r requirements.txt' in content:
        print("[OK] Runtime package installation present")
        return True
    else:
        print("[FAIL] Runtime package installation NOT FOUND")
        return False

def main():
    print("=" * 60)
    print("Railway Deployment Fixes Verification")
    print("=" * 60)
    
    all_passed = True
    
    # Run all checks
    if not check_gunicorn_installation():
        all_passed = False
    
    if not check_async_url_conversion():
        all_passed = False
    
    if not check_model_files():
        all_passed = False
    
    if not check_start_production_script():
        all_passed = False
    
    if not check_dockerfile():
        all_passed = False
    
    print("\n" + "=" * 60)
    if all_passed:
        print("[SUCCESS] ALL CHECKS PASSED!")
        print("\nDeployment Status:")
        print("   • Gunicorn is properly installed")
        print("   • Async URL conversion works for Railway")
        print("   • Model files are present")
        print("   • Startup script has fallback mechanisms")
        print("   • Dockerfile installs packages at runtime")
        print("\nReady for redeployment on Railway!")
        return 0
    else:
        print("[FAILURE] SOME CHECKS FAILED")
        print("\nPlease fix the issues above before redeploying.")
        return 1

if __name__ == "__main__":
    sys.exit(main())