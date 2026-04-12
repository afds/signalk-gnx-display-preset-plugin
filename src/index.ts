import { PLUGIN_ID, DEFAULT_SRC } from "./protocol";
import { buildSelectPreset } from "./n2k";
import { evaluateProfile, extractPaths } from "./conditions";
import { PluginOptions, ProfileConfig } from "./types";

const pgnDefinitions = require("./pgns");

export default function (app: any) {
  const debug = (...args: any[]) => app.debug(...args);

  let options: PluginOptions;
  let unsubscribes: Array<() => void> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPresetIndex: number | null = null;

  function src(): number {
    return options.sourceAddress ?? DEFAULT_SRC;
  }

  function getActiveProfile(): ProfileConfig | undefined {
    return options.profiles?.find((p) => p.name === options.activeProfile);
  }

  function evaluate(): void {
    const profile = getActiveProfile();
    if (!profile) return;

    const result = evaluateProfile(profile, (path: string) => {
      return app.getSelfPath(path + ".value");
    });

    if (result !== null && result !== lastPresetIndex) {
      debug("Preset changed: %s -> %d", lastPresetIndex, result);
      app.emit("nmea2000JsonOut", buildSelectPreset(result, src()));
      lastPresetIndex = result;
    } else if (result === null && lastPresetIndex !== null) {
      debug("No preset matches, was %d", lastPresetIndex);
      lastPresetIndex = null;
    }
  }

  function scheduleEvaluation(): void {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debounceTimer = null;
      evaluate();
    }, options.debounceMs ?? 1000);
  }

  const plugin = {
    id: PLUGIN_ID,
    name: "GNX Display Preset Selector",
    description: "Automatically selects GNX display presets based on Signal K path conditions",

    schema: {
      type: "object" as const,
      title: "GNX Display Preset Selector",
      properties: {
        sourceAddress: {
          type: "number" as const,
          title: "Source Address",
          description: "NMEA 2000 source address for preset commands (note: the CAN gateway may override this)",
          default: 0,
        },
        activeProfile: {
          type: "string" as const,
          title: "Active Profile",
          description: "Name of the profile to activate (must match a profile name below)",
          default: "default",
        },
        debounceMs: {
          type: "number" as const,
          title: "Debounce (ms)",
          description: "Delay in milliseconds before sending a preset command after conditions change",
          default: 1000,
        },
        profiles: {
          type: "array" as const,
          title: "Profiles",
          default: [
            {
              name: "default",
              presets: [
                {
                  name: "race time",
                  conditions: [{ path: "navigation.racing.status", operator: "equals", value: "countdown" }],
                },
                {
                  name: "beat",
                  conditions: [
                    { path: "navigation.racing.status", operator: "equals", value: "racing" },
                    { path: "environment.wind.angleTrueWater", operator: "between", min: -90, max: 90, unit: "deg" },
                  ],
                },
                {
                  name: "run",
                  conditions: [
                    { path: "navigation.racing.status", operator: "equals", value: "racing" },
                    { path: "environment.wind.angleTrueWater", operator: "outside", min: -90, max: 90, unit: "deg" },
                  ],
                },
                {
                  name: "",
                  conditions: [],
                },
              ],
            },
          ],
          items: {
            type: "object" as const,
            title: "Profile",
            required: ["name"],
            properties: {
              name: {
                type: "string" as const,
                title: "Profile Name",
              },
              presets: {
                type: "array" as const,
                title: "Presets",
                minItems: 4,
                maxItems: 4,
                items: {
                  type: "object" as const,
                  title: "Preset",
                  properties: {
                    name: {
                      type: "string" as const,
                      title: "Preset Name (optional)",
                      description: "Display label for this preset",
                    },
                    conditions: {
                      type: "array" as const,
                      title: "Conditions (all must be true)",
                      items: {
                        type: "object" as const,
                        title: "Condition",
                        required: ["path", "operator"],
                        properties: {
                          path: {
                            type: "string" as const,
                            title: "Signal K Path",
                            description: "e.g. navigation.racing.status or environment.wind.angleApparent",
                          },
                          operator: {
                            type: "string" as const,
                            title: "Operator",
                            enum: ["equals", "notEquals", "between", "outside"],
                            default: "equals",
                          },
                          value: {
                            title: "Value (for equals/notEquals)",
                            description: "String or number to compare against",
                          },
                          min: {
                            type: "number" as const,
                            title: "Min (for between/outside)",
                          },
                          max: {
                            type: "number" as const,
                            title: "Max (for between/outside)",
                          },
                          unit: {
                            type: "string" as const,
                            title: "Unit conversion",
                            description: 'Set to "deg" to configure angles in degrees (converted to radians for comparison)',
                            enum: ["", "deg"],
                            default: "",
                          },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    start: function (props: PluginOptions) {
      options = {
        sourceAddress: props.sourceAddress ?? DEFAULT_SRC,
        activeProfile: props.activeProfile ?? "",
        debounceMs: props.debounceMs ?? 1000,
        profiles: props.profiles ?? [],
      };
      lastPresetIndex = null;
      unsubscribes = [];

      app.emitPropertyValue("canboat-custom-pgns", pgnDefinitions);
      debug("Registered custom PGN definitions");

      const profile = getActiveProfile();
      if (!profile) {
        app.setPluginStatus("No active profile configured");
        debug('No profile matching "%s"', options.activeProfile);
        return;
      }

      const paths = extractPaths(profile);
      if (paths.length === 0) {
        app.setPluginStatus("Active profile has no conditions");
        debug('Profile "%s" has no paths to subscribe to', profile.name);
        return;
      }

      debug("Subscribing to paths: %j", paths);

      app.subscriptionmanager.subscribe(
        {
          context: "vessels.self",
          subscribe: paths.map((path) => ({ path, period: 1000 })),
        },
        unsubscribes,
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          app.error(msg);
          app.setPluginError(msg);
        },
        (_delta: any) => {
          scheduleEvaluation();
        },
      );

      initialTimer = setTimeout(() => {
        initialTimer = null;
        evaluate();
      }, 1000);

      app.setPluginStatus(`Running profile "${profile.name}" (${paths.length} paths)`);
      debug('Plugin started with profile "%s"', profile.name);
    },

    stop: function () {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
      if (initialTimer) {
        clearTimeout(initialTimer);
        initialTimer = null;
      }
      unsubscribes.forEach((f) => f());
      unsubscribes = [];
      lastPresetIndex = null;
      debug("Plugin stopped");
    },

    registerWithRouter: function (router: any) {
      router.get("/state", (_req: any, res: any) => {
        res.json({
          activeProfile: options?.activeProfile ?? null,
          activePreset: lastPresetIndex,
          profiles: (options?.profiles ?? []).map((p) => p.name),
        });
      });
    },
  };

  return plugin;
}
