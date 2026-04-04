# Download script for static location datasets from GitHub

$repoBaseUrl = "https://raw.githubusercontent.com/blingyplus/ghana-location-api/main/data"
$dataDir = "C:\Users\User\GovLens_MVP\backend\data"

# Create the data directory if it doesn't exist
if (-not (Test-Path -Path $dataDir)) {
    New-Item -ItemType Directory -Path $dataDir | Out-Null
    Write-Host "Created directory $dataDir" -ForegroundColor Green
}

$files = @("regions.json", "districts.json", "constituencies.json")

foreach ($file in $files) {
    $url = "$repoBaseUrl/$file"
    $destination = "$dataDir\$file"
    
    Write-Host "Downloading $file..."
    Invoke-WebRequest -Uri $url -OutFile $destination
    Write-Host "Saved $file to $destination" -ForegroundColor Green
}

Write-Host "`nAll files downloaded successfully. You can now run the database seeder." -ForegroundColor Cyan
