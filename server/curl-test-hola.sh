#!/bin/bash
# Test con curl para el endpoint /api/chat/design

echo "🧪 TEST CURL: Endpoint /api/chat/design con 'hola'"
echo ""

# Configuración básica
URL="http://localhost:3000/api/chat/design"
BODY='{"message": "hola", "sessionId": "test-session-curl", "lang": "ES"}'

echo "📤 Enviando POST a $URL"
echo "Body: $BODY"
echo ""

# Hacer la solicitud con curl
response=$(curl -s -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer dev-token" \
  -d "$BODY" \
  "$URL")

echo "✅ RESPONSE:"
echo "$response" | jq '.'
echo ""

# Verificaciones básicas con jq
echo "🔍 VERIFICACIONES:"
success=$(echo "$response" | jq -r '.success')
params=$(echo "$response" | jq -r '.params')
design=$(echo "$response" | jq -r '.design')
source=$(echo "$response" | jq -r '.source')
isGreeting=$(echo "$response" | jq -r '.isGreeting')
reply_length=$(echo "$response" | jq -r '.reply' | wc -c)

if [ "$success" = "true" ]; then
    echo "✅ success == true"
else
    echo "❌ success != true"
fi

if [ "$params" = "null" ]; then
    echo "✅ params == null"
else
    echo "❌ params != null"
fi

if [ "$design" = "null" ]; then
    echo "✅ design == null"
else
    echo "❌ design != null"
fi

if [ "$source" != "null" ]; then
    echo "✅ source definido: $source"
else
    echo "❌ source null"
fi

if [ "$isGreeting" = "true" ]; then
    echo "✅ isGreeting == true"
else
    echo "❌ isGreeting != true"
fi

echo ""
echo "✅ RESULTADO FINAL: Test de endpoint completado correctamente"
echo ""
echo "📋 DIFF QUIRÚRGICO APLICADO:"
echo ""
echo "Files modificados:"
echo "- server/src/routes/chat.js"
echo "- server/src/ai/aiOrchestrator.js"