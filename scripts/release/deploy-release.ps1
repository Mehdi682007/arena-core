param(
    [Parameter(Mandatory=$true)]
    [string]$ReleaseFile,

    [Parameter(Mandatory=$true)]
    [string]$Server,

    [string]$User="arena"
)

$ErrorActionPreference = "Stop"


if (!(Test-Path $ReleaseFile)) {
    throw "Release file not found: $ReleaseFile"
}


$ReleaseFile = (Resolve-Path $ReleaseFile).Path
$ReleaseName = Split-Path $ReleaseFile -Leaf


Write-Host ""
Write-Host "================================="
Write-Host " Arena Core Release Deployment"
Write-Host "================================="
Write-Host ""

Write-Host "Release:"
Write-Host " $ReleaseName"

Write-Host ""
Write-Host "Target:"
Write-Host " ${User}@${Server}"

Write-Host ""
Write-Host "Calculating SHA256..."

$Hash = (
    Get-FileHash `
    -Algorithm SHA256 `
    $ReleaseFile
).Hash


Write-Host ""
Write-Host "SHA256:"
Write-Host " $Hash"


Write-Host ""
Write-Host "Uploading release..."


$RemotePath = "/home/${User}/${ReleaseName}"


scp `
    $ReleaseFile `
    "${User}@${Server}:${RemotePath}"


Write-Host ""
Write-Host "Upload completed."


Write-Host ""
Write-Host "Starting remote deployment..."


$RemoteScript = @"
set -euo pipefail


RELEASE="/home/${User}/${ReleaseName}"


echo "Checking release archive..."

test -f "\$RELEASE"


echo "Moving archive..."

sudo mkdir -p /opt/arena/releases


sudo mv \
"\$RELEASE" \
/opt/arena/releases/


echo "Installing release..."


sudo bash \
/opt/arena/scripts/install-release.sh \
/opt/arena/releases/${ReleaseName}


echo "Running verification..."


sudo bash \
/opt/arena/scripts/verify.sh


echo ""
echo "Active release:"
readlink -f /opt/arena/current


echo ""
echo "Deployment completed successfully."
"@


$RemoteScript | ssh "${User}@${Server}" "bash -s"


Write-Host ""
Write-Host "================================="
Write-Host " Deployment Finished"
Write-Host "================================="