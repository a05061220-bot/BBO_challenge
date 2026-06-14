param(
    [string]$SourceRoot = (Join-Path $PSScriptRoot 'cpbl-opendata\cpbl-opendata-master'),
    [string]$OutputPath = (Join-Path $PSScriptRoot 'BBO_Search\bbo-data.js'),
    [int]$MinYear = 1990,
    [int]$MaxYear = 2024
)

$ErrorActionPreference = 'Stop'

function To-Number {
    param($Value)
    if ($null -eq $Value -or $Value -eq '') { return 0.0 }
    return [double]$Value
}

function Clamp {
    param([double]$Value, [double]$Min = 0, [double]$Max = 1)
    return [Math]::Max($Min, [Math]::Min($Max, $Value))
}

function Divide {
    param([double]$Numerator, [double]$Denominator)
    if ($Denominator -le 0) { return 0.0 }
    return $Numerator / $Denominator
}

function Get-PercentileMap {
    param(
        [object[]]$Rows,
        [scriptblock]$Value,
        [switch]$LowerIsBetter
    )

    $items = @($Rows | ForEach-Object {
        [pscustomobject]@{ Key = $_._key; Value = [double](& $Value $_) }
    } | Sort-Object Value)

    $result = @{}
    if ($items.Count -eq 0) { return $result }
    if ($items.Count -eq 1) {
        $result[$items[0].Key] = 0.5
        return $result
    }

    for ($i = 0; $i -lt $items.Count; $i++) {
        $percentile = $i / ($items.Count - 1)
        if ($LowerIsBetter) { $percentile = 1 - $percentile }
        $result[$items[$i].Key] = $percentile
    }
    return $result
}

function To-Ability {
    param([double]$Percentile, [double]$Reliability = 1)
    $adjusted = 0.5 + (($Percentile - 0.5) * (Clamp $Reliability 0.2 1))
    return [int][Math]::Round(60 + (40 * (Clamp $adjusted)))
}

function To-CappedAbility {
    param(
        [double]$Percentile,
        [double]$Reliability,
        [int]$Cap
    )

    $adjusted = 0.5 + (($Percentile - 0.5) * (Clamp $Reliability 0.2 1))
    $curved = [Math]::Pow((Clamp $adjusted), 1.65)
    $floor = [Math]::Max(60, $Cap - 18)
    return [int][Math]::Round($floor + (($Cap - $floor) * $curved))
}

function To-BoundedAbility {
    param(
        [double]$Percentile,
        [double]$Reliability,
        [int]$Floor,
        [int]$Cap
    )

    $adjusted = 0.5 + (($Percentile - 0.5) * (Clamp $Reliability 0.2 1))
    $curved = [Math]::Pow((Clamp $adjusted), 1.15)
    return [int][Math]::Round($Floor + (($Cap - $Floor) * $curved))
}

function Get-CardType {
    param(
        [double]$OverallPercentile,
        [bool]$IsPurple = $false
    )
    if ($IsPurple) { return [string][char]0x7D2B }
    if ($OverallPercentile -ge 0.85) { return [string][char]0x7D05 }
    if ($OverallPercentile -ge 0.50) { return [string][char]0x9EC3 }
    return [string][char]0x85CD
}

function Get-HitterAbilityCap {
    param(
        [string]$CardType,
        [string]$Ability
    )

    $caps = switch ([int]$CardType[0]) {
        0x7D2B { @{ power = 92; contact = 94; speed = 95; fielding = 92; arm = 92 } }
        0x7D05 { @{ power = 86; contact = 86; speed = 90; fielding = 85; arm = 85 } }
        0x9EC3 { @{ power = 84; contact = 83; speed = 86; fielding = 80; arm = 80 } }
        default { @{ power = 80; contact = 80; speed = 80; fielding = 75; arm = 75 } }
    }
    return $caps[$Ability]
}

function Get-HitterPowerContactCap {
    param([string]$CardType)

    switch ([int]$CardType[0]) {
        0x7D2B { return 170 }
        0x7D05 { return 160 }
        0x9EC3 { return 155 }
        default { return 150 }
    }
}

function Get-HitterDefenseFloor {
    param([string]$CardType)

    switch ([int]$CardType[0]) {
        0x7D2B { return 86 }
        0x7D05 { return 79 }
        0x9EC3 { return 74 }
        default { return 68 }
    }
}

