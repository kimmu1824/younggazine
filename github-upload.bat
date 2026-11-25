@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === 영거진 코드를 GitHub(kimmu1824/younggazine)에 올립니다 ===
echo.

where git >nul 2>nul
if errorlevel 1 (
  echo [!] Git이 설치돼 있지 않아요. 아래를 입력해서 설치한 뒤, 창을 닫고 이 파일을 다시 실행하세요.
  echo     winget install Git.Git
  pause
  exit /b 1
)

if not exist .git (
  git init -b main
)

rem --- 안전장치: .env(키 파일)가 절대 올라가지 않게 확인 ---
git check-ignore -q .env
if errorlevel 1 (
  echo [!] .gitignore에 .env 보호 설정이 없어 중단합니다.
  pause
  exit /b 1
)
git rm --cached -q .env >nul 2>nul

git add -A
git -c user.name="kimmu1824" -c user.email="kimmu1824@users.noreply.github.com" commit -m "영거진 렌더러 업데이트" >nul 2>nul

git remote get-url origin >nul 2>nul
if errorlevel 1 (
  git remote add origin https://github.com/kimmu1824/younggazine.git
)

echo GitHub 로그인 창이 뜨면 로그인하세요...
git push -u origin main
if errorlevel 1 (
  echo.
  echo [!] 올리기 실패. github.com/new 에서 younggazine 레포를 Public으로 만들었는지 확인하세요.
) else (
  echo.
  echo 완료! https://github.com/kimmu1824/younggazine
)
pause
