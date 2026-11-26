# Launch the Prometheon gateway (reference copy).
# NOTE: API keys are set in the live copy on the Alienware only and are
# deliberately NOT stored in this repository copy.
$env:PYTHONUTF8='1'
$env:OPENROUTER_API_KEY=<set-on-alienware-only>
$env:DEEPSEEK_API_KEY=<set-on-alienware-only>
Set-Location C:\AI\prometheon-pilot
& C:\AI\envs\agents\.venv\Scripts\python.exe C:\AI\prometheon-pilot\gateway.py *> C:\AI\prometheon-pilot\gateway.log 2>&1
