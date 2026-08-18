@echo off
title B3 Plantao Monitor
echo ========================================================
echo   Iniciando Painel Web - B3 Plantao de Noticias
echo ========================================================
echo.
echo Abrindo o navegador em http://127.0.0.1:8000 ...
start http://127.0.0.1:8000
echo.
python app.py
pause
