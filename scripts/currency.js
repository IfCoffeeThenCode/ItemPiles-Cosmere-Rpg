const denominations = new Map([
    ["Chip", 0.2],
    ["Mark", 1],
    ["Broam", 4]
]);

const sphereCompendiums = ["cosmere-rpg-stormlight-handbook.items", "cosmere-rpg.items"];

export default async function getCurrency() {
    try {
        return await getCompendiumSpheres() ?? getManualSpheres();
    } catch(err) {
        console.error("ItemPiles | Cosmere RPG | Failed to load compendium currencies, using manual spheres:", err);
        return getManualSpheres();
    }
}

function getManualSpheres() {
    const toItems = (gems, baseValue) => {
        const items = [];
        for(const gem of gems) {
            denominations.forEach((value, key) => {
                const name = `${gem} ${key}`;
                const img = `systems/cosmere-rpg/assets/icons/stormlight/items/spheres/sphere_${gem.toLowerCase()}_${key.toLowerCase()}.webp`;
                const val = value * baseValue;
                items.push({
                    type: "item",
                    name: name,
                    img: img,
                    abbreviation: "{#}mk",
                    data: {
                        item: {
                            "name": name,
                            "type": "loot",
                            "img": img,
                            "system": {
                                "quantity": 1,
                                "isMoney": true,
                                "price": {
                                    "value": val,
                                    "currency": "spheres",
                                    "denomination": {
                                        "primary": "mark",
                                        "secondary": "none"
                                    },
                                    "unit": "spheres.mark",
                                    "baseValue": val
                                }
                            }
                        }
                    },
                    primary: false,
                    exchangeRate: val
                });
            });
        }
        return items;
    };
    const currencies = toItems(["Diamond"], 1)
        .concat(toItems(["Garnet", "Heliodor", "Topaz"], 5))
        .concat(toItems(["Ruby", "Smokestone", "Zircon"], 10))
        .concat(toItems(["Amethyst", "Sapphire"], 25))
        .concat(toItems(["Emerald"], 50));

    currencies.find(value => value.name === "Diamond Mark").primary = true;

    return currencies;
}

async function getCompendiumSpheres() {
    for(const compendium of sphereCompendiums) {
        const pack = game.packs.get(compendium);
        if(!pack) continue;

        // Use pack.index (always populated) instead of the private _getVisibleTreeContents()
        // which returns pack.contents and may be empty if the pack has not been opened.
        const spheres = pack.index.filter(x => x.type === "loot");

        const currencies = []
        for(const sphere of spheres) {

            const itemData = await fromUuid(sphere.uuid);
            if(!itemData?.system?.isMoney) continue;

            // Use baseValue (denomination-normalized price in marks) as the exchange rate
            // so that spheres priced in any denomination convert correctly.
            const exchangeRate = itemData.system.price.baseValue ?? itemData.system.price.value;

            currencies.push({
                type: "item",
                name: sphere.name,
                img: sphere.img,
                abbreviation: "{#}mk",
                data: { uuid:  sphere.uuid },
                primary: Boolean(sphere.name === "Diamond Mark"),
                exchangeRate,
            });
        }
        if(currencies.length > 0) return currencies;
    }
    return null;
}
