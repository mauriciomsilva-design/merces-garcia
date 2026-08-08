$ErrorActionPreference = 'Stop'
$rules = @(
  @{ Name = 'Merces Garcia Presenca 3000'; Port = 3000 },
  @{ Name = 'Merces Garcia Biblioteca 3001'; Port = 3001 }
)
foreach ($r in $rules) {
  if (-not (Get-NetFirewallRule -DisplayName $r.Name -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $r.Name -Direction Inbound -Action Allow -Protocol TCP -LocalPort $r.Port -Profile Private | Out-Null
  }
}
Write-Host 'Firewall configurado para a rede privada nas portas 3000 e 3001.'
