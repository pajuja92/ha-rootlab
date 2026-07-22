"""RootLab — planer ogrodowy wspierany przez AI."""
from homeassistant.components import frontend
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from . import api
from .const import DOMAIN, PANEL_ICON, PANEL_TITLE, VERSION
from .irrigation import async_setup_scheduler, async_stop_all
from .store import async_load_data

FRONTEND_URL = f"/{DOMAIN}_files"


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store, data = await async_load_data(hass)
    hass.data[DOMAIN] = {
        "store": store,
        "data": data,
        "entry": entry,
        "active": {},
        "unsub": [],
    }
    api.async_register(hass)
    async_setup_scheduler(hass)

    await hass.http.async_register_static_paths(
        [
            StaticPathConfig(
                FRONTEND_URL,
                hass.config.path("custom_components", DOMAIN, "frontend"),
                cache_headers=False,
            )
        ]
    )
    frontend.async_register_built_in_panel(
        hass,
        component_name="custom",
        sidebar_title=PANEL_TITLE,
        sidebar_icon=PANEL_ICON,
        frontend_url_path=DOMAIN,
        config={
            "_panel_custom": {
                "name": "rootlab-panel",
                "module_url": f"{FRONTEND_URL}/rootlab-panel.js?v={VERSION}",
                "embed_iframe": False,
            }
        },
        require_admin=False,
        update=True,
    )
    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    frontend.async_remove_panel(hass, DOMAIN)
    if DOMAIN in hass.data:
        await async_stop_all(hass)
        for unsub in hass.data[DOMAIN]["unsub"]:
            unsub()
    hass.data.pop(DOMAIN, None)
    return True
