# Skill: B2B Production Deployer

## Description
Prepara y despliega la aplicación Orbin en entornos de producción seguros.

## Checklist
1. **Security Audit:** Llama al subagente `security_auditor.md` para verificar que no haya API Keys expuestas.
2. **Environment Sync:** Asegura que las variables en Vercel coincidan con el archivo `.env` local.
3. **Build Validation:** Ejecuta un test de compilación antes de subir el código para garantizar estabilidad 24/7.