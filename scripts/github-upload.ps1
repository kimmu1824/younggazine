# 영거진 코드를 GitHub(kimmu1824/younggazine)에 올린다.
# 안전장치: .env / content(샘플 제외) / data / output 이 올라가거나 키가 섞이면 중단.
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
$repoUrl = 'https://github.com/kimmu1824/younggazine.git'

function Stop-Upload($msg) {
  Write-Host ""
  Write-Host "[!] $msg" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== 영거진 코드를 GitHub(kimmu1824/younggazine)에 올립니다 ===" -ForegroundColor Cyan
Write-Host ""

# git 찾기 (PATH에 없으면 기본 설치 위치)
$git = (Get-Command git -ErrorAction SilentlyContinue).Source
if (-not $git -and (Test-Path 'C:\Program Files\Git\cmd\git.exe')) { $git = 'C:\Program Files\Git\cmd\git.exe' }
if (-not $git) { Stop-Upload "Git이 없어요. 'winget install Git.Git' 으로 설치한 뒤 다시 실행하세요." }

function Invoke-Git { & $git @args; if ($LASTEXITCODE -ne 0) { throw "git $($args -join ' ') 실패" } }

if (-not (Test-Path .git)) { Invoke-Git init -q -b main }

# 1) .env 보호 확인
& $git check-ignore -q .env
if ($LASTEXITCODE -ne 0) { Stop-Upload ".gitignore에 .env 보호 설정이 없어 중단합니다." }
& $git rm --cached -q --ignore-unmatch .env | Out-Null

# 2) 올릴 파일 담기
Invoke-Git add -A
$files = & $git ls-files --cached

# 3) 올리면 안 되는 파일 검사
$bad = $files | Where-Object {
  $_ -match '(^|/)\.env$' -or $_ -match '^(data|output)/' -or
  ($_ -match '^content/' -and $_ -ne 'content/sample.json')
}
if ($bad) {
  & $git reset -q
  Stop-Upload ("올리면 안 되는 파일이 있어 중단했어요:`n  " + ($bad -join "`n  "))
}

# 4) 키·웹훅이 파일 안에 섞였는지 검사
$leak = & $git grep --cached -lIE 'sk-[A-Za-z0-9_-]{20,}|discord(app)?\.com/api/webhooks/[0-9]+/|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}'
if ($leak) {
  & $git reset -q
  Stop-Upload ("API 키나 웹훅 주소로 보이는 내용이 있어 중단했어요 (내용은 표시 안 함):`n  " + ($leak -join "`n  "))
}

# 5) 바뀐 게 있으면 커밋
& $git diff --cached --quiet
if ($LASTEXITCODE -ne 0) {
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm'
  Invoke-Git -c user.name=kimmu1824 -c user.email=kimmu1824@users.noreply.github.com commit -q -m "영거진 업데이트 $stamp"
  Write-Host "변경사항을 저장했어요."
} else {
  Write-Host "새로 바뀐 파일은 없어요. 올라가지 않은 커밋이 있는지만 확인합니다."
}

# 6) 올리기
& $git remote get-url origin 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Invoke-Git remote add origin $repoUrl }

Write-Host "올리는 중... (로그인을 물어보면 화면에 나온 코드를 github.com/login/device 에 입력하세요)"
& $git -c credential.gitHubAuthModes=device push -u origin main
if ($LASTEXITCODE -ne 0) { Stop-Upload "올리기 실패. 인터넷 연결이나 GitHub 로그인을 확인하세요." }

Write-Host ""
Write-Host "완료! https://github.com/kimmu1824/younggazine" -ForegroundColor Green
