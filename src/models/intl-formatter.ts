import { IntlAPI } from '../services/intl-api';
import {
    NumberFormatStyle,
    DigitsOptions,
    DateTimeOptions,
    ISO8601_DATE_REGEX,
    FORMAT_ALIASES,
    NUMBER_FORMAT_REGEXP,
    RelativeTimeOptions,
    Unit
} from './types';
import { Logger } from './logger';

export class IntlFormatter {

    public static formatNumber(
        value: any,
        defaultLocale: string,
        style: NumberFormatStyle,
        digits?: string | DigitsOptions,
        currency?: string,
        currencyDisplay?: string
    ): string {
        if (!IntlAPI.hasNumberFormat()) return currency ? value + " " + currency : value;

        value = typeof value === "string" && !isNaN(+value - parseFloat(value)) ? +value : value;

        return IntlFormatter.numberFormatter(value, defaultLocale, style, digits, currency, currencyDisplay);
    }

    public static formatDate(value: any, defaultLocale: string, format: string | DateTimeOptions, timezone?: string): string {
        if (!IntlAPI.hasDateTimeFormat()) return value;

        let date: Date;
        if (typeof value === "string") {
            value = value.trim();
        }
        if (IntlFormatter.isDate(value)) {
            date = value;
        } else if (!isNaN(value - parseFloat(value))) {
            date = new Date(parseFloat(value));
        } else if (typeof value === "string" && /^(\d{4}-\d{1,2}-\d{1,2})$/.test(value)) {
            const [y, m, d] = value.split('-').map((val: string) => parseInt(val, 10));
            date = new Date(y, m - 1, d);
        } else {
            date = new Date(value);
        }
        if (!IntlFormatter.isDate(date)) {
            let match: RegExpMatchArray | null;
            if ((typeof value === "string") && (match = value.match(ISO8601_DATE_REGEX))) {
                date = IntlFormatter.isoStringToDate(match);
            }
        }

        return IntlFormatter.dateTimeFormatter(date, defaultLocale, format, timezone);
    }

    public static formatRelativeTime(value: any, unit: Unit, defaultLocale: string, format?: RelativeTimeOptions): string {
        if (!IntlAPI.hasRelativeTimeFormat()) return value + " " + unit;

        value = typeof value === "string" && !isNaN(+value - parseFloat(value)) ? +value : value;

        return IntlFormatter.relativeTimeFormatter(value, unit, defaultLocale, format);
    }

    private static numberFormatter(
        num: number,
        defaultLocale: string,
        style: NumberFormatStyle,
        digits?: string | DigitsOptions,
        currency?: string,
        currencyDisplay?: string
    ): string {
        let options: Intl.NumberFormatOptions = {};
        if (digits) {
            if (typeof digits === "string") {
                const digitsOptions: DigitsOptions | null = formatDigitsAliases(digits);
                if (digitsOptions != null) {
                    options = digitsOptions;
                } else {
                    Logger.log('IntlFormatter', 'invalidNumberFormatAlias');
                }
            } else {
                options = digits;
            }
        }
        options.style = NumberFormatStyle[style].toLowerCase();
        if (style == NumberFormatStyle.Currency) {
            options.currency = currency;
            options.currencyDisplay = currencyDisplay;
        }

        return new Intl.NumberFormat(defaultLocale, options).format(num);
    }

    private static dateTimeFormatter(date: Date, defaultLocale: string, format: string | DateTimeOptions, timezone?: string): string {
        let options: Intl.DateTimeFormatOptions = {};
        if (format) {
            if (typeof format === "string") {
                const dateTimeOptions: DateTimeOptions = FORMAT_ALIASES[format];
                if (dateTimeOptions) {
                    options = dateTimeOptions;
                } else {
                    Logger.log('IntlFormatter', 'invalidDateFormatAlias');
                }
            } else {
                options = format;
            }
        }
        options.timeZone = IntlAPI.hasTimezone() ? timezone : 'UTC';

        return new Intl.DateTimeFormat(defaultLocale, options).format(date).replace(/[\u200e\u200f]/g, "");
    }

    private static relativeTimeFormatter(value: number, unit: Unit, defaultLocale: string, format?: RelativeTimeOptions): string {
        let options: any = {};
        if (format) {
            options = format;
        }

        return new Intl.RelativeTimeFormat(defaultLocale, options).format(value, unit);
    }

    private static isDate(value: any): value is Date {
        return value instanceof Date && !isNaN(value.valueOf());
    }

    private static isoStringToDate(match: RegExpMatchArray): Date {
        const date: Date = new Date(0);
        let tzHour: number = 0;
        let tzMin: number = 0;
        const dateSetter: Function = match[8] ? date.setUTCFullYear : date.setFullYear;
        const timeSetter: Function = match[8] ? date.setUTCHours : date.setHours;
        if (match[9]) {
            tzHour = +(match[9] + match[10]);
            tzMin = +(match[9] + match[11]);
        }
        dateSetter.call(date, +(match[1]), +(match[2]) - 1, +(match[3]));
        const h: number = +(match[4] || '0') - tzHour;
        const m: number = +(match[5] || '0') - tzMin;
        const s: number = +(match[6] || '0');
        const ms: number = Math.round(parseFloat('0.' + (match[7] || 0)) * 1000);
        timeSetter.call(date, h, m, s, ms);
        return date;
    }

}

export function formatDigitsAliases(digits: string): DigitsOptions | null {
    const parts: RegExpMatchArray | null = digits.match(NUMBER_FORMAT_REGEXP);
    if (parts == null) return null;

    const digitsOptions: DigitsOptions = {};
    if (parts[1] != null) {
        digitsOptions.minimumIntegerDigits = parseInt(parts[1]);
    }
    if (parts[3] != null) {
        digitsOptions.minimumFractionDigits = parseInt(parts[3]);
    }
    if (parts[5] != null) {
        digitsOptions.maximumFractionDigits = parseInt(parts[5]);
    }
    return digitsOptions;
}
