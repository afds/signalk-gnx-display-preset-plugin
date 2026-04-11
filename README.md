# signalk-gnx-display-preset-plugin

Signal K plugin that automatically switches Garmin GNX display presets based on configurable conditions evaluated against SignalK data paths.

## Use case

When racing, different display layouts are useful at different times — a countdown timer during the start sequence, upwind instruments when beating, downwind instruments when running. This plugin monitors SignalK paths and sends NMEA 2000 commands to your GNX display to switch presets automatically.

## Configuration

| Setting | Default | Description |
|---|---|---|
| Source Address | `0` | NMEA 2000 source address for preset commands (CAN gateway may override) |
| Active Profile | `default` | Name of the profile to activate |
| Debounce (ms) | `500` | Delay before sending a command after conditions change |
| Profiles | see below | Array of profile configurations |

### Profiles and presets

Each profile contains exactly 4 presets (matching the 4 GNX display preset slots). Each preset has a name and a list of conditions. All conditions in a preset must be true for it to activate (AND logic). Presets are evaluated in order — the first match wins.

### Conditions

| Operator | Fields | Description |
|---|---|---|
| `equals` | `value` | Path value must equal the given string or number |
| `notEquals` | `value` | Path value must not equal the given string or number |
| `between` | `min`, `max` | Numeric value must be >= min and <= max (inclusive) |
| `outside` | `min`, `max` | Numeric value must be < min or > max |

Set **Unit** to `deg` on any condition to configure angles in degrees — they are converted to radians for comparison against SignalK values.

### Default profile

The plugin ships with a default racing profile:

| Preset | Name | Conditions |
|---|---|---|
| 0 | race time | `navigation.racing.status` equals `countdown` |
| 1 | beat | not countdown + true wind (water) between -90 and 90 deg |
| 2 | run | not countdown + true wind (water) outside -90 to 90 deg |
| 3 | *(empty)* | no conditions — never activates |

Preset 0 takes priority: during countdown, the race time display is always shown regardless of wind angle.

## REST API

The plugin exposes a single endpoint:

```
GET /plugins/signalk-gnx-display-preset-plugin/state
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

1. On start, the plugin subscribes to all SignalK paths referenced in the active profile's conditions.
2. When any subscribed path updates, evaluation is scheduled (debounced).
3. Presets are evaluated in order (0-3). The first preset whose conditions all match is selected.
4. If the selected preset differs from the current one, the plugin emits a PGN 61184 (Garmin proprietary) NMEA 2000 command to switch the GNX display.

## License

Apache-2.0
