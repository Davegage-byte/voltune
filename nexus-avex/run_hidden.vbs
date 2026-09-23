Option Explicit
Dim shell, localAppData, repo, pythonExe, runner, command
Set shell = CreateObject("WScript.Shell")
localAppData = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
repo = localAppData & "\AVEX-NEXUS\voltune"
pythonExe = localAppData & "\AVEX-NEXUS\venv\Scripts\pythonw.exe"
runner = repo & "\nexus-avex\avex_nexus_runner.py"
command = Chr(34) & pythonExe & Chr(34) & " " & Chr(34) & runner & Chr(34) & " --once"
shell.Run command, 0, False
