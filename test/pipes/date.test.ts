import { describe, expect, it } from "vitest";
import { DatePipe } from "@/pipes/date.ts";
import { formatDate } from "@/pipes/format-date.ts";

// 15 de junio de 2015, 9:03:01.550, hora local (como en los tests de `DatePipe` de Angular).
const date = new Date(2015, 5, 15, 9, 3, 1, 550);
/** El espacio antes de AM/PM depende de la versión de ICU (espacio, U+00A0 o U+202F). */
const spaces = (text: string | null) => text?.replace(/\s/g, " ");

describe("etapa 11 — date / DatePipe (unidad, sin AngularJS)", () => {
  it("símbolos de patrón como en Angular (en-US)", () => {
    const cases: Record<string, string> = {
      y: "2015",
      yy: "15",
      yyyy: "2015",
      M: "6",
      MM: "06",
      MMM: "Jun",
      MMMM: "June",
      d: "15",
      dd: "15",
      EEE: "Mon",
      EEEE: "Monday",
      EEEEEE: "Mo",
      h: "9",
      hh: "09",
      H: "9",
      HH: "09",
      mm: "03",
      ss: "01",
      SSS: "550",
      a: "AM",
      w: "25",
      "dd/MM/yyyy": "15/06/2015",
      "dd/MM/yyyy HH:mm": "15/06/2015 09:03",
      "yyyy 'de' MMMM": "2015 de June",
      "h 'o''clock'": "9 o'clock",
    };
    for (const [format, expected] of Object.entries(cases)) {
      expect(formatDate(date, format, "en-US"), format).toBe(expected);
    }
  });

  it("formatos con nombre (en-US)", () => {
    expect(formatDate(date, "shortDate", "en-US")).toBe("6/15/15");
    expect(formatDate(date, "mediumDate", "en-US")).toBe("Jun 15, 2015");
    expect(formatDate(date, "longDate", "en-US")).toBe("June 15, 2015");
    expect(formatDate(date, "fullDate", "en-US")).toBe("Monday, June 15, 2015");
    expect(spaces(formatDate(date, "short", "en-US"))).toBe("6/15/15, 9:03 AM");
    expect(spaces(formatDate(date, "medium", "en-US"))).toBe("Jun 15, 2015, 9:03:01 AM");
  });

  it("con el LOCALE_ID del país (es-MX)", () => {
    const pipe = new DatePipe("es-MX");
    expect(pipe.transform(date, "longDate")).toBe("15 de junio de 2015");
    expect(pipe.transform(date, "EEEE d 'de' MMMM")).toBe("lunes 15 de junio");
    expect(spaces(pipe.transform(date, "h:mm a"))).toBe("9:03 a.m.");
    expect(pipe.transform(date, "longDate", undefined, "en-US")).toBe("June 15, 2015");
  });

  it("zona horaria: UTC, desfase y los símbolos de zona", () => {
    const utc = new Date(Date.UTC(2015, 5, 15, 9, 3, 1));
    expect(formatDate(utc, "HH:mm", "en-US", "UTC")).toBe("09:03");
    expect(formatDate(utc, "HH:mm", "en-US", "+0430")).toBe("13:33");
    expect(formatDate(utc, "HH:mm Z", "en-US", "-0600")).toBe("03:03 -0600");
    expect(formatDate(utc, "ZZZZZ", "en-US", "UTC")).toBe("Z");
    expect(formatDate(utc, "ZZZZ", "en-US", "+0430")).toBe("GMT+04:30");
    expect(formatDate(utc, "z", "en-US", "+0100")).toBe("GMT+1");
    expect(spaces(formatDate(utc, "shortTime", "en-US", "UTC"))).toBe("9:03 AM");
  });

  it("valores como `toDate` de Angular: número, ISO, y `yyyy-MM-dd` como fecha local", () => {
    const pipe = new DatePipe("en-US");
    expect(pipe.transform("2015-06-15", "dd/MM/yyyy")).toBe("15/06/2015");
    expect(pipe.transform(0, "yyyy", "UTC")).toBe("1970");
    expect(pipe.transform("2015-06-15T09:03:01Z", "HH:mm", "UTC")).toBe("09:03");
  });

  it("vacío da null; un valor que no es fecha es error", () => {
    const pipe = new DatePipe("en-US");
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeNull();
    expect(pipe.transform("")).toBeNull();
    expect(() => pipe.transform("no es fecha")).toThrowError(/Unable to convert/);
  });

  it("por defecto mediumDate", () => {
    expect(new DatePipe("en-US").transform(date)).toBe("Jun 15, 2015");
  });
});
