# Orbin AI Startup Script
Write-Host "`n🪵 Iniciando Orbin AI Sistemas...`n" -ForegroundColor Cyan

# Start Backend Server
Write-Host "► Iniciando Backend (puerto 3003)..." -ForegroundColor Yellow
cd "C:\Users\Azomarg\Documents\Claude_projects\Orbin\server"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Normal

# Wait for backend to start
Start-Sleep -Seconds 4

# Start Frontend Server
Write-Host "`n► Iniciando Frontend (puerto 5174)..." -ForegroundColor Yellow
cd "C:\Users\Azomarg\Documents\Claude_projects\Orbin\client"
Start-Process -FilePath "cmd.exe" -ArgumentList "/c npm run dev" -WindowStyle Normal

Write-Host "`n✓ Servidores iniciados. Accede a: http://localhost:5174`n" -ForegroundColor Green
Start-Sleep -Seconds 2
