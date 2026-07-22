"""Config flow — jedna instancja; opcje: stacja IMGW i klucz API Claude."""
import voluptuous as vol

from homeassistant.config_entries import ConfigFlow, OptionsFlow

from .const import DOMAIN


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
        return self.async_show_form(
            step_id="init",
            data_schema=vol.Schema(
                {
                    vol.Optional(
                        "imgw_station", default=options.get("imgw_station", "warszawa")
                    ): str,
                    vol.Optional("api_key", default=options.get("api_key", "")): str,
                }
            ),
        )
