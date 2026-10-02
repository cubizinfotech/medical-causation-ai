# Copy local knowledge-base books and articles that are missing or a different
# size on the server. Finished files are skipped, so it is safe to run again
# after a dropped connection.
#
# From the repository root:
#   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\upload-knowledge-base.ps1
#
# Another server:
#   $env:MCA_SSH_TARGET = "deploy@YOUR_SERVER"
#   $env:MCA_KB_REMOTE = "/var/www/medical-causation-ai/knowledge-base"

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$localBase = Join-Path $repoRoot "knowledge-base"
if (-not (Test-Path -LiteralPath $localBase)) {
  Write-Host "No knowledge-base folder at $localBase"
  exit 1
}

$sshTarget = if ($env:MCA_SSH_TARGET) { $env:MCA_SSH_TARGET } else { "deploy@157.230.156.87" }
$remoteBase = if ($env:MCA_KB_REMOTE) { $env:MCA_KB_REMOTE } else { "/var/www/medical-causation-ai/knowledge-base" }
$sshOpts = @(
  "-o", "ServerAliveInterval=15",
  "-o", "ServerAliveCountMax=20",
  "-o", "TCPKeepAlive=yes"
)

$key = Join-Path $env:USERPROFILE ".ssh\id_ed25519"
$pub = "$key.pub"
if (-not (Test-Path $pub)) {
  Write-Host "Creating an SSH key so you are not asked for a password on every file."
  New-Item -ItemType Directory -Force -Path (Split-Path $key) | Out-Null
  & ssh-keygen -t ed25519 -f $key -N ""
}

Write-Host "If asked, enter the server password once to install the key."
Get-Content $pub | & ssh @sshOpts $sshTarget "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"

Write-Host "Removing local EWI test reports from the server, if that folder exists."
& ssh @sshOpts $sshTarget "rm -rf '$remoteBase/ewi/reports/investigations'"

Write-Host "Reading which files are already on the server..."
$remoteLines = & ssh @sshOpts $sshTarget "find '$remoteBase/books' '$remoteBase/articles' -type f -printf '%s|%p\n' 2>/dev/null"
$remoteMap = @{}
foreach ($line in @($remoteLines)) {
  if ($line -match '^(\d+)\|(.*)$') {
    $full = $Matches[2]
    if ($full.StartsWith($remoteBase)) {
      $rel = $full.Substring($remoteBase.Length).TrimStart("/")
      $remoteMap[$rel] = [int64]$Matches[1]
    }
  }
}

$missing = New-Object System.Collections.Generic.List[System.IO.FileInfo]
Get-ChildItem -LiteralPath "$localBase\books", "$localBase\articles" -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
  $rel = $_.FullName.Substring($localBase.Length + 1).Replace("\", "/")
  $remoteSize = $remoteMap[$rel]
  if ($null -eq $remoteSize -or $remoteSize -ne $_.Length) {
    $missing.Add($_)
  }
}

Write-Host ("Files still to upload: " + $missing.Count)
$index = 0
foreach ($file in $missing) {
  $index++
  $rel = $file.FullName.Substring($localBase.Length + 1).Replace("\", "/")
  $remoteDir = ($rel -replace "/[^/]+$", "")
  & ssh @sshOpts $sshTarget "mkdir -p '$remoteBase/$remoteDir'"
  Write-Host ("[$index/$($missing.Count)] $rel")
  & scp @sshOpts -- $file.FullName "${sshTarget}:${remoteBase}/$rel"
  if ($LASTEXITCODE -ne 0) {
    Write-Host "STOPPED on $rel. Run the same command again. Finished files are skipped."
    exit 1
  }
}

Write-Host "Upload finished. On the server run: cd /var/www/medical-causation-ai && npm run reembed:kb:full"
