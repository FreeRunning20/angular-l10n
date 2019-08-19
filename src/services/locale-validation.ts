import { Injectable } from '@angular/core';

import { LocaleService } from './locale.service';
import { IntlAPI } from './intl-api';
import { formatDigitsAliases } from '../models/intl-formatter';
import { Decimal, DigitsOptions } from '../models/types';
import { Logger } from '../models/logger';

export interface ILocaleValidation {

    parseNumber(s: string, digits?: string, defaultLocale?: string): number | null;

}

/**
 * Provides the methods for locale validation.
 */
@Injectable() export class LocaleValidation implements ILocaleValidation {

    private decimalCode: Decimal;

    private numberCodes: string[];

    constructor(private locale: LocaleService) { }

    /**
     * Converts a string to a number according to default locale.
     * If the string cannot be converted to a number, returns NaN.
     * @param s The string to be parsed
     * @param digits An alias of the format. Default is '1.0-3'
     * @param defaultLocale The default locale to use. Default is the current locale
     */
    public parseNumber(s: string, digits?: string, defaultLocale?: string): number | null {
        if (s == "" || s == null) return null;

        // Replaces whitespace metacharacters.
        s = s.replace(/\s/g, ' ');

        this.decimalCode = this.getDecimalCode(defaultLocale);
        this.numberCodes = this.getNumberCodes(defaultLocale);

        if (!this.validateNumber(s, digits)) return NaN;

        let value: string = "";

        const characters: string[] = s.split("");
        for (const char of characters) {
            const charCode: string = this.toUnicode(char);
            const index: number = this.numberCodes.indexOf(charCode);
            if (index != -1) {
                value += index;
            } else if (charCode == this.decimalCode.minusSign) {
                value += "-";
            } else if (charCode == this.decimalCode.decimalSeparator) {
                value += ".";
            } else if (charCode == this.decimalCode.thousandSeparator) {
                continue;
            } else { return NaN; }
        }
        return parseFloat(value);
    }

    private validateNumber(s: string, digits?: string): boolean {
        let options: DigitsOptions = {};
        if (digits) {
            const digitsOptions: DigitsOptions | null = formatDigitsAliases(digits);
            if (digitsOptions != null) {
                options = digitsOptions;
            } else {
                Logger.log('LocaleValidation', 'invalidNumberFormatAlias');
            }
        }
        const minInt: number = options.minimumIntegerDigits !== undefined ? options.minimumIntegerDigits : 1;
        const minFraction: number = options.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 0;
        const maxFraction: number = options.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 3;

        const minusSign: string = this.decimalCode.minusSign;
        const zero: string = this.numberCodes[0];
        const decimalSeparator: string = this.decimalCode.decimalSeparator;
        const thousandSeparator: string = this.decimalCode.thousandSeparator;
        const nine: string = this.numberCodes[9];

        // Pattern for 1.0-2 digits: /^-?[0-9]{1,}(\.[0-9]{0,2})?$/
        // Unicode pattern = "^\u002d?[\u0030-\u0039]{1,}(\\u002e[\u0030-\u0039]{0,2})?$"
        // Complete Pattern with thousand separator:
        // /^-?([0-9]{1,}|(?=(?:\,*[0-9]){1,}(\.|$))(?!0(?!\.|[0-9]))[0-9]{1,3}(\,[0-9]{3})*)(\.[0-9]{0,2})?$/
        // where:
        // (?=(?:\,*[0-9]){1,}(\.|$)) => Positive Lookahead to count the integer digits
        // (?!0(?!\.|[0-9])) => Negative Lookahead to avoid 0,1111.00
        // [0-9]{1,3}(\,[0-9]{3})* => Allows thousand separator
        const d: string = `[${zero}-${nine}]`;
        const n: string = `{${minInt},}`;
        const nm: string = `{${minFraction},${maxFraction}}`;
        const plainPattern: string = `${d}${n}`;
        // tslint:disable-next-line
        const thousandPattern: string = `(?=(?:\\${thousandSeparator}*${d})${n}(\\${decimalSeparator}|$))(?!${zero}(?!\\${decimalSeparator}|${d}))${d}{1,3}(\\${thousandSeparator}${d}{3})*`;

        let pattern: string = `^${minusSign}?(${plainPattern}|${thousandPattern})`;
        if (minFraction > 0 && maxFraction > 0) {
            // Decimal separator is mandatory.
            pattern += `\\${decimalSeparator}${d}${nm}$`;
        } else if (minFraction == 0 && maxFraction > 0) {
            // Decimal separator is optional.
            pattern += `(\\${decimalSeparator}${d}${nm})?$`;
        } else {
            // Integer number.
            pattern += `$`;
        }
        pattern = this.toChar(pattern);

        const NUMBER_REGEXP: RegExp = new RegExp(pattern);
        return NUMBER_REGEXP.test(s);
    }

