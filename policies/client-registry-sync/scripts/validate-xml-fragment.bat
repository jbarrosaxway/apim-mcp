@echo off
setlocal
set VDIST=C:\Axway-7.7.20260530\apigateway
set SCRIPT=%~dp0validate-xml-fragment.py
set JYTHON=%VDIST%\Win32\bin\jython.bat

if not exist "%JYTHON%" (
  echo jython.bat nao encontrado: %JYTHON%
  exit /b 1
)

call "%JYTHON%" "%SCRIPT%" %*
exit /b %ERRORLEVEL%
