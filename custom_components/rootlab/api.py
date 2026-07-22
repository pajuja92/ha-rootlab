"""WebSocket API RootLab."""
import uuid

import voluptuous as vol

from homeassistant.components import websocket_api
from homeassistant.core import callback

from .const import DOMAIN
from .store import async_save

KINDS = ["zones", "plants", "sections", "tasks"]


def _items(data, kind):
    return data["irrigation"]["sections"] if kind == "sections" else data[kind]


def _public(hass):
    d = hass.data[DOMAIN]
    return {**d["data"], "active": {k: v["end"] for k, v in d["active"].items()}}


def async_register(hass):
    for cmd in (
        ws_get_data,
        ws_save_item,
        ws_delete_item,
        ws_irrigation_run,
        ws_irrigation_stop,
        ws_irrigation_pause,
        ws_irrigation_skip,
        ws_layout_save,
        ws_weather,
    ):
        websocket_api.async_register_command(hass, cmd)


@websocket_api.websocket_command({vol.Required("type"): "rootlab/data"})
@callback
def ws_get_data(hass, connection, msg):
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/item/save",
        vol.Required("kind"): vol.In(KINDS),
        vol.Required("item"): dict,
    }
)
@websocket_api.async_response
async def ws_save_item(hass, connection, msg):
    items = _items(hass.data[DOMAIN]["data"], msg["kind"])
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
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


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
    kind, item_id = msg["kind"], msg["item_id"]
    if kind == "sections":
        await hass.data[DOMAIN]["irrigation_ctl"]["stop"](item_id)
        data["irrigation"]["sections"] = [
            s for s in data["irrigation"]["sections"] if s["id"] != item_id
        ]
    else:
        data[kind] = [i for i in data[kind] if i["id"] != item_id]
    if kind == "zones":
        for plant in data["plants"]:
            if plant.get("zone_id") == item_id:
                plant["zone_id"] = None
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/run",
        vol.Required("section_id"): str,
        vol.Required("minutes"): vol.All(int, vol.Range(min=1, max=120)),
    }
)
@websocket_api.async_response
async def ws_irrigation_run(hass, connection, msg):
    sections = hass.data[DOMAIN]["data"]["irrigation"]["sections"]
    section = next((s for s in sections if s["id"] == msg["section_id"]), None)
    if not section:
        connection.send_error(msg["id"], "not_found", "Nie ma takiej sekcji")
        return
    await hass.data[DOMAIN]["irrigation_ctl"]["start"](section, msg["minutes"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/irrigation/stop", vol.Required("section_id"): str}
)
@websocket_api.async_response
async def ws_irrigation_stop(hass, connection, msg):
    await hass.data[DOMAIN]["irrigation_ctl"]["stop"](msg["section_id"])
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/pause",
        vol.Required("until"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_irrigation_pause(hass, connection, msg):
    hass.data[DOMAIN]["data"]["irrigation"]["paused_until"] = msg["until"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command(
    {
        vol.Required("type"): "rootlab/irrigation/skip",
        vol.Required("date"): vol.Any(None, str),
    }
)
@websocket_api.async_response
async def ws_irrigation_skip(hass, connection, msg):
    hass.data[DOMAIN]["data"]["irrigation"]["skip_date"] = msg["date"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))


@websocket_api.websocket_command({vol.Required("type"): "rootlab/weather"})
@websocket_api.async_response
async def ws_weather(hass, connection, msg):
    d = hass.data[DOMAIN]
    station = d["entry"].options.get("imgw_station", "warszawa")
    connection.send_result(msg["id"], await d["weather"].fetch(station))


@websocket_api.websocket_command(
    {vol.Required("type"): "rootlab/layout/save", vol.Required("layout"): dict}
)
@websocket_api.async_response
async def ws_layout_save(hass, connection, msg):
    hass.data[DOMAIN]["data"]["layout"] = msg["layout"]
    await async_save(hass)
    connection.send_result(msg["id"], _public(hass))
