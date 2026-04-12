import { PLUGIN_ID, DEFAULT_SRC } from "./protocol";
import { buildSelectPreset } from "./n2k";
import { parseExpression, extractPaths, ExprNode } from "./parser";
import { evaluate } from "./expression";
import { PluginOptions, ProfileConfig } from "./types";

const pgnDefinitions = require("./pgns");

export default function (app: any) {
  const debug = (...args: any[]) => app.debug(...args);

  let options: PluginOptions;
  let unsubscribes: Array<() => void> = [];
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let initialTimer: ReturnType<typeof setTimeout> | null = null;
  let lastPresetIndex: number | null = null;
  let parsedPresets: (ExprNode | null)[] = [];

  function src(): number {
    return options.sourceAddress ?? DEFAULT_SRC;
  }

  function getActiveProfile(): ProfileConfig | undefined {
    return options.profiles?.find((p) => p.name === options.activeProfile);
  }

  function evaluateNow(): void {
    const profile = getActiveProfile();
    if (!profile) return;

    const hysteresis = profile.hysteresis
      ? profile.hysteresis * (Math.PI / 180)
      : 0;

    let result: number | null = null;
    for (let i = 0; i < parsedPresets.length && i < 4; i++) {
      const node = parsedPresets[i];
      if (!node) continue;
      const previouslyActive = lastPresetIndex === i;
      if (evaluate(node, (path) => app.getSelfPath(path + ".value"), hysteresis, previouslyActive)) {
        result = i;
        break;
      }
    }

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
      evaluateNow();
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
              hysteresis: 5,
              presets: [
                {
                  name: "Racing timer",
                  when: "navigation.racing.status == 'countdown'",
                },
                {
                  name: "Upwind",
                  when: "navigation.racing.status == 'racing' AND environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)",
                },
                {
                  name: "Downwind",
                  when: "navigation.racing.status == 'racing' AND environment.wind.angleTrueWater OUTSIDE(-90deg, 90deg)",
                },
                {
                  name: "Sailing",
                  when: "true",
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
              hysteresis: {
                type: "number" as const,
                title: "Hysteresis (degrees)",
                description: "Deadband applied to numeric boundaries to prevent preset flapping",
                default: 0,
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
                    when: {
                      type: "string" as const,
                      title: "Condition Expression",
                      description:
                        "Expression that activates this preset. " +
                        "Operators: == != > < >= <= BETWEEN(min, max) OUTSIDE(min, max). " +
                        "Logic: AND OR NOT ( ). " +
                        "Append 'deg' to numbers for degree-to-radian conversion. " +
                        "Example: navigation.racing.status == 'racing' AND environment.wind.angleTrueWater BETWEEN(-90deg, 90deg)",
                    },
                  },
                },
              },
            },
          },
        },
      },
    },

    uiSchema: {
      profiles: {
        items: {
          presets: {
            items: {
              when: { "ui:widget": "textarea" },
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
      parsedPresets = [];
      unsubscribes = [];

      app.emitPropertyValue("canboat-custom-pgns", pgnDefinitions);
      debug("Registered custom PGN definitions");

      const profile = getActiveProfile();
      if (!profile) {
        app.setPluginStatus("No active profile configured");
        debug('No profile matching "%s"', options.activeProfile);
        return;
      }

      // Parse all preset expressions
      const allPaths = new Set<string>();
      for (const preset of profile.presets) {
        if (preset.when && preset.when.trim()) {
          try {
            const node = parseExpression(preset.when);
            parsedPresets.push(node);
            for (const p of extractPaths(node)) {
              allPaths.add(p);
            }
          } catch (e: unknown) {
            const msg = e instanceof Error ? e.message : String(e);
            app.error(`Failed to parse expression for preset "${preset.name}": ${msg}`);
            app.setPluginError(`Parse error in "${preset.name}": ${msg}`);
            parsedPresets.push(null);
          }
        } else {
          parsedPresets.push(null);
        }
      }

      const paths = Array.from(allPaths);
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
        evaluateNow();
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
      parsedPresets = [];
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
