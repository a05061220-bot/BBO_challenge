# BBO-style CPBL player ratings

The generated ratings are estimates based on real CPBL season statistics. They are not original
Netmarble/Joybomb card values.

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

Card tiers are based on the weighted overall percentile for each season and player type:

- Purple: top 3%
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

## Generate

Download and extract `cpbl-opendata` into `cpbl-opendata/cpbl-opendata-master`, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\generate-bbo-data.ps1
```
