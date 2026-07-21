# Запуск invest-platform: Postgres + backend (NestJS) + mobile web (Expo)
# Использование: правый клик -> "Run with PowerShell", либо в терминале: .\start.ps1

$root = $PSScriptRoot

# 1. Postgres (контейнер из docker-compose.yml)
if ($null -eq (Get-Command docker -ErrorAction SilentlyContinue)) {
    Write-Host "Docker не найден! Установите Docker Desktop." -ForegroundColor Red
    exit 1
}

Write-Host "Проверяю Docker..." -ForegroundColor Cyan
docker info *> $null
if ($LASTEXITCODE -ne 0) {
    Write-Host "Docker Desktop не запущен — запускаю и жду..." -ForegroundColor Yellow
    Start-Process 'com.docker.docker://' -ErrorAction SilentlyContinue
    foreach ($i in 1..60) {
        Start-Sleep -Seconds 2
        docker info *> $null
        if ($LASTEXITCODE -eq 0) { break }
    }
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Docker так и не поднялся за 2 минуты — запустите Docker Desktop вручную." -ForegroundColor Red
        exit 1
    }
}

Write-Host "Поднимаю Postgres (docker compose up -d)..." -ForegroundColor Cyan
docker compose -f "$root\docker-compose.yml" up -d postgres
if ($LASTEXITCODE -ne 0) {
    Write-Host "Не удалось поднять контейнер Postgres." -ForegroundColor Red
    exit 1
}

# Контейнер стартовал — ждём, пока сама база начнёт принимать подключения
$dbUp = $false
foreach ($i in 1..30) {
    docker compose -f "$root\docker-compose.yml" exec -T postgres pg_isready -U postgres -d invest_platform *> $null
    if ($LASTEXITCODE -eq 0) { $dbUp = $true; break }
    Start-Sleep -Seconds 2
}
if (-not $dbUp) {
    Write-Host "Postgres не ответил за минуту — смотрите 'docker compose logs postgres'." -ForegroundColor Red
    exit 1
}
Write-Host "PostgreSQL: OK (docker, localhost:5432)" -ForegroundColor Green

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
