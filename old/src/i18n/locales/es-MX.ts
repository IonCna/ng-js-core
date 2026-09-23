import { type LocaleData, PLURAL_CATEGORY } from "@/i18n/locale-data.ts";

/**
 * `$locale` de `es-MX` (México) — separador decimal `.`, de miles `,`, moneda `$`,
 * nombres en español. Se pasa a `registerLocaleData(esMX)`; equivale a
 * `import localeEsMX from "@angular/common/locales/es-MX"`.
 */
const esMX: LocaleData = {
  id: "es-mx",
  localeID: "es_MX",
  DATETIME_FORMATS: {
    AMPMS: ["a.m.", "p.m."],
    DAY: ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"],
    ERANAMES: ["antes de Cristo", "después de Cristo"],
    ERAS: ["a. C.", "d. C."],
    FIRSTDAYOFWEEK: 6,
    MONTH: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    SHORTDAY: ["dom.", "lun.", "mar.", "mié.", "jue.", "vie.", "sáb."],
    SHORTMONTH: ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sep.", "oct.", "nov.", "dic."],
    STANDALONEMONTH: [
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ],
    WEEKENDRANGE: [5, 6],
    fullDate: "EEEE, d 'de' MMMM 'de' y",
    longDate: "d 'de' MMMM 'de' y",
    medium: "d MMM y H:mm:ss",
    mediumDate: "d MMM y",
    mediumTime: "H:mm:ss",
    short: "d/MM/yy H:mm",
    shortDate: "d/MM/yy",
    shortTime: "H:mm",
  },
  NUMBER_FORMATS: {
    CURRENCY_SYM: "$",
    DECIMAL_SEP: ".",
    GROUP_SEP: ",",
    PATTERNS: [
      { gSize: 3, lgSize: 3, maxFrac: 3, minFrac: 0, minInt: 1, negPre: "-", negSuf: "", posPre: "", posSuf: "" },
      { gSize: 3, lgSize: 3, maxFrac: 2, minFrac: 2, minInt: 1, negPre: "-¤", negSuf: "", posPre: "¤", posSuf: "" },
    ],
  },
  pluralCat: (n: number) => (n === 1 ? PLURAL_CATEGORY.ONE : PLURAL_CATEGORY.OTHER),
};

export default esMX;
