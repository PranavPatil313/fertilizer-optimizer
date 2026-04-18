@echo off
echo Testing Fertilizer Optimizer API...
echo.

echo 1. Checking if backend container is running...
docker ps --filter "name=fertilizer-backend" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo.
echo 2. Testing API root endpoint...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/' -TimeoutSec 10; Write-Host 'Status:' $response.StatusCode; Write-Host 'Response:' $response.Content } catch { Write-Host 'Error:' $_.Exception.Message }"

echo.
echo 3. Testing health endpoint (if available)...
powershell -Command "try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/health' -TimeoutSec 10; Write-Host 'Status:' $response.StatusCode; Write-Host 'Response:' $response.Content } catch { Write-Host 'Error:' $_.Exception.Message }"

echo.
echo 4. Testing predict endpoint with sample data...
powershell -Command "$body = @'
{
  \"crop\": \"wheat\",
  \"soil_type\": \"loam\",
  \"ph\": 6.5,
  \"organic_matter\": 2.5,
  \"N\": 150,
  \"P\": 25,
  \"K\": 120,
  \"rainfall_mm\": 500,
  \"temperature_c\": 25,
  \"region\": \"north\",
  \"irrigation\": \"yes\",
  \"previous_crop\": \"fallow\"
}
'@; try { $response = Invoke-WebRequest -Uri 'http://localhost:8000/predict' -Method POST -Body $body -ContentType 'application/json' -TimeoutSec 10; Write-Host 'Status:' $response.StatusCode; Write-Host 'Response:' $response.Content } catch { Write-Host 'Error:' $_.Exception.Message }"

echo.
echo API test completed.