    private getDecimalCode(defaultLocale?: string): Decimal {
        let decimalCode: Decimal = {
            minusSign: this.toUnicode("-"),
            decimalSeparator: this.toUnicode("."),
            thousandSeparator: this.toUnicode(",")
        };

        if (IntlAPI.hasNumberFormat()) {
            const value: number = -1000.9; // Reference value.
            const localeValue: string = this.locale.formatDecimal(value, '1.1-1', defaultLocale);

            const unicodeChars: string[] = [];
            for (let i: number = 0; i < localeValue.length; i++) {
                let unicodeChar: string = this.toUnicode(localeValue.charAt(i));
                // Replaces NO-BREAK SPACE
                unicodeChar = unicodeChar.replace("\\u202F", "\\u0020");
                unicodeChar = unicodeChar.replace("\\u00A0", "\\u0020");
                unicodeChars.push(unicodeChar);
            }

            const thousandSeparator: boolean = localeValue.length >= 8 ? true : false; // Expected positions.

            // Right to left:
            // checks Unicode characters 'RIGHT-TO-LEFT MARK' (U+200F) & 'Arabic Letter Mark' (U+061C),
            // or the reverse order.
            // Left to right:
            // checks Unicode character 'LEFT-TO-RIGHT MARK' (U+200E).
            let positions: number[];
            if (unicodeChars[0] == "\\u200F" || unicodeChars[0] == "\\u061C") {
                positions = thousandSeparator ? [1, 7, 3] : [1, 6];
            } else if (unicodeChars[0] == this.toUnicode(this.locale.formatDecimal(1, '1.0-0', defaultLocale))) {
                positions = thousandSeparator ? [7, 5, 1] : [6, 4];
            } else if (unicodeChars[0] == "\\u200E") {
                positions = thousandSeparator ? [1, 7, 3] : [1, 6];
            } else {
                positions = thousandSeparator ? [0, 6, 2] : [0, 5];
            }
            decimalCode = {
                minusSign: unicodeChars[positions[0]],
                decimalSeparator: unicodeChars[positions[1]],
                thousandSeparator: thousandSeparator ? unicodeChars[positions[2]] : ""
            };
        }
        return decimalCode;
    }

    private getNumberCodes(defaultLocale?: string): string[] {
        const numberCodes: string[] = [];

        for (let num: number = 0; num <= 9; num++) {
            numberCodes.push(this.toUnicode(num.toString()));
        }

        if (IntlAPI.hasNumberFormat()) {
            for (let num: number = 0; num <= 9; num++) {
                numberCodes[num] = this.toUnicode(this.locale.formatDecimal(num, '1.0-0', defaultLocale));
            }
        }
        return numberCodes;
    }

    private toChar(pattern: string): string {
        return pattern.replace(/\\u[\dA-F]{4}/gi, (match: string) => {
            return String.fromCharCode(parseInt(match.replace(/\\u/g, ""), 16));
        });
    }

    private toUnicode(c: string): string {
        return "\\u" + this.toHex(c.charCodeAt(0));
    }

    private toHex(value: number): string {
        let hex: string = value.toString(16).toUpperCase();
        // With padding.
        hex = "0000".substr(0, 4 - hex.length) + hex;
        return hex;
    }

}
