# Test final de validación - endpoint /api/chat/design con mensaje "hola"

Write-Host "🧪 TEST FINAL: Endpoint /api/chat/design con 'hola'" -ForegroundColor Cyan
Write-Host ""

# Configuración básica
$uri = "http://localhost:3000/api/chat/design"
$headers = @{
    "Content-Type" = "application/json"
    "Authorization" = "Bearer dev-token"
}

$body = @{
    message = "hola"
    sessionId = "test-session-final"
    lang = "ES"
} | ConvertTo-Json

Write-Host "📤 Enviando POST a $uri"
Write-Host "Body: $body"
Write-Host ""

try {
    # Hacer la solicitud
    $response = Invoke-RestMethod -Uri $uri -Method POST -Body $body -Headers $headers
    
    Write-Host "✅ RESPONSE HTTP 200" -ForegroundColor Green
    Write-Host ""
    
    # Mostrar campos importantes
    Write-Host "📊 RESULTADO:"
    Write-Host "  - success: $($response.success)"
    Write-Host "  - params: $($response.params)" 
    Write-Host "  - design: $($response.design)"
    Write-Host "  - source: $($response.source)" 
    Write-Host "  - isGreeting: $($response.isGreeting)"
    Write-Host "  - reply (primeros 80 chars): '$($response.reply.Substring(0, [Math]::Min(80, $response.reply.Length)))...'"
    Write-Host ""
    
    # Verificaciones críticas
    Write-Host "🔍 VERIFICACIONES:" -ForegroundColor Yellow
    
    $checks = @(
        @{ Name = "Status HTTP 200"; Condition = $true },
        @{ Name = "success == true"; Condition = $response.success -eq $true },
        @{ Name = "params == null"; Condition = $response.params -eq $null },
        @{ Name = "design == null"; Condition = $response.design -eq $null },
        @{ Name = "source definido"; Condition = ![string]::IsNullOrEmpty($response.source) },
        @{ Name = "isGreeting == true"; Condition = $response.isGreeting -eq $true },
        @{ Name = "reply contiene 'Orbin'"; Condition = $response.reply -match "Orbin" }
    )
    
    $allPassed = $true
    foreach ($check in $checks) {
        if ($check.Condition) {
            Write-Host "  ✅ $($check.Name)" -ForegroundColor Green
        } else {
            Write-Host "  ❌ $($check.Name)" -ForegroundColor Red
            $allPassed = $false
        }
    }
    
    Write-Host ""
    if ($allPassed) {
        Write-Host "🎯 RESULTADO FINAL: ✅ ÉXITO TOTAL - Todas las verificaciones pasaron!" -ForegroundColor Green
        Write-Host "   La protección contra saludos funciona correctamente" -ForegroundColor Green
    } else {
        Write-Host "🚨 RESULTADO FINAL: ❌ ALGUNAS VERIFICACIONES FALLARON" -ForegroundColor Red
    }
    
} catch {
    Write-Host "❌ ERROR en la solicitud: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Stack trace: $($_.Exception.StackTrace)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📋 RESUMEN DE CAMBIOS QUIRÚRGICOS APLICADOS:" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. aiOrchestrator.js - Agregado isGreeting: true en bloque de saludos"
Write-Host "2. chat.js - Todas las llamadas a generateProject() protegidas con typeof result.params === 'object'"
Write-Host "3. chat.js - Guarda defensiva robusta para detectar saludos conversacionales"
Write-Host ""
Write-Host "🔧 FILES MODIFICADOS:"
Write-Host "- server/src/routes/chat.js"
Write-Host "- server/src/ai/aiOrchestrator.js"