# Запуск invest-platform: Postgres + backend (NestJS) + mobile web (Expo)
# Использование: правый клик -> "Run with PowerShell", либо в терминале: .\start.ps1

$root = $PSScriptRoot

# 1. Postgres (служба Windows)
$pg = Get-Service | Where-Object { $_.Name -like 'postgresql*' } | Select-Object -First 1
if ($null -eq $pg) {
    Write-Host "Служба PostgreSQL не найдена! Установите PostgreSQL." -ForegroundColor Red
    exit 1
}
if ($pg.Status -ne 'Running') {
    Write-Host "Запускаю службу $($pg.Name)..." -ForegroundColor Yellow
    try {
        Start-Service $pg.Name -ErrorAction Stop
    } catch {
        Write-Host "Не удалось запустить Postgres (нужны права администратора?): $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host "PostgreSQL: OK ($($pg.Name))" -ForegroundColor Green

# 2. Backend на :3000 (пропускаем, если уже запущен)
if (Test-NetConnection localhost -Port 3000 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Host "Backend уже запущен на :3000 — пропускаю" -ForegroundColor Yellow
} else {
    Write-Host "Запускаю backend (http://localhost:3000/api)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = 'invest-platform BACKEND'; Set-Location '$root\backend'; npm run start:dev"
}

# 3. Mobile web на :80 (пропускаем, если уже запущен)
if (Test-NetConnection localhost -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue) {
    Write-Host "Mobile web уже запущен на :80 — пропускаю" -ForegroundColor Yellow
} else {
    Write-Host "Запускаю mobile web (http://localhost)..." -ForegroundColor Cyan
    Start-Process powershell -ArgumentList '-NoExit', '-Command', "`$Host.UI.RawUI.WindowTitle = 'invest-platform MOBILE WEB'; Set-Location '$root\mobile'; npm run web -- --port 80"
}

# 4. Ждём, пока веб-клиент начнёт отвечать, и открываем браузер
Write-Host "Жду, пока поднимется http://localhost ..." -ForegroundColor Cyan
$up = $false
foreach ($i in 1..60) {
    if (Test-NetConnection localhost -Port 80 -InformationLevel Quiet -WarningAction SilentlyContinue) { $up = $true; break }
    Start-Sleep -Seconds 2
}
if ($up) {
    Write-Host "Готово! Открываю браузер." -ForegroundColor Green
    Start-Process 'http://localhost/'
} else {
    Write-Host "Веб-клиент не поднялся за 2 минуты — смотрите окно 'invest-platform MOBILE WEB'." -ForegroundColor Red
}
