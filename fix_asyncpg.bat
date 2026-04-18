@echo off
REM Script to fix asyncpg installation issue on Windows
REM This fixes: "ModuleNotFoundError: No module named 'asyncpg.protocol.protocol'"

echo ========================================
echo FIXING ASYNCPG INSTALLATION ISSUE
echo ========================================
echo.

echo 1. Checking current asyncpg installation...
python -c "import asyncpg; print('asyncpg version:', asyncpg.__version__)" 2>nul
if %errorlevel% neq 0 (
    echo ❌ asyncpg is not properly installed
)

echo.
echo 2. Uninstalling asyncpg...
pip uninstall asyncpg -y

echo.
echo 3. Installing asyncpg version 0.29.0 (more stable on Windows)...
pip install asyncpg==0.29.0

echo.
echo 4. Verifying installation...
python -c "import asyncpg; print('✅ asyncpg version:', asyncpg.__version__)" 2>nul
if %errorlevel% equ 0 (
    echo ✅ asyncpg installed successfully!
) else (
    echo ❌ Installation failed. Trying alternative solution...
    echo.
    echo 5. Trying asyncpg 0.30.0 with --no-binary flag...
    pip uninstall asyncpg -y
    pip install asyncpg==0.30.0 --no-binary asyncpg
)

echo.
echo 6. Final verification...
python -c "
try:
    import asyncpg
    import asyncpg.protocol.protocol
    print('✅ asyncpg.protocol.protocol module found!')
    print('✅ asyncpg version:', asyncpg.__version__)
except Exception as e:
    print('❌ Error:', e)
"

echo.
echo ========================================
echo FIX COMPLETE
echo ========================================
echo.
echo If the issue persists:
echo 1. Use Docker instead: docker compose up -d
echo 2. Or try a clean virtual environment:
echo    - deactivate
echo    - rmdir /s venv
echo    - python -m venv venv
echo    - venv\Scripts\activate
echo    - pip install -r requirements.txt
echo.
pause