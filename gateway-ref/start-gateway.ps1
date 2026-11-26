# Start the Prometheon gateway detached via WMI (survives the SSH session),
# following the stack's launch-*.ps1 pattern.
$cmd = "powershell -ExecutionPolicy Bypass -File C:\AI\prometheon-pilot\launch-gateway.ps1"
$res = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd }
Write-Output "WMI Create returned ReturnValue=$($res.ReturnValue) ProcessId=$($res.ProcessId)"
