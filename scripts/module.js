import getCurrency from "./currency.js";

// Load currencies during the Foundry ready phase so the value is available
// synchronously when item-piles-ready fires. ItemPiles calls registerSystemLibwrappers()
// immediately after Hooks.callAll('item-piles-ready'), so any await inside the
// item-piles-ready handler runs too late — the integration must be registered synchronously.
let _currencies;
Hooks.once('ready', async function() {
	_currencies = await getCurrency();
});

Hooks.once('item-piles-ready', function() {
	// _currencies may still be loading if the compendium fetch took longer than the
	// 100ms ItemPiles waits after ready before firing item-piles-ready. Fall back to
	// an empty array so addSystemIntegration always receives a valid value; currencies
	// can be corrected by reloading if needed, but pricing will still work via ITEM_PRICE_ATTRIBUTE.
    const config = {
		"VERSION": "1.2.0",
        "ACTOR_CLASS_TYPE": "adversary",
        "ITEM_CLASS_LOOT_TYPE": "loot",
        "ITEM_CLASS_WEAPON_TYPE": "weapon",
        "ITEM_CLASS_EQUIPMENT_TYPE": "equipment",
        "ITEM_QUANTITY_ATTRIBUTE": "system.quantity",
        "ITEM_PRICE_ATTRIBUTE": "system.price.value",
        "ITEM_SIMILARITIES": ["name", "type"],
		"CURRENCIES": _currencies ?? [],
        "ITEM_FILTERS": [
            {
                "path": "type",
                "filters": "action,ancestry,connection,culture,goal,injury,path,power,specialty,talent,trait,talent_tree"
            }
        ],
		"UNSTACKABLE_ITEM_TYPES": ["weapon", "armor"],

		// Read the denomination-normalized price (baseValue, in marks) rather than the raw
		// price.value, so items priced in broams or gem-denominations display correctly.
		// baseValue is a derived field set by prepareDerivedData; it is accessible on the
		// live Item document but not via toObject(), so we must read it here via getProperty.
		"ITEM_COST_TRANSFORMER": (item) => {
			return foundry.utils.getProperty(item, "system.price.baseValue")
				?? foundry.utils.getProperty(item, "system.price.value")
				?? 0;
		},

		"SHEET_OVERRIDES": () => {
			const sheetOverrides = Object.keys(CONFIG.Actor.sheetClasses).map(str => {
			    return Object.keys(CONFIG.Actor.sheetClasses[str]).map(sheet => {
			        return `CONFIG.Actor.sheetClasses.${str}["${sheet}"].cls.prototype.render`;
			    })
			}).flat()

			const method = function (wrapped, forced, options, ...args) {
				const renderItemPileInterface = Hooks.call(game.itempiles.CONSTANTS.HOOKS.PRE_RENDER_SHEET, this.document, forced, options) === false;
				// Application.RENDER_STATES is legacy (Foundry v12 / ApplicationV1).
				// In Foundry v13 ApplicationV2 sheets this constant does not exist, so we
				// guard with optional chaining to avoid a TypeError.
				const RENDER_STATES = Application?.RENDER_STATES ?? {};
				const NONE = RENDER_STATES.NONE ?? -1;
				if (this._state > NONE) {
					if (renderItemPileInterface) {
						wrapped(forced, options, ...args)
					} else {
						return wrapped(forced, options, ...args)
					}
				}
				if (renderItemPileInterface) return;
				return wrapped(forced, options, ...args);
			};

			for(const override of sheetOverrides){
				libWrapper.register("item-piles-cosmere-rpg", override, method, libWrapper.MIXED);
			}
		}
    };
    game.itempiles.API.addSystemIntegration(config, 'latest')
});
