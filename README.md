# signalk-gnx-display-preset-plugin

Signal K plugin that automatically switches Garmin GNX display presets based on configurable condition expressions evaluated against Signal K data paths.

## Use case

When racing, different display layouts are useful at different times — a countdown timer during the start sequence, upwind instruments when beating, downwind instruments when running. This plugin monitors Signal K paths and sends NMEA 2000 commands to your GNX display to switch presets automatically.

## Configuration

| Setting | Default | Description |
|---|---|---|
| Source Address | `0` | NMEA 2000 source address for preset commands (CAN gateway may override) |
| Active Profile | `default` | Name of the profile to activate |
| Debounce (ms) | `1000` | Delay before sending a command after conditions change |
| Profiles | see below | Array of profile configurations |

### Profiles and presets

Each profile contains exactly 4 presets (matching the 4 GNX display preset slots). Each preset has a name and a `when` expression. Presets are evaluated in order — the first match wins.

Profiles also support an optional `hysteresis` value (in degrees) that widens numeric boundaries for the currently active preset, preventing rapid flapping when values oscillate near a threshold.

### Condition expressions

Each preset's `when` field accepts a human-readable expression string:

```
navigation.racing.status == 'racing' AND environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)
```

#### Operators

| Operator | Example | Description |
|---|---|---|
| `==` | `path == 'value'` | Equals (string or number) |
| `!=` | `path != 'value'` | Not equals |
| `>` | `path > 10` | Greater than |
| `<` | `path < 10` | Less than |
| `>=` | `path >= 10` | Greater than or equal |
| `<=` | `path <= 10` | Less than or equal |
| `BETWEEN(min, max)` | `path BETWEEN(-90, 90)` | Value >= min and <= max (inclusive) |
| `OUTSIDE(min, max)` | `path OUTSIDE(-90, 90)` | Value < min or > max |

#### Logic

| Keyword | Description |
|---|---|
| `AND` | Both sides must be true |
| `OR` | Either side must be true |
| `NOT` | Inverts the following expression |
| `( )` | Group expressions to override precedence |

Precedence: `NOT` > `AND` > `OR` (standard boolean).

#### Units

An empty `when` field always matches — use this for a fallback preset that activates when no other preset applies.

#### Units

Append `deg` to any number to convert degrees to radians for comparison against Signal K values:

```
environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)
```

### Default profile

The plugin ships with a default racing profile:

| Preset | Name | Expression |
|---|---|---|
| 0 | Racing timer | `navigation.racing.status == 'countdown'` |
| 1 | Upwind | `navigation.racing.status == 'racing' AND environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)` |
| 2 | Downwind | `navigation.racing.status == 'racing' AND environment.wind.angleTrueWater OUTSIDE(-90deg, 90deg)` |
| 3 | Sailing | *(empty — always matches)* |

Preset 0 takes priority: during countdown, the Racing timer display is always shown regardless of wind angle. Preset 3 has an empty expression, which always matches — since presets 0-2 are evaluated first, it acts as a general sailing fallback when no other preset applies (including when Signal K paths are missing).

## REST API

The plugin exposes a single endpoint:

```
GET /plugins/signalk-gnx-display-preset/state
```

Returns:

```json
{
  "activeProfile": "default",
  "activePreset": 1,
  "profiles": ["default"]
}
```

`activePreset` is `null` when no preset conditions are met.

## How it works

1. On start, the plugin parses all `when` expressions and subscribes to the Signal K paths they reference.
2. When any subscribed path updates, evaluation is scheduled (debounced).
3. Presets are evaluated in order (0-3). The first preset whose expression matches is selected.
4. If the selected preset differs from the current one, the plugin emits a PGN 61184 (Garmin proprietary) NMEA 2000 command to switch the GNX display.

## Disclaimer

This project is an independent demo and is not affiliated with, endorsed by, or connected to Garmin or its subsidiaries. "Garmin" and "GNX" are trademarks of Garmin. Use at your own risk. The authors assume no liability for any damage to equipment or loss of functionality resulting from the use of this software.

## License

Apache-2.0
