import { parsePLN } from '@wycenka/core';

/** A typed price that is not empty and cannot be parsed (e.g. „4,555” or „abc”). */
export const isInvalidPrice = (text: string) => text.trim() !== '' && parsePLN(text) === null;
