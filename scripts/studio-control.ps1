# 영거진 스튜디오 제어: on(자동 실행 켜고 바로 시작) / off(자동 실행 끄기) / stop(지금 끄기) / start / status
param([Parameter(Position = 0)][string]$Action = "status")

$Root = Split-Path -Parent $PSScriptRoot
$Lnk = Join-Path ([Environment]::GetFolderPath('Startup')) 'younggazine-studio.lnk'
$Loop = Join-Path $Root 'studio-loop.bat'

function Get-StudioProcs {
  Get-CimInstance Win32_Process | Where-Object {
    $_.ProcessId -ne $PID -and $_.CommandLine -and $_.CommandLine -match 'studio-loop\.bat|studio\.js' -and $_.Name -in @('cmd.exe', 'node.exe')
  }
}
function Start-Studio {
  if (Get-StudioProcs) { Write-Host "이미 켜져 있어요."; return }
  Start-Process -FilePath $Loop -WorkingDirectory $Root -WindowStyle Minimized
  Write-Host "스튜디오를 켰어요 (최소화된 창). http://localhost:3939"
}

switch ($Action) {
  'on' {
    $s = (New-Object -ComObject WScript.Shell).CreateShortcut($Lnk)
    $s.TargetPath = $Loop; $s.WorkingDirectory = $Root; $s.WindowStyle = 7; $s.Description = 'younggazine studio'
    $s.Save()
    Write-Host "자동 실행을 켰어요. (로그인하면 최소화된 창으로 켜지고, 꺼지면 5초 뒤 다시 켜져요)"
    Start-Studio
  }
  'off' {
    if (Test-Path $Lnk) { Remove-Item $Lnk -Force }
    Write-Host "자동 실행을 껐어요. 지금 켜진 스튜디오는 stop-studio.bat 으로 끄세요."
  }
  'stop' {
    $p = Get-StudioProcs
    # 반복 실행 창(cmd)을 먼저 끄고 node를 꺼야 다시 켜지지 않아요
    $p | Sort-Object { $_.Name -ne 'cmd.exe' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host ("스튜디오를 껐어요. ({0}개 프로세스)" -f @($p).Count)
  }
  'start' { Start-Studio }
  default {
    Write-Host ("자동 실행: {0}" -f $(if (Test-Path $Lnk) { '켜짐' } else { '꺼짐' }))
    Write-Host ("실행 중: {0}" -f $(if (Get-StudioProcs) { '예' } else { '아니오' }))
  }
}
