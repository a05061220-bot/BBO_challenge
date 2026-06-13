$ErrorActionPreference = 'Stop'

$databasePath = Join-Path $PSScriptRoot 'BBODB.accdb'
$outputPath = Join-Path $PSScriptRoot 'bbo-data.js'

function Get-TableRows {
    param(
        [System.Data.OleDb.OleDbConnection]$Connection,
        [string]$TableName
    )

    $command = $Connection.CreateCommand()
    $command.CommandText = "SELECT * FROM [$TableName]"
    $reader = $command.ExecuteReader()
    $table = New-Object System.Data.DataTable
    $table.Load($reader)
    $reader.Close()
    return $table
}

function Read-TableRows {
    param(
        [System.Data.OleDb.OleDbConnection]$Connection,
        [string]$TableName,
        [string[]]$Columns
    )

    $command = $Connection.CreateCommand()
    $command.CommandText = "SELECT * FROM [$TableName]"
    $reader = $command.ExecuteReader()
    $ordinals = @{}
    foreach ($column in $Columns) {
        $ordinals[$column] = $reader.GetOrdinal($column)
    }

    $rows = @()
    while ($reader.Read()) {
        $item = [ordered]@{}
        foreach ($column in $Columns) {
            $value = $reader.GetValue($ordinals[$column])
            if ($value -is [DBNull]) {
                $item[$column] = $null
            } else {
                $item[$column] = $value
            }
        }

        $rows += [pscustomobject]$item
    }

    $reader.Close()
    return $rows
}

function To-Int {
    param($Value)
    try {
        return [int]$Value
    } catch {
        return 0
    }
}

function Clean-Text {
    param($Value)
    if ($null -eq $Value) { return '' }
    return ([string]$Value).Trim()
}

function Normalize-Position {
    param($Value)

    $text = Clean-Text $Value
    if ([string]::IsNullOrWhiteSpace($text) -or $text -eq '0' -or $text -eq '-') {
        return $null
    }

    switch ($text) {
        'LF' { 'OF' }
        'CF' { 'OF' }
        'RF' { 'OF' }
        default { $text }
    }
}

function Get-UniquePositions {
    param([object[]]$Values)

    $result = @()
    foreach ($value in $Values) {
        $normalized = Normalize-Position $value
        if ($normalized -and ($result -notcontains $normalized)) {
            $result += $normalized
        }
    }

    return $result
}

$connectionString = "Provider=Microsoft.ACE.OLEDB.12.0;Data Source=$databasePath;Persist Security Info=False;"
$connection = New-Object System.Data.OleDb.OleDbConnection($connectionString)
$connection.Open()

$players = @()

$hitters = Read-TableRows -Connection $connection -TableName 'CPBL' -Columns @(
    'Team', 'Card_Year', 'Card_Name', 'Card_Type', 'Card_Weather_1', 'Card_Weather_2',
    'Card_Position_1', 'Card_Position_2', 'Power', 'Batting', 'Speed', 'Defense', 'Throw',
    'Hitting', 'Level_Up', 'Potential_1', 'Potential_2', 'Potential_3', 'Potential_V'
)
Write-Host "CPBL rows: $($hitters.Count)"
$hitterIndex = 0
foreach ($row in $hitters) {
    $players += [pscustomobject]@{
        id = "cpbl-$hitterIndex"
        source = 'CPBL'
        type = 'hitter'
        team = Clean-Text $row.Team
        year = To-Int $row.Card_Year
        name = Clean-Text $row.Card_Name
        cardType = Clean-Text $row.Card_Type
        weather = @() + @((Clean-Text $row.Card_Weather_1), (Clean-Text $row.Card_Weather_2))
        positions = @() + (Get-UniquePositions @($row.Card_Position_1, $row.Card_Position_2))
        power = To-Int $row.Power
        contact = To-Int $row.Batting
        speed = To-Int $row.Speed
        fielding = To-Int $row.Defense
        arm = To-Int $row.Throw
        hittingHand = Clean-Text $row.Hitting
        levelUp = Clean-Text $row.Level_Up
        potentials = @() + @((Clean-Text $row.Potential_1), (Clean-Text $row.Potential_2), (Clean-Text $row.Potential_3), (Clean-Text $row.Potential_V))
    }

    $hitterIndex++
}

