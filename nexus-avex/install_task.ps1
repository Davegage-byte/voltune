param(
    [Parameter(Mandatory = $true)]
    [string]$Launcher
)

$ErrorActionPreference = "Stop"
$taskName = "AVEX NEXUS Collector"

if (-not (Test-Path -LiteralPath $Launcher)) {
    throw "Launcher nicht gefunden: $Launcher"
}

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument ('"' + $Launcher + '"')
$trigger = New-ScheduledTaskTrigger -Once -At ((Get-Date).AddMinutes(1)) -RepetitionInterval (New-TimeSpan -Minutes 5) -RepetitionDuration (New-TimeSpan -Days 3650)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Minutes 4) -MultipleInstances IgnoreNew

$userId = if ($env:USERDOMAIN) {
    "$env:USERDOMAIN\$env:USERNAME"
} else {
    $env:USERNAME
}

$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description "AVEX Euskirchen Datenabruf alle 5 Minuten vom NEXUS-Laptop" -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Host "Windows-Aufgabe '$taskName' wurde erstellt und gestartet."
