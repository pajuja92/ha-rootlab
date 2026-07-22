"""Config flow — jedna instancja; opcje: pogoda, AI (wielu dostawców), lokalizacja ogrodu."""
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, OptionsFlow
from homeassistant.helpers import selector

from .const import DOMAIN

AI_PROVIDERS = [
    "ha_ai_task",
    "anthropic",
    "openai",
    "google",
    "groq",
    "mistral",
    "deepseek",
    "xai",
    "openrouter",
    "together",
    "perplexity",
    "ollama",
    "custom",
]


class RootlabConfigFlow(ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        await self.async_set_unique_id(DOMAIN)
        self._abort_if_unique_id_configured()
        if user_input is not None:
            return self.async_create_entry(title="RootLab", data={})
        return self.async_show_form(step_id="user")

    @staticmethod
    def async_get_options_flow(config_entry):
        return RootlabOptionsFlow()


class RootlabOptionsFlow(OptionsFlow):
    async def async_step_init(self, user_input=None):
        if user_input is not None:
            return self.async_create_entry(title="", data=user_input)

        options = self.config_entry.options
        stations = []
        if DOMAIN in self.hass.data and "weather" in self.hass.data[DOMAIN]:
            stations = await self.hass.data[DOMAIN]["weather"].stations()
        station_selector = (
            selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=stations,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                    custom_value=True,
                    sort=True,
                )
            )
            if stations
            else str
        )
        schema = vol.Schema(
            {
                vol.Optional("imgw_station"): station_selector,
                vol.Optional("weather_entity"): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="weather")
                ),
                vol.Optional("ai_provider"): selector.SelectSelector(
                    selector.SelectSelectorConfig(
                        options=AI_PROVIDERS,
                        mode=selector.SelectSelectorMode.DROPDOWN,
                        translation_key="ai_provider",
                    )
                ),
                vol.Optional("api_key"): selector.TextSelector(
                    selector.TextSelectorConfig(type=selector.TextSelectorType.PASSWORD)
                ),
                vol.Optional("ai_model"): str,
                vol.Optional("ai_base_url"): str,
                vol.Optional("ai_task_entity"): selector.EntitySelector(
                    selector.EntitySelectorConfig(domain="ai_task")
                ),
                vol.Optional("location"): selector.LocationSelector(),
            }
        )
        defaults = {
            "imgw_station": options.get("imgw_station", "warszawa"),
            "ai_provider": options.get("ai_provider", "anthropic"),
            "location": options.get(
                "location",
                {
                    "latitude": self.hass.config.latitude,
                    "longitude": self.hass.config.longitude,
                },
            ),
        }
        for key in ("weather_entity", "api_key", "ai_model", "ai_base_url", "ai_task_entity"):
            if options.get(key):
                defaults[key] = options[key]
        return self.async_show_form(
            step_id="init",
            data_schema=self.add_suggested_values_to_schema(schema, defaults),
        )
