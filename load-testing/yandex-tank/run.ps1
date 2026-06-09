param(
  [string]$Config = "load.yaml",
  [string]$Image = "yandex/yandex-tank"
)

$ErrorActionPreference = "Stop"

$LoadTestDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ConfigPath = Join-Path $LoadTestDir $Config

if (-not (Test-Path $ConfigPath)) {
  throw "Yandex Tank config was not found: $ConfigPath"
}

docker run --rm -it `
  -v "${LoadTestDir}:/var/loadtest" `
  --workdir /var/loadtest `
  $Image `
  -c $Config
