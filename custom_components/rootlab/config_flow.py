"""Config flow — jedna instancja; opcje: pogoda, AI (wielu dostawców), lokalizacja ogrodu."""
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, OptionsFlow
from homeassistant.helpers import selector

from .ai import async_list_models
from .const import DOMAIN

# dostawcy, dla ktorych klucz da sie zweryfikowac lista modeli
_KEY_PROVIDERS = {
    "anthropic", "openai", "google", "groq", "mistral", "deepseek",
    "xai", "openrouter", "together", "perplexity",
}

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
    async def _models_for(self, provider, api_key, base_url):
        """Modele dostawcy albo None (brak danych / błąd) — bez wyjątków."""
        if not provider or provider not in _KEY_PROVIDERS or not api_key:
            return None
        try:
            return await async_list_models(
                self.hass, provider, api_key, base_url
            ) or None
        except Exception:  # noqa: BLE001
            return None

    async def async_step_init(self, user_input=None):
        errors = {}
        placeholders = {"error_detail": ""}
        if user_input is not None:
            provider = user_input.get("ai_provider")
            api_key = user_input.get("api_key")
            if provider in _KEY_PROVIDERS and api_key:
                # walidacja klucza: pobranie listy modeli u dostawcy
                try:
                    await async_list_models(
                        self.hass, provider, api_key,
                        user_input.get("ai_base_url"),
                    )
                except Exception as err:  # noqa: BLE001
                    errors["api_key"] = "invalid_auth"
                    placeholders["error_detail"] = str(err)[:200]
            if not errors:
                return self.async_create_entry(title="", data=user_input)

        options = dict(self.config_entry.options)
        if user_input is not None:
            options.update(user_input)
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
        # zapisany (lub wlasnie wpisany) klucz -> ai_model jako lista modeli
        models = await self._models_for(
            options.get("ai_provider"), options.get("api_key"),
            options.get("ai_base_url"),
        )
        model_selector = (
            selector.SelectSelector(
                selector.SelectSelectorConfig(
                    options=models,
                    mode=selector.SelectSelectorMode.DROPDOWN,
                    custom_value=True,
                    sort=True,
                )
            )
            if models
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
                vol.Optional("ai_model"): model_selector,
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
            errors=errors,
            description_placeholders=placeholders,
        )