function Get-TopKeys {
    param(
        [object[]]$Rows,
        [scriptblock]$Value,
        [int]$Count
    )

    $result = @{}
    @($Rows | Sort-Object { [double](& $Value $_) } -Descending | Select-Object -First $Count) |
        ForEach-Object { $result[$_._key] = $true }
    return $result
}

function Apply-HitterPowerContactCap {
    param(
        [string]$CardType,
        [int]$Power,
        [int]$Contact,
        [int]$Fielding,
        [int]$Arm,
        [string]$Preferred
    )

    $totalCap = Get-HitterPowerContactCap $CardType
    $overflow = [Math]::Max(0, ($Power + $Contact) - $totalCap)
    $pointsToTransfer = $overflow

    while ($overflow -gt 0 -and ($Power + $Contact) -gt $totalCap) {
        if ($Power -ge $Contact -and $Power -gt 60) {
            $Power--
        } elseif ($Contact -gt 60) {
            $Contact--
        } else {
            break
        }
        $overflow--
    }

    $fieldingCap = Get-HitterAbilityCap $CardType 'fielding'
    $armCap = Get-HitterAbilityCap $CardType 'arm'
    while ($pointsToTransfer -gt 0 -and ($Fielding -lt $fieldingCap -or $Arm -lt $armCap)) {
        if ($Fielding -le $Arm -and $Fielding -lt $fieldingCap) {
            $Fielding++
        } elseif ($Arm -lt $armCap) {
            $Arm++
        } elseif ($Fielding -lt $fieldingCap) {
            $Fielding++
        }
        $pointsToTransfer--
    }

    $powerCap = Get-HitterAbilityCap $CardType 'power'
    $contactCap = Get-HitterAbilityCap $CardType 'contact'
    while ([Math]::Abs($Power - $Contact) -le 6) {
        if ($Preferred -eq 'power') {
            if ($Contact -gt 60) { $Contact-- }
            elseif ($Power -lt $powerCap) { $Power++ }
            else { break }
        } else {
            if ($Power -gt 60) { $Power-- }
            elseif ($Contact -lt $contactCap) { $Contact++ }
            else { break }
        }
    }

    return @{
        power = $Power
        contact = $Contact
        fielding = $Fielding
        arm = $Arm
    }
}

function Apply-PurpleDefenseTotalCap {
    param(
        [string]$CardType,
        [int]$Fielding,
        [int]$Arm
    )

    if ([int]$CardType[0] -ne 0x7D2B) {
        return @{ fielding = $Fielding; arm = $Arm }
    }

    while (($Fielding + $Arm) -gt 178) {
        if ($Fielding -ge $Arm -and $Fielding -gt 86) {
            $Fielding--
        } elseif ($Arm -gt 86) {
            $Arm--
        } else {
            break
        }
    }

    return @{ fielding = $Fielding; arm = $Arm }
}

function Get-PitcherAbilityCap {
    param(
        [string]$CardType,
        [string]$Role,
        [string]$Ability
    )

    $caps = switch ([int]$CardType[0]) {
        0x7D2B { @{ stamina = 97; control = 96; velocity = 93; breaking = 93 } }
        0x7D05 { @{ stamina = 88; control = 93; velocity = 86; breaking = 86 } }
        0x9EC3 { @{ stamina = 84; control = 86; velocity = 82; breaking = 80 } }
        default { @{ stamina = 80; control = 80; velocity = 78; breaking = 75 } }
    }

    if ($Role -in @('RP', 'CP')) {
        $caps.stamina = [Math]::Min($caps.stamina, 70)
        $caps.velocity += 2
        $caps.breaking += 2
    }

    return $caps[$Ability]
}

function Get-HitterPositions {
    param([object[]]$Rows)

    $positions = @()
    foreach ($row in @($Rows | Sort-Object { To-Number $_.G } -Descending)) {
        $position = [string]$row.POS
        if ($position -in @('LF', 'CF', 'RF')) { $position = 'OF' }
        if ($position -and $position -notin @('P', 'PH', 'PR') -and $positions -notcontains $position) {
            $positions += $position
        }
    }
    if ($positions.Count -eq 0) { return @('DH') }
    return @($positions | Select-Object -First 3)
}

