param(
    [string]$OutputPath = (Join-Path $PSScriptRoot 'BBO_Search\tml-data.json'),
    [string]$MergedOutputPath = (Join-Path $PSScriptRoot 'BBO_Search\bbo-data.js'),
    [string]$CacheRoot = (Join-Path $PSScriptRoot 'tml-cache'),
    [switch]$Refresh
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$teamTitles = @('台北太陽隊', '台中金剛隊', '嘉南勇士隊', '高屏雷公隊')

function Num($v) {
    $n = 0.0
    $s = ([string]$v).Trim() -replace ',', ''
    if ([double]::TryParse($s, [ref]$n)) { return $n }
    return 0.0
}
function Div($a, $b) { if ((Num $b) -le 0) { return 0.0 }; return (Num $a) / (Num $b) }
function Clamp($v, $min = 0.0, $max = 1.0) { return [Math]::Max($min, [Math]::Min($max, $v)) }
function Innings($v) {
    $p = ([string]$v).Split('.')
    return (Num $p[0]) + $(if ($p.Count -gt 1) { (Num $p[1]) / 3 } else { 0 })
}
function Text($html) {
    return [Net.WebUtility]::HtmlDecode(($html -replace '(?is)<br\s*/?>', '' -replace '(?is)<[^>]+>', '')).Trim()
}
function Safe-Name($value) {
    return ([Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($value)) -replace '[/+=]', '_')
}
function Curl-Text($url) {
    for ($i = 1; $i -le 2; $i++) {
        $value = (& curl.exe --compressed -L --max-time 30 --retry 1 -A 'Mozilla/5.0' -s $url) -join "`n"
        if ($LASTEXITCODE -eq 0 -and $value.Length -gt 100) { return $value }
        Start-Sleep -Seconds $i
    }
    return $null
}
function Archive-Page($title) {
    if (-not (Test-Path $CacheRoot)) { New-Item -ItemType Directory $CacheRoot | Out-Null }
    $path = Join-Path $CacheRoot "$(Safe-Name $title).html"
    $missingPath = "$path.missing"
    if (-not $Refresh -and (Test-Path $missingPath)) { return $null }
    if (-not $Refresh -and (Test-Path $path) -and (Get-Item $path).Length -gt 1000) {
        return Get-Content -Raw -Encoding UTF8 $path
    }
    $encoded = [Uri]::EscapeDataString($title)
    $cdx = Curl-Text "https://web.archive.org/cdx/search/cdx?url=twbsball.dils.tku.edu.tw/wiki/index.php%3Ftitle%3D$encoded&output=json&filter=statuscode:200&fl=timestamp,original&collapse=digest"
    if (-not $cdx) { return $null }
    try { $rows = $cdx | ConvertFrom-Json } catch { return $null }
    $oldest = [Math]::Max(1, $rows.Count - 3)
    for ($i = $rows.Count - 1; $i -ge $oldest; $i--) {
        $page = Curl-Text "https://web.archive.org/web/$($rows[$i][0])id_/$($rows[$i][1])"
        if ($page -and ($page.Contains('台灣大聯盟') -or $page.Contains('歷屆成員'))) {
            [IO.File]::WriteAllText($path, $page, [Text.UTF8Encoding]::new($false))
            return $page
        }
    }
    [IO.File]::WriteAllText($missingPath, 'No usable Wayback snapshot', [Text.UTF8Encoding]::new($false))
    return $null
}
function Player-Links($html) {
    $start = $html.LastIndexOf('歷屆成員')
    $end = $html.IndexOf('隊史', $start + 4)
    $part = $html.Substring($start, $end - $start)
    $players = @{}
    foreach ($role in @('投手', '野手')) {
        foreach ($kind in @("本土$role", "外籍$role")) {
            $a = $part.IndexOf($kind)
            if ($a -lt 0) { continue }
            $b = $part.IndexOf('</li>', $a)
            foreach ($m in [regex]::Matches($part.Substring($a, $b - $a), '(?is)<a\b[^>]*href="/wiki/index\.php\?title=([^"&]+)[^"]*"[^>]*>(.*?)</a>')) {
                $title = [Net.WebUtility]::UrlDecode($m.Groups[1].Value)
                $name = (Text $m.Groups[2].Value) -replace '\s+', ''
                $players["$title|$role"] = [pscustomobject]@{ title=$title; name=$name; type=$(if($role -eq '投手'){'pitcher'}else{'hitter'}) }
            }
        }
    }
    return @($players.Values)
}
function Positions($html) {
    $m = [regex]::Match($html, '(?is)守備位置：(.*?)</li>')
    if (-not $m.Success) { return @('DH') }
    $s = Text $m.Groups[1].Value
    $map = [ordered]@{'捕手'='C';'一壘手'='1B';'二壘手'='2B';'三壘手'='3B';'游擊手'='SS';'外野手'='OF';'左外野手'='OF';'中外野手'='OF';'右外野手'='OF'}
    $out = @()
    foreach ($key in $map.Keys) { if ($s.Contains($key) -and $out -notcontains $map[$key]) { $out += $map[$key] } }
    if (-not $out.Count) { return @('DH') }
    return @($out | Select-Object -First 3)
}
function Team-Name($value) {
    if ($value -match '太陽') { return '台北太陽' }
    if ($value -match '金剛') { return '台中金剛' }
    if ($value -match '勇士') { return '嘉南勇士' }
    if ($value -match '雷公') { return '高屏雷公' }
    return $null
}
function Table-Rows($html, $type) {
    $marker = if ($type -eq 'pitcher') { '台灣大聯盟投球成績' } else { '台灣大聯盟打擊成績' }
    $mark = $html.IndexOf($marker)
    if ($mark -lt 0) { $mark = $html.IndexOf('台灣大聯盟成績') }
    if ($mark -lt 0) { return @() }
    $a = $html.IndexOf('<table', $mark)
    $b = $html.IndexOf('</table>', $a)
    if ($a -lt 0 -or $b -lt 0) { return @() }
    $out = @()
    foreach ($tr in [regex]::Matches($html.Substring($a, $b + 8 - $a), '(?is)<tr\b[^>]*>(.*?)</tr>')) {
        $cells = @([regex]::Matches($tr.Groups[1].Value, '(?is)<t[dh]\b[^>]*>(.*?)</t[dh]>') | ForEach-Object { Text $_.Groups[1].Value })
        if ($cells.Count) { $out += ,$cells }
    }
    return $out
}
function Parse-Player($player, $html) {
    $table = @(Table-Rows $html $player.type)
    if ($table.Count -lt 2) { return @() }
    $count = $table[0].Count
    $out = @()
    foreach ($input in @($table | Select-Object -Skip 1)) {
        $c = @($input)
        if ($c.Count -eq $count - 1) { $c = @($c[0],$c[1],'') + @($c | Select-Object -Skip 2) }
        if ($c.Count -lt $count -or $c.Count -lt 2 -or $c[0] -notmatch '^(199[7-9]|200[0-2])$') { continue }
        $team = Team-Name $c[1]
        if (-not $team) { continue }
        $key = "$($c[0])|$team|$($player.name)|$($player.type)"
        if ($player.type -eq 'hitter' -and $count -ge 25) {
            $out += [pscustomobject]@{key=$key;type='hitter';team=$team;year=[int]$c[0];name=$player.name;positions=@(Positions $html);G=Num $c[3];PA=Num $c[4];AB=Num $c[5];R=Num $c[6];H=Num $c[7];B2=Num $c[8];B3=Num $c[9];HR=Num $c[10];RBI=Num $c[12];SB=Num $c[13];BB=Num $c[16];SO=Num $c[19];AVG=Num $c[21];OBP=Num $c[22];SLG=Num $c[23]}
        } elseif ($player.type -eq 'hitter' -and $count -ge 18) {
            $out += [pscustomobject]@{key=$key;type='hitter';team=$team;year=[int]$c[0];name=$player.name;positions=@(Positions $html);G=Num $c[3];PA=Num $c[4];AB=Num $c[5];R=Num $c[6];H=Num $c[7];B2=Num $c[8];B3=Num $c[9];HR=Num $c[10];RBI=Num $c[11];SB=Num $c[12];BB=Num $c[13];SO=Num $c[14];AVG=Num $c[15];OBP=Num $c[16];SLG=Num $c[17]}
        } elseif ($player.type -eq 'pitcher' -and $count -ge 26) {
            $out += [pscustomobject]@{key=$key;type='pitcher';team=$team;year=[int]$c[0];name=$player.name;W=Num $c[3];L=Num $c[4];ERA=Num $c[6];G=Num $c[7];GS=Num $c[8];CG=Num $c[9];HLD=Num $c[11];SV=Num $c[12];BF=Num $c[13];IP=Innings $c[14];H=Num $c[15];HR=Num $c[16];BB=Num $c[17];HBP=Num $c[19];SO=Num $c[22];ER=Num $c[24];WHIP=Num $c[25]}
        } elseif ($player.type -eq 'pitcher' -and $count -ge 18) {
            $ip = Innings $c[12]
            $out += [pscustomobject]@{key=$key;type='pitcher';team=$team;year=[int]$c[0];name=$player.name;W=Num $c[3];L=Num $c[4];ERA=Num $c[5];G=Num $c[6];GS=Num $c[7];CG=Num $c[8];HLD=Num $c[10];SV=Num $c[11];BF=($ip*3+(Num $c[13])+(Num $c[15]));IP=$ip;H=Num $c[13];HR=Num $c[14];BB=Num $c[15];HBP=0;SO=Num $c[16];ER=((Num $c[5])*$ip/9);WHIP=Num $c[17]}
        }
    }
    return $out
}
function Pct($rows, $value, [switch]$low) {
    $items = @($rows | ForEach-Object { [pscustomobject]@{key=$_.key;value=[double](& $value $_)} } | Sort-Object value)
    $map = @{}
    for ($i=0; $i -lt $items.Count; $i++) {
        $p = if($items.Count -gt 1){$i/($items.Count-1)}else{0.5}
        $map[$items[$i].key] = if($low){1-$p}else{$p}
    }
    return $map
}
function Ability($p,$rel,$floor,$cap) {
    $x = 0.5 + (($p - 0.5) * (Clamp $rel 0.25 1))
    return [int][Math]::Round($floor + (($cap-$floor) * [Math]::Pow((Clamp $x),1.65)))
}
function Pitcher-Ability($p,$rel,$cap) {
    return Ability $p $rel ([Math]::Max(60, $cap - 18)) $cap
}
function Tier-Map($rows) {
    $sorted = @($rows | Sort-Object ov -Descending)
    $redCount = [Math]::Max(1, [Math]::Ceiling($sorted.Count * .12))
    $yellowCount = [Math]::Max(1, [Math]::Ceiling($sorted.Count * .35))
    $map = @{}
    for($i=0;$i-lt$sorted.Count;$i++){
        $map[$sorted[$i].key] = if($i-lt5){'紫'}elseif($i-lt(5+$redCount)){'紅'}elseif($i-lt(5+$redCount+$yellowCount)){'黃'}else{'藍'}
    }
    return $map
}
function HCaps($c) { switch($c){'紫'{@{p=92;c=94;s=95;f=92;a=92;min=86;sum=170}}'紅'{@{p=86;c=86;s=90;f=85;a=85;min=79;sum=160}}'黃'{@{p=84;c=83;s=86;f=80;a=80;min=74;sum=155}}default{@{p=80;c=80;s=80;f=75;a=75;min=68;sum=150}}} }
function PCaps($c,$role) {
    $x=switch($c){'紫'{@{st=97;co=96;v=93;b=93}}'紅'{@{st=88;co=93;v=86;b=86}}'黃'{@{st=84;co=86;v=82;b=80}}default{@{st=80;co=80;v=78;b=75}}}
    if($role-ne'SP'){$x.st=70;$x.v+=2;$x.b+=2};return $x
}
function Build-Hitters($rows) {
    if(-not $rows.Count){return @()}
    $iso=Pct $rows {param($r)$r.SLG-$r.AVG};$hr=Pct $rows {param($r)Div $r.HR $r.PA};$avg=Pct $rows {param($r)$r.AVG};$obp=Pct $rows {param($r)$r.OBP};$k=Pct $rows {param($r)Div $r.SO $r.PA} -low;$sb=Pct $rows {param($r)Div ($r.SB+.5*$r.B3) $r.PA}
    foreach($r in $rows){$r|Add-Member pwr (.65*$iso[$r.key]+.35*$hr[$r.key]);$r|Add-Member con (.65*$avg[$r.key]+.35*$obp[$r.key]);$r|Add-Member spd $sb[$r.key];$r|Add-Member ov (.34*$r.pwr+.41*$r.con+.25*$r.spd)}
    $rank=Pct $rows {param($r)$r.ov};$tiers=Tier-Map $rows;$out=@()
    foreach($r in $rows){$card=$tiers[$r.key];$cap=HCaps $card;$rel=Clamp (Div $r.PA 350) .25 1;$p=Ability $r.pwr $rel 60 $cap.p;$c=Ability $r.con $rel 60 $cap.c;while($p+$c-gt$cap.sum){if($p-ge$c){$p--}else{$c--}};while([Math]::Abs($p-$c)-le6){if($r.pwr-ge$r.con){$c--}else{$p--}};$f=Ability (.55*$rank[$r.key]+.45*$r.spd) $rel $cap.min $cap.f;$a=Ability (.65*$rank[$r.key]+.35*$r.pwr) $rel $cap.min $cap.a;while($card-eq'紫'-and$f+$a-gt178){if($f-ge$a){$f--}else{$a--}}
        $out += [pscustomobject][ordered]@{id="tml-$($r.year)-$([Math]::Abs($r.key.GetHashCode()))-h";source='twbsball-wayback-derived';league='TML';type='hitter';team=$r.team;year=$r.year;name=$r.name;cardType=$card;positions=@($r.positions);power=$p;contact=$c;speed=Ability $r.spd $rel 60 $cap.s;fielding=$f;arm=$a;plateAppearances=[int]$r.PA}
    };return $out
}
function Build-Pitchers($rows) {
    if(-not $rows.Count){return @()}
    $start=Pct $rows {param($r)$r.GS+(Div $r.IP 6)};$work=Pct $rows {param($r)$r.IP};$bb=Pct $rows {param($r)Div ($r.BB+$r.HBP) $r.BF} -low;$kk=Pct $rows {param($r)Div $r.SO $r.BF};$hit=Pct $rows {param($r)Div $r.H $r.BF} -low;$era=Pct $rows {param($r)$r.ERA} -low;$whip=Pct $rows {param($r)$r.WHIP} -low
    foreach($r in $rows){$r|Add-Member sta (.65*$start[$r.key]+.35*$work[$r.key]);$r|Add-Member ctl (.75*$bb[$r.key]+.25*$kk[$r.key]);$r|Add-Member vel (.6*$kk[$r.key]+.4*$hit[$r.key]);$r|Add-Member brk (.5*$whip[$r.key]+.5*$era[$r.key]);$r|Add-Member ov (.2*$r.sta+.3*$r.ctl+.25*$r.vel+.25*$r.brk)}
    $tiers=Tier-Map $rows;$out=@()
    foreach($r in $rows){$role=if($r.GS-ge[Math]::Max(3,$r.G-$r.GS)){'SP'}elseif($r.SV-ge3){'CP'}else{'RP'};$card=$tiers[$r.key];$cap=PCaps $card $role;$rel=Clamp (Div $r.BF 300) .25 1
        $out += [pscustomobject][ordered]@{id="tml-$($r.year)-$([Math]::Abs($r.key.GetHashCode()))-p";source='twbsball-wayback-derived';league='TML';type='pitcher';team=$r.team;year=$r.year;name=$r.name;cardType=$card;role=$role;roles=@($role);stamina=Pitcher-Ability $r.sta $rel $cap.st;control=Pitcher-Ability $r.ctl $rel $cap.co;velocity=Pitcher-Ability $r.vel $rel $cap.v;breaking=Pitcher-Ability $r.brk $rel $cap.b;battersFaced=[int]$r.BF}
    };return $out
}

$playerMap=@{}
foreach($teamTitle in $teamTitles){$teamHtml=Archive-Page $teamTitle;if(-not $teamHtml){throw "Could not download $teamTitle"};foreach($p in @(Player-Links $teamHtml)){$playerMap["$($p.title)|$($p.type)"]=$p}}
$players=@($playerMap.Values)
Write-Host "Found $($players.Count) players"
$raw=@();$i=0
foreach($player in $players){$i++;Write-Host "[$i/$($players.Count)] $($player.name)";$html=Archive-Page $player.title;if($html){$raw+=@(Parse-Player $player $html)}}
$raw=@($raw|Sort-Object key -Unique)
$cards=@()
foreach($year in 1997..2002){$cards+=@(Build-Hitters @($raw|?{$_.year-eq$year-and$_.type-eq'hitter'-and$_.PA-ge20}));$cards+=@(Build-Pitchers @($raw|?{$_.year-eq$year-and$_.type-eq'pitcher'-and$_.BF-ge20}))}
$json=$cards|ConvertTo-Json -Depth 8 -Compress
[IO.File]::WriteAllText($OutputPath,$json,[Text.UTF8Encoding]::new($false))
$old=(Get-Content -Raw -Encoding UTF8 $MergedOutputPath)-replace '^window\.BBOImportedDraft\s*=\s*',''-replace ';\s*$',''
$existingRaw=$old|ConvertFrom-Json
$existing=@($existingRaw|?{$_.league-ne'TML'})
$merged=@($existing)+@($cards)
[IO.File]::WriteAllText($MergedOutputPath,"window.BBOImportedDraft = $($merged|ConvertTo-Json -Depth 8 -Compress);",[Text.UTF8Encoding]::new($false))
Write-Host "Exported $($cards.Count) cards from $($raw.Count) TML player seasons"







