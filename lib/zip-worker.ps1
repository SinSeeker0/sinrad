param([Parameter(Mandatory=$true)][ValidateSet('inspect','extract','pack')][string]$Mode,[Parameter(Mandatory=$true)][string]$Source,[string]$Destination)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
function SafeEntry([string]$Name,[string]$Root){
  $relative=$Name.Replace('\','/')
  if($relative.StartsWith('/') -or $relative.Contains(':') -or $relative.Split('/') -contains '..'){throw 'Unsafe ZIP entry path'}
  foreach($part in $relative.Split('/')){if($part -and ($part -match '[. ]$' -or $part -match '^(CON|PRN|AUX|NUL|COM[0-9]|LPT[0-9])(\.|$)')){throw 'Unsupported ZIP entry name'}}
  $target=[IO.Path]::GetFullPath([IO.Path]::Combine($Root,$relative))
  if(-not $target.StartsWith($Root+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){throw 'ZIP entry escapes output folder'}
  return $target
}
function WalkFiles([string]$Root){
  foreach($entry in Get-ChildItem -LiteralPath $Root -Force){
    if($entry.Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked files or folders cannot be archived'}
    if($entry.PSIsContainer){WalkFiles $entry.FullName}else{$entry}
  }
}
try{
  if($Mode -eq 'pack'){
    $sourceRoot=(Get-Item -LiteralPath $Source).FullName.TrimEnd('\','/')
    if((Get-Item -LiteralPath $Source).Attributes -band [IO.FileAttributes]::ReparsePoint){throw 'Linked folders cannot be archived'}
    $files=@(WalkFiles $sourceRoot);$hashes=@{};$prefix=[IO.Path]::GetFileName($sourceRoot)
    $stream=[IO.File]::Open($Destination,[IO.FileMode]::CreateNew,[IO.FileAccess]::ReadWrite)
    $zip=New-Object IO.Compression.ZipArchive($stream,[IO.Compression.ZipArchiveMode]::Create,$false)
    try{foreach($file in $files){
      $name=$prefix+'/'+$file.FullName.Substring($sourceRoot.Length+1).Replace('\','/')
      $entry=$zip.CreateEntry($name,[IO.Compression.CompressionLevel]::NoCompression)
      $inputStream=[IO.File]::OpenRead($file.FullName);$outputStream=$entry.Open()
      try{$inputStream.CopyTo($outputStream)}finally{$outputStream.Dispose();$inputStream.Dispose()}
      $hash=[Security.Cryptography.SHA256]::Create();$reader=[IO.File]::OpenRead($file.FullName)
      try{$hashes[$name]=[BitConverter]::ToString($hash.ComputeHash($reader)).Replace('-','')}finally{$reader.Dispose();$hash.Dispose()}
    }}finally{$zip.Dispose();$stream.Dispose()}
    $verify=[IO.Compression.ZipFile]::OpenRead($Destination)
    try{if($verify.Entries.Count -ne $files.Count){throw 'ZIP entry count failed verification'};foreach($entry in $verify.Entries){$reader=$entry.Open();$hash=[Security.Cryptography.SHA256]::Create();try{$actual=[BitConverter]::ToString($hash.ComputeHash($reader)).Replace('-','');if($actual -ne $hashes[$entry.FullName]){throw 'ZIP content failed verification'}}finally{$reader.Dispose();$hash.Dispose()}}}finally{$verify.Dispose()}
    @{ok=$true;files=$files.Count;verified=$true}|ConvertTo-Json -Compress
  }else{
    $zip=[IO.Compression.ZipFile]::OpenRead($Source)
    try{
      $root=if($Destination){[IO.Path]::GetFullPath($Destination).TrimEnd('\','/')}else{[IO.Path]::Combine([IO.Path]::GetTempPath(),'sinrad-zip-inspect')}
      $seen=New-Object 'System.Collections.Generic.HashSet[string]' ([StringComparer]::OrdinalIgnoreCase)
      [long]$total=0;$count=0
      foreach($entry in $zip.Entries){$target=SafeEntry $entry.FullName $root;if(-not $seen.Add($target)){throw 'ZIP has duplicate paths'};if((($entry.ExternalAttributes -shr 16) -band 61440) -eq 40960){throw 'ZIP contains a symbolic link'};$total+=$entry.Length;if($entry.Name){$count++}}
      if($Mode -eq 'extract'){
        if(Test-Path -LiteralPath $root){throw 'Extraction destination already exists'}
        [IO.Directory]::CreateDirectory($root)|Out-Null
        foreach($entry in $zip.Entries){$target=SafeEntry $entry.FullName $root;if(-not $entry.Name){[IO.Directory]::CreateDirectory($target)|Out-Null;continue};[IO.Directory]::CreateDirectory([IO.Path]::GetDirectoryName($target))|Out-Null;$inputStream=$entry.Open();$outputStream=[IO.File]::Open($target,[IO.FileMode]::CreateNew,[IO.FileAccess]::Write);try{$inputStream.CopyTo($outputStream);if($outputStream.Length -ne $entry.Length){throw 'Incomplete ZIP extraction'}}finally{$outputStream.Dispose();$inputStream.Dispose()}}
      }
      @{ok=$true;files=$count;bytes=$total}|ConvertTo-Json -Compress
    }finally{$zip.Dispose()}
  }
}catch{[Console]::Error.WriteLine($_.Exception.Message);exit 1}
