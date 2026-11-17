' Starts the Smart TallySync Pro connector with no window. Used by Install_Auto_Start.bat.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
sh.Run "cmd /c node tally-connector.js", 0, False
