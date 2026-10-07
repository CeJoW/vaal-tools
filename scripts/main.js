const MODULE_ID = "vaal-tools";

Hooks.once("init", () => {
  game.settings.register(MODULE_ID, "enabled", {
    name: "VAAL.Settings.Enabled.Name",
    hint: "VAAL.Settings.Enabled.Hint",
    scope: "client",
    config: true,
    type: Boolean,
    default: true
  });
});

Hooks.once("ready", () => {
  if (game.system.id !== "pf2e") return;
  console.info("vaal Tools | Loaded. Reaction handlers have not been implemented yet.");
});
