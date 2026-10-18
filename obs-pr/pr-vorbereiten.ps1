# Bereitet die beiden Pull-Request-Branches in deinem GitHub-Fork vor.
# Aufruf: Rechtsklick auf diese Datei -> "Mit PowerShell ausfuehren"
# Voraussetzung: Git for Windows ist installiert, der Fork existiert auf GitHub.

$ErrorActionPreference = "Stop"
$hier = Split-Path -Parent $MyInvocation.MyCommand.Path

$user = Read-Host "Dein GitHub-Benutzername"
if (-not $user) { Write-Host "Kein Name eingegeben - Abbruch."; pause; exit 1 }

$ziel = Join-Path $env:USERPROFILE "openbridgeserver-pr"
if (Test-Path $ziel) {
    Write-Host "Ordner $ziel existiert schon - bitte loeschen oder umbenennen und neu starten."
    pause; exit 1
}

git clone "https://github.com/$user/openbridgeserver.git" $ziel
Set-Location $ziel
git remote add upstream https://github.com/abeggled/openbridgeserver.git
git fetch upstream main

# Name/E-Mail fuer diese Kopie, falls noch nicht global gesetzt
if (-not (git config user.name))  { git config user.name  (Read-Host "Dein Name fuer Git") }
if (-not (git config user.email)) { git config user.email (Read-Host "Deine E-Mail fuer Git (oder GitHub-noreply-Adresse)") }

foreach ($b in @("feat-link-icon-size", "feat-raster-icons")) {
    $branch = $b -replace "^feat-", "feat/"
    Write-Host ""
    Write-Host "=== $branch ==="
    git checkout -b $branch upstream/main
    $patches = Get-ChildItem (Join-Path $hier $b) -Filter "*.patch" | Sort-Object Name
    git am --3way $patches.FullName
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Patch passt nicht mehr sauber auf den aktuellen Stand. Bitte Claude Bescheid geben."
        git am --abort
        pause; exit 1
    }
    git push -u origin $branch
}

Write-Host ""
Write-Host "Fertig. Jetzt auf https://github.com/$user/openbridgeserver gehen -"
Write-Host "dort erscheinen zwei gelbe Hinweise 'Compare & pull request'."
pause
