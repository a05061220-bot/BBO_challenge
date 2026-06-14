# BBO-style CPBL player ratings

The generated ratings are estimates based on real CPBL season statistics. They are not original
Netmarble/Joybomb card values.

Players are ranked only against players from the same league, season, and player type. TML and
CPBL percentiles, card tiers, and yearly purple-card limits are calculated independently.

The TML import contains 1997-2002 Taipei Gida, Taichung Agan, Chiayi-Tainan Luka, and
Kaohsiung-Pingtung Fala players sourced from Taiwan Baseball Wiki career-stat tables through
Internet Archive snapshots. TML percentiles and purple-card limits use the complete same-year
four-team player pool. TML fielding and arm ratings are estimates because yearly fielding tables
are unavailable.

## Source

- Statistics: [ldkrsi/cpbl-opendata](https://github.com/ldkrsi/cpbl-opendata), MIT licensed
- Calibration reference: the small set of real card values in `BBO_Search/BBODB.accdb`

## Rating scale

Each metric is ranked against players of the same type in the same season. Percentile ranks are
converted to a 60-100 rating. Small samples are pulled toward 80 to avoid extreme ratings from a
few appearances.

### Hitters

- Power: isolated power, home-run rate, extra-base-hit rate
- Contact: batting average, on-base rate, strikeout avoidance
- Speed: stolen-base rate, triples, runs
- Fielding: fielding percentage and assists
- Arm: assists and fielding percentage

### Pitchers

- Stamina: starts and innings workload
- Control: walk avoidance and strikeout-to-walk ratio
- Velocity / stuff: strikeout rate, hit suppression, home-run suppression
- Breaking: strikeout-to-walk ratio, ground-ball rate, earned-run suppression

Historical measured pitch velocity is unavailable in `cpbl-opendata`, so the `velocity` field
represents overall fastball/stuff effectiveness rather than radar-gun speed.

## Card tiers

Card tiers are based on the weighted overall percentile for each season and player type. Ratings
and card rankings only compare players from the same season.

- Purple: top 5 hitters and top 5 pitchers in each season
- Red: next 12%
- Yellow: next 35%
- Blue: remaining players

### Hitter rating caps

| Tier | Power | Contact | Speed | Fielding | Arm |
| --- | ---: | ---: | ---: | ---: | ---: |
| Purple | 92 | 94 | 95 | 92 | 92 |
| Red | 86 | 86 | 90 | 85 | 85 |
| Yellow | 84 | 83 | 86 | 80 | 80 |
| Blue | 80 | 80 | 80 | 75 | 75 |

Power plus contact also has a combined cap:

- Purple: 170
- Red: 160
- Yellow: 155
- Blue: 150

Points above the combined cap are moved to fielding and arm without exceeding their tier caps.
Power and contact are separated by at least 7 points based on the player's stronger real-stat profile.

Fielding and arm minimums:

- Purple: 86
- Red: 79
- Yellow: 74
- Blue: 68

Fielding and arm are distributed within each tier's minimum and maximum using same-season
fielding percentiles, rather than being raised to the minimum after conversion.

Purple hitters have a combined fielding plus arm cap of 178.

Ratings use a curved distribution inside each tier's cap instead of clipping a general 60-100
rating. Reaching a cap therefore requires an elite percentile in that specific ability.

### Pitcher rating caps

| Tier | Stamina | Control | Velocity / stuff | Breaking |
| --- | ---: | ---: | ---: | ---: |
| Purple | 97 | 96 | 93 | 93 |
| Red | 88 | 93 | 86 | 86 |
| Yellow | 84 | 86 | 82 | 80 |
| Blue | 80 | 80 | 78 | 75 |

Relievers and closers have a stamina cap of 70. Their velocity / stuff and breaking caps are
increased by 2.

## Generate

Download and extract `cpbl-opendata` into `cpbl-opendata/cpbl-opendata-master`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\generate-bbo-data.ps1
```
