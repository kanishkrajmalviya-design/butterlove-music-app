@echo off
title ButterLove Couples Music App
cd /d "%~dp0"
echo ===================================================
echo   Starting ButterLove Couples Music App...
echo   LIVE REAL-TIME SEARCH: ALL SPOTIFY & BOLLYWOOD SONGS
echo   FULL SONGS 100% ENABLED (3-6 Minutes Per Song)
echo ===================================================
start "" "http://localhost:3000"
node server.js
pause