function Add-Percentiles {
    param(
        [object[]]$Rows,
        [hashtable]$Metrics
    )
    foreach ($metricName in $Metrics.Keys) {
        $definition = $Metrics[$metricName]
        $map = Get-PercentileMap -Rows $Rows -Value $definition.Value -LowerIsBetter:$definition.LowerIsBetter
        foreach ($row in $Rows) {
            $row | Add-Member -NotePropertyName "_$metricName" -NotePropertyValue $map[$row._key]
        }
    }
}

$cpblRoot = Join-Path $SourceRoot 'CPBL'
if (-not (Test-Path $cpblRoot)) {
    throw "cpbl-opendata not found at $SourceRoot"
}

$players = Import-Csv -Encoding UTF8 (Join-Path $SourceRoot 'players.csv')
$handedness = @{}
foreach ($player in $players) { $handedness[$player.ID] = $player.Handedness }

$result = [System.Collections.Generic.List[object]]::new()

for ($year = $MinYear; $year -le $MaxYear; $year++) {
    $battingPath = Join-Path $cpblRoot "battings\$year.csv"
    $pitchingPath = Join-Path $cpblRoot "pitchings\$year.csv"
    $fieldingPath = Join-Path $cpblRoot "fieldings\$year.csv"
    if (-not (Test-Path $battingPath) -or -not (Test-Path $pitchingPath)) { continue }

    Write-Host "Generating $year..."
    $fieldings = if (Test-Path $fieldingPath) { @(Import-Csv -Encoding UTF8 $fieldingPath) } else { @() }
    $fieldingByPlayerTeam = @{}
    foreach ($fielding in $fieldings) {
        $key = "$($fielding.ID)|$($fielding.'Team ID')"
        if (-not $fieldingByPlayerTeam.ContainsKey($key)) {
            $fieldingByPlayerTeam[$key] = [System.Collections.Generic.List[object]]::new()
        }
        $fieldingByPlayerTeam[$key].Add($fielding)
    }

    $hitters = @(Import-Csv -Encoding UTF8 $battingPath | Where-Object { (To-Number $_.PA) -ge 20 })
    foreach ($row in $hitters) {
        $row | Add-Member -NotePropertyName _key -NotePropertyValue "$($row.ID)|$($row.'Team ID')"
        $fieldRows = @($fieldingByPlayerTeam[$row._key])
        $tc = ($fieldRows | Measure-Object -Property TC -Sum).Sum
        $errors = ($fieldRows | Measure-Object -Property E -Sum).Sum
        $assists = ($fieldRows | Measure-Object -Property A -Sum).Sum
        $fieldGames = ($fieldRows | Measure-Object -Property G -Maximum).Maximum
        $row | Add-Member -NotePropertyName _fieldRows -NotePropertyValue $fieldRows
        $row | Add-Member -NotePropertyName _fieldPercent -NotePropertyValue (Divide ($tc - $errors) $tc)
        $row | Add-Member -NotePropertyName _assistsPerGame -NotePropertyValue (Divide $assists $fieldGames)
    }

    Add-Percentiles $hitters @{
        iso = @{ Value = { param($r) Divide ((To-Number $r.TB) - (To-Number $r.H)) (To-Number $r.AB) } }
        hrRate = @{ Value = { param($r) Divide (To-Number $r.HR) (To-Number $r.PA) } }
        xbhRate = @{ Value = { param($r) Divide ((To-Number $r.'2B') + (To-Number $r.'3B') + (To-Number $r.HR)) (To-Number $r.PA) } }
        avg = @{ Value = { param($r) Divide (To-Number $r.H) (To-Number $r.AB) } }
        onBase = @{ Value = { param($r) Divide ((To-Number $r.H) + (To-Number $r.BB) + (To-Number $r.HBP)) ((To-Number $r.AB) + (To-Number $r.BB) + (To-Number $r.HBP) + (To-Number $r.SF)) } }
        strikeoutRate = @{ Value = { param($r) Divide (To-Number $r.SO) (To-Number $r.PA) }; LowerIsBetter = $true }
        stealRate = @{ Value = { param($r) Divide ((To-Number $r.SB) + (0.5 * (To-Number $r.'3B'))) (To-Number $r.PA) } }
        runsRate = @{ Value = { param($r) Divide (To-Number $r.R) (To-Number $r.PA) } }
        fieldRate = @{ Value = { param($r) $r._fieldPercent } }
        assistRate = @{ Value = { param($r) $r._assistsPerGame } }
    }

    foreach ($row in $hitters) {
        $reliability = Clamp (Divide (To-Number $row.PA) 400) 0.25 1
        $powerP = (0.55 * $row._iso) + (0.30 * $row._hrRate) + (0.15 * $row._xbhRate)
        $contactP = (0.55 * $row._avg) + (0.25 * $row._onBase) + (0.20 * $row._strikeoutRate)
        $speedP = (0.70 * $row._stealRate) + (0.30 * $row._runsRate)
        $fieldP = (0.75 * $row._fieldRate) + (0.25 * $row._assistRate)
        $armP = (0.75 * $row._assistRate) + (0.25 * $row._fieldRate)
        $overallP = (0.25 * $powerP) + (0.30 * $contactP) + (0.15 * $speedP) + (0.18 * $fieldP) + (0.12 * $armP)
        $row | Add-Member -NotePropertyName _reliability -NotePropertyValue $reliability
        $row | Add-Member -NotePropertyName _powerP -NotePropertyValue $powerP
        $row | Add-Member -NotePropertyName _contactP -NotePropertyValue $contactP
        $row | Add-Member -NotePropertyName _speedP -NotePropertyValue $speedP
        $row | Add-Member -NotePropertyName _fieldP -NotePropertyValue $fieldP
        $row | Add-Member -NotePropertyName _armP -NotePropertyValue $armP
        $row | Add-Member -NotePropertyName _overallP -NotePropertyValue $overallP
    }
    $hitterOverallRanks = Get-PercentileMap -Rows $hitters -Value { param($r) $r._overallP }
    $purpleHitterKeys = Get-TopKeys -Rows $hitters -Value { param($r) $r._overallP } -Count 5

    foreach ($row in $hitters) {
        $cardType = Get-CardType $hitterOverallRanks[$row._key] ($purpleHitterKeys.ContainsKey($row._key))
        $power = To-CappedAbility $row._powerP $row._reliability (Get-HitterAbilityCap $cardType 'power')
        $contact = To-CappedAbility $row._contactP $row._reliability (Get-HitterAbilityCap $cardType 'contact')
        $defenseFloor = Get-HitterDefenseFloor $cardType
        $fielding = To-BoundedAbility $row._fieldP $row._reliability $defenseFloor (Get-HitterAbilityCap $cardType 'fielding')
        $arm = To-BoundedAbility $row._armP $row._reliability $defenseFloor (Get-HitterAbilityCap $cardType 'arm')
        $preferred = if ($row._powerP -ge $row._contactP) { 'power' } else { 'contact' }
        $adjusted = Apply-HitterPowerContactCap $cardType $power $contact $fielding $arm $preferred
        $defenseAdjusted = Apply-PurpleDefenseTotalCap $cardType $adjusted.fielding $adjusted.arm
        $result.Add([pscustomobject][ordered]@{
            id = "cpbl-$year-$($row.ID)-$($row.'Team ID')-h"
            source = 'cpbl-opendata-derived'
            type = 'hitter'
            team = $row.'Team Name'
            year = $year
            name = $row.Name
            cardType = $cardType
            positions = @(Get-HitterPositions $row._fieldRows)
            power = $adjusted.power
            contact = $adjusted.contact
            speed = To-CappedAbility $row._speedP $row._reliability (Get-HitterAbilityCap $cardType 'speed')
            fielding = $defenseAdjusted.fielding
            arm = $defenseAdjusted.arm
            hittingHand = $handedness[$row.ID]
            plateAppearances = [int](To-Number $row.PA)
        })
    }

    $pitchers = @(Import-Csv -Encoding UTF8 $pitchingPath | Where-Object { (To-Number $_.BF) -ge 20 })
    foreach ($row in $pitchers) {
        $row | Add-Member -NotePropertyName _key -NotePropertyValue "$($row.ID)|$($row.'Team ID')"
    }
    Add-Percentiles $pitchers @{
        startLoad = @{ Value = { param($r) (To-Number $r.GS) + (Divide (To-Number $r.IP) 6) } }
        workload = @{ Value = { param($r) To-Number $r.IP } }
        walkRate = @{ Value = { param($r) Divide ((To-Number $r.BB) + (To-Number $r.HBP)) (To-Number $r.BF) }; LowerIsBetter = $true }
        strikeoutRate = @{ Value = { param($r) Divide (To-Number $r.SO) (To-Number $r.BF) } }
        hitRate = @{ Value = { param($r) Divide (To-Number $r.H) (To-Number $r.BF) }; LowerIsBetter = $true }
        homeRunRate = @{ Value = { param($r) Divide (To-Number $r.HR) (To-Number $r.BF) }; LowerIsBetter = $true }
        earnedRunRate = @{ Value = { param($r) Divide (To-Number $r.ER) (To-Number $r.IP) }; LowerIsBetter = $true }
        groundBallRate = @{ Value = { param($r) Divide (To-Number $r.GO) ((To-Number $r.GO) + (To-Number $r.FO)) } }
        kbb = @{ Value = { param($r) Divide (To-Number $r.SO) ([Math]::Max(1, (To-Number $r.BB))) } }
    }

    foreach ($row in $pitchers) {
        $reliability = Clamp (Divide (To-Number $row.BF) 300) 0.25 1
        $staminaP = (0.65 * $row._startLoad) + (0.35 * $row._workload)
        $controlP = (0.75 * $row._walkRate) + (0.25 * $row._kbb)
        $velocityP = (0.55 * $row._strikeoutRate) + (0.30 * $row._hitRate) + (0.15 * $row._homeRunRate)
        $breakingP = (0.40 * $row._kbb) + (0.30 * $row._groundBallRate) + (0.30 * $row._earnedRunRate)
        $overallP = (0.20 * $staminaP) + (0.30 * $controlP) + (0.25 * $velocityP) + (0.25 * $breakingP)
        $role = if ((To-Number $row.GS) -ge [Math]::Max(3, (To-Number $row.GR))) { 'SP' } elseif ((To-Number $row.SV) -ge [Math]::Max(3, (To-Number $row.HLD))) { 'CP' } else { 'RP' }
        $row | Add-Member -NotePropertyName _reliability -NotePropertyValue $reliability
        $row | Add-Member -NotePropertyName _staminaP -NotePropertyValue $staminaP
        $row | Add-Member -NotePropertyName _controlP -NotePropertyValue $controlP
        $row | Add-Member -NotePropertyName _velocityP -NotePropertyValue $velocityP
        $row | Add-Member -NotePropertyName _breakingP -NotePropertyValue $breakingP
        $row | Add-Member -NotePropertyName _overallP -NotePropertyValue $overallP
        $row | Add-Member -NotePropertyName _role -NotePropertyValue $role
    }
    $pitcherOverallRanks = Get-PercentileMap -Rows $pitchers -Value { param($r) $r._overallP }
    $purplePitcherKeys = Get-TopKeys -Rows $pitchers -Value { param($r) $r._overallP } -Count 5

    foreach ($row in $pitchers) {
        $cardType = Get-CardType $pitcherOverallRanks[$row._key] ($purplePitcherKeys.ContainsKey($row._key))
        $result.Add([pscustomobject][ordered]@{
            id = "cpbl-$year-$($row.ID)-$($row.'Team ID')-p"
            source = 'cpbl-opendata-derived'
            type = 'pitcher'
            team = $row.'Team Name'
            year = $year
            name = $row.Name
            cardType = $cardType
            role = $row._role
            roles = @($row._role)
            stamina = To-CappedAbility $row._staminaP $row._reliability (Get-PitcherAbilityCap $cardType $row._role 'stamina')
            control = To-CappedAbility $row._controlP $row._reliability (Get-PitcherAbilityCap $cardType $row._role 'control')
            velocity = To-CappedAbility $row._velocityP $row._reliability (Get-PitcherAbilityCap $cardType $row._role 'velocity')
            breaking = To-CappedAbility $row._breakingP $row._reliability (Get-PitcherAbilityCap $cardType $row._role 'breaking')
            throwType = $handedness[$row.ID]
            battersFaced = [int](To-Number $row.BF)
        })
    }
}

$json = $result | ConvertTo-Json -Depth 8 -Compress
[System.IO.File]::WriteAllText($OutputPath, "window.BBOImportedDraft = $json;", [System.Text.UTF8Encoding]::new($false))
Write-Host "Exported $($result.Count) players to $OutputPath"
