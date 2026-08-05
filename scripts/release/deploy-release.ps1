param(
    [Parameter(Mandatory=$true)]
    [string]$ReleaseFile,

    [Parameter(Mandatory=$true)]
    [string]$Server,

    [string]$User="arena"
)

$ErrorActionPreference="Stop"


if (!(Test-Path $ReleaseFile)) {
    throw "Release file not found"
}


$ReleaseFile=(Resolve-Path $ReleaseFile).Path

$ArchiveName=Split-Path $ReleaseFile -Leaf


$Version=$ArchiveName `
    -replace "^arena-release-","" `
    -replace "\.tar\.gz$",""


$Hash=(Get-FileHash `
    -Algorithm SHA256 `
    $ReleaseFile).Hash.ToLower()


Write-Host ""
Write-Host "================================="
Write-Host " Arena Core Production Deploy"
Write-Host "================================="
Write-Host ""

Write-Host "Release:"
Write-Host $ArchiveName

Write-Host ""
Write-Host "Version:"
Write-Host $Version

Write-Host ""
Write-Host "SHA256:"
Write-Host $Hash


$RemoteArchive="/home/${User}/${ArchiveName}"


Write-Host ""
Write-Host "Uploading release..."

scp `
    $ReleaseFile `
    "${User}@${Server}:${RemoteArchive}"


Write-Host ""
Write-Host "Uploading deployment helper..."


scp `
    "scripts/release/remote-deploy.sh" `
    "${User}@${Server}:/tmp/remote-deploy.sh"


Write-Host ""
Write-Host "Executing deployment..."


ssh `
"${User}@${Server}" `
"chmod +x /tmp/remote-deploy.sh && bash /tmp/remote-deploy.sh '$RemoteArchive' '$Version' '$Hash'"


if($LASTEXITCODE -ne 0){
    throw "Remote deployment failed"
}


Write-Host ""
Write-Host "================================="
Write-Host " Deployment Finished"
Write-Host "================================="