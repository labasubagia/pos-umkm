import i18next from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import HttpBackend from "i18next-http-backend";
import { initReactI18next } from "react-i18next";

/**
 * i18next configuration.
 * Default language: id-ID (Bahasa Indonesia)
 * Fallback language: en
 * Translations loaded from /public/locales/{lng}/{ns}.json
 *
 * `load: 'languageOnly'` strips region codes (e.g. en-US → en, id-ID → id)
 * so the HTTP backend requests /locales/en/common.json instead of
 * /locales/en-US/common.json, matching the folder structure in public/.
 */
i18next
  .use(HttpBackend)
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: "en",
    load: "languageOnly",
    defaultNS: "common",
    ns: ["common"],
    backend: {
      loadPath: `${import.meta.env.BASE_URL}locales/{{lng}}/{{ns}}.json`,
    },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
    },
    interpolation: {
      escapeValue: false,
    },
  });

export default i18next;