$pitchers = Read-TableRows -Connection $connection -TableName 'P_CPBL' -Columns @(
    'Team', 'Card_Year', 'Card_Name', 'Card_Type', 'Card_Weather_1', 'Card_Weather_2',
    'Card_Position_1', 'Card_Position_2', 'Card_Stamina', 'Card_Control', 'S_Type', 'S_Num',
    'W_Type', 'W_Num', 'A_Type', 'A_Num', 'D_Type', 'D_Num', 'C_Type', 'C_Num', 'X_Type', 'X_Num',
    'Z_Type', 'Z_Num', 'F_Type', 'F_Num', 'Throw_Type', 'Level_Up', 'Potential_1', 'Potential_2',
    'Potential_3', 'Potential_V'
)
Write-Host "P_CPBL rows: $($pitchers.Count)"
$pitcherIndex = 0
foreach ($row in $pitchers) {
    $roles = @()
    foreach ($candidateRole in @($row.Card_Position_1, $row.Card_Position_2)) {
        $cleanRole = Clean-Text $candidateRole
        if ($cleanRole -in @('SP', 'CP', 'RP') -and ($roles -notcontains $cleanRole)) {
            $roles += $cleanRole
        }
    }
    if ($roles.Count -eq 0) {
        continue
    }

    $pitchNumValues = @(
        To-Int $row.S_Num,
        To-Int $row.W_Num,
        To-Int $row.A_Num,
        To-Int $row.D_Num,
        To-Int $row.C_Num,
        To-Int $row.X_Num,
        To-Int $row.Z_Num,
        To-Int $row.F_Num
    ) | Where-Object { $_ -gt 0 }

    $breaking = 0
    if ($pitchNumValues.Count -gt 0) {
        $breaking = [int][Math]::Round(($pitchNumValues | Measure-Object -Average).Average)
    }

    $players += [pscustomobject]@{
        id = "pcpbl-$pitcherIndex"
        source = 'P_CPBL'
        type = 'pitcher'
        team = Clean-Text $row.Team
        year = To-Int $row.Card_Year
        name = Clean-Text $row.Card_Name
        cardType = Clean-Text $row.Card_Type
        weather = @() + @((Clean-Text $row.Card_Weather_1), (Clean-Text $row.Card_Weather_2))
        roles = @() + $roles
        role = $roles[0]
        stamina = To-Int $row.Card_Stamina
        control = To-Int $row.Card_Control
        velocity = To-Int $row.S_Num
        breaking = $breaking
        throwType = Clean-Text $row.Throw_Type
        levelUp = Clean-Text $row.Level_Up
        potentials = @() + @((Clean-Text $row.Potential_1), (Clean-Text $row.Potential_2), (Clean-Text $row.Potential_3), (Clean-Text $row.Potential_V))
        pitchTypes = @(
            [pscustomobject]@{ type = Clean-Text $row.S_Type; num = To-Int $row.S_Num },
            [pscustomobject]@{ type = Clean-Text $row.W_Type; num = To-Int $row.W_Num },
            [pscustomobject]@{ type = Clean-Text $row.A_Type; num = To-Int $row.A_Num },
            [pscustomobject]@{ type = Clean-Text $row.D_Type; num = To-Int $row.D_Num },
            [pscustomobject]@{ type = Clean-Text $row.C_Type; num = To-Int $row.C_Num },
            [pscustomobject]@{ type = Clean-Text $row.X_Type; num = To-Int $row.X_Num },
            [pscustomobject]@{ type = Clean-Text $row.Z_Type; num = To-Int $row.Z_Num },
            [pscustomobject]@{ type = Clean-Text $row.F_Type; num = To-Int $row.F_Num }
        )
    }

    $pitcherIndex++
}

$connection.Close()

$json = $players | ConvertTo-Json -Depth 12
Set-Content -Path $outputPath -Value "window.BBOImportedDraft = $json;" -Encoding UTF8
Write-Host "Exported $($players.Count) players to $outputPath"
