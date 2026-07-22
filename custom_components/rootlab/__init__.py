"""RootLab — planer ogrodowy wspierany przez AI."""
import uuid

import voluptuous as vol

from homeassistant.components import frontend, websocket_api
from homeassistant.components.http import StaticPathConfig
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant, callback
from homeassistant.helpers.storage import Store

from .const import DOMAIN, PANEL_ICON, PANEL_TITLE, VERSION

STORAGE_KEY = f"{DOMAIN}.data"
FRONTEND_URL = f"/{DOMAIN}_files"
KINDS = ["zones", "plants"]


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    store = Store(hass, 1, STORAGE_KEY)
    data = await store.async_load() or {"zones": [], "plants": []}
    hass.data[DOMAIN] = {"store": store, "data": data}

    websocket_api.async_register_command(hass, ws_get_data)
    websocket_api.async_register_command(hass, ws_save_item)
    websocket_api.async_register_command(hass, ws_delete_item)

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
    hass.data.pop(DOMAIN, None)
    return True


async def _async_save(hass: HomeAssistant) -> None:
    await hass.data[DOMAIN]["store"].async_save(hass.data[DOMAIN]["data"])


@websocket_api.websocket_command({vol.Required("type"): "rootlab/data"})
@callback
def ws_get_data(hass, connection, msg):
    connection.send_result(msg["id"], hass.data[DOMAIN]["data"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/item/save",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("item"): dict,
    }
)
@websocket_api.async_response
async def ws_save_item(hass, connection, msg):
    items = hass.data[DOMAIN]["data"][msg["kind"]]
    item = msg["item"]
    if not item.get("id"):
        item["id"] = uuid.uuid4().hex
        items.append(item)
    else:
        for i, existing in enumerate(items):
            if existing["id"] == item["id"]:
                items[i] = item
                break
        else:
            items.append(item)
    await _async_save(hass)
    connection.send_result(msg["id"], hass.data[DOMAIN]["data"])


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/item/delete",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("item_id"): str,
    }
)
@websocket_api.async_response
async def ws_delete_item(hass, connection, msg):
    data = hass.data[DOMAIN]["data"]
    data[msg["kind"]] = [i for i in data[msg["kind"]] if i["id"] != msg["item_id"]]
    if msg["kind"] == "zones":
        for plant in data["plants"]:
            if plant.get("zone_id") == msg["item_id"]:
                plant["zone_id"] = None
    await _async_save(hass)
    connection.send_result(msg["id"], data)
