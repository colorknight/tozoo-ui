# Normalize project text files to UTF-8 (no BOM) and LF. Skips node_modules and .git.
$ErrorActionPreference = 'Stop'
$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path

$skipSubstrings = @('\node_modules\', '\.git\')
$extSet = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
  'js', 'jsx', 'ts', 'tsx', 'mjs', 'cjs', 'json', 'css', 'scss', 'less',
  'html', 'htm', 'md', 'svg', 'xml', 'yml', 'yaml', 'txt', 'py', 'map', 'example'
) | ForEach-Object { [void]$extSet.Add('.' + $_) }
$exactNames = [System.Collections.Generic.HashSet[string]]::new([StringComparer]::OrdinalIgnoreCase)
@(
  '.gitattributes', '.editorconfig', '.prettierrc', '.babelrc', '.npmrc', '.nvmrc',
  'Dockerfile', 'Makefile', 'LICENSE', 'LICENSE.md'
) | ForEach-Object { [void]$exactNames.Add($_) }

function ShouldProcess([string]$fullPath) {
  foreach ($s in $skipSubstrings) {
    if ($fullPath -like ('*' + $s + '*')) { return $false }
  }
  $name = [System.IO.Path]::GetFileName($fullPath)
  if ($exactNames.Contains($name)) { return $true }
  if ($name -like '.env*') { return $true }
  if ($name -match 'utf8fix$') { return $true }
  $ext = [System.IO.Path]::GetExtension($fullPath)
  if ([string]::IsNullOrEmpty($ext)) { return $false }
  return $extSet.Contains($ext)
}

$utf8 = New-Object System.Text.UTF8Encoding $false
$count = 0
Get-ChildItem -LiteralPath $root -Recurse -File -ErrorAction SilentlyContinue |
  Where-Object { ShouldProcess $_.FullName } |
  ForEach-Object {
    $p = $_.FullName
    try {
      $bytes = [System.IO.File]::ReadAllBytes($p)
      if ($bytes.Length -eq 0) { return }
      $start = 0
      if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) {
        $start = 3
      }
      $slice = if ($start -gt 0) { $bytes[$start..($bytes.Length - 1)] } else { $bytes }
      $text = [System.Text.Encoding]::UTF8.GetString($slice)
      $norm = $text -replace "`r`n", "`n" -replace "`r", "`n"
      [System.IO.File]::WriteAllText($p, $norm, $utf8)
      $count++
    }
    catch {
      Write-Warning ("Skip {0}: {1}" -f $p, $_)
    }
  }

Write-Host ("Normalized {0} files under {1}" -f $count, $root)
