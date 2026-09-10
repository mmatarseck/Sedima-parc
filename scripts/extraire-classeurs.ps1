# Extrait chaque feuille d'un classeur Excel en JSON — une ligne du tableau,
# un tableau de cellules. Sert à lire les listes du dossier DO sans les ouvrir
# à la main, et sans jamais les modifier (ouverture en lecture seule).
#
# Usage : .\scripts\extraire-classeurs.ps1 -Classeur "<chemin.xlsx>" -Sortie "<dossier>"
param([Parameter(Mandatory)][string]$Classeur, [Parameter(Mandatory)][string]$Sortie)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force $Sortie | Out-Null
$excel = New-Object -ComObject Excel.Application
$excel.Visible = $false
$excel.DisplayAlerts = $false
try {
  # Le troisième argument à $true : lecture seule. Le classeur du dossier
  # partagé ne doit ressortir ni modifié ni verrouillé.
  $wb = $excel.Workbooks.Open($Classeur, 0, $true)
  $resume = @()
  foreach ($ws in $wb.Worksheets) {
    $plage = $ws.UsedRange
    $nl = $plage.Rows.Count
    $nc = $plage.Columns.Count
    if ($nl -lt 1 -or $nc -lt 1) { continue }
    $valeurs = $plage.Value2
    $lignes = @()
    for ($i = 1; $i -le $nl; $i++) {
      $ligne = @()
      for ($j = 1; $j -le $nc; $j++) {
        $v = if ($nl -eq 1 -and $nc -eq 1) { $valeurs } else { $valeurs.GetValue($i, $j) }
        if ($null -eq $v) { $ligne += $null }
        elseif ($v -is [double]) { $ligne += $v }
        else { $ligne += ([string]$v).Trim() }
      }
      # Une ligne entièrement vide ne dit rien : elle ne sort pas.
      if (($ligne | Where-Object { $_ -ne $null -and $_ -ne "" }).Count -gt 0) { $lignes += , $ligne }
    }
    $nom = ($ws.Name -replace '[\\/:*?"<>|]', '_')
    $lignes | ConvertTo-Json -Depth 4 -Compress | Set-Content (Join-Path $Sortie "$nom.json") -Encoding UTF8
    $resume += "{0,-34} {1,5} lignes x {2,3} colonnes" -f $ws.Name, $lignes.Count, $nc
  }
  $wb.Close($false)
  $resume
} finally {
  $excel.Quit()
  [System.Runtime.InteropServices.Marshal]::ReleaseComObject($excel) | Out-Null
}
