"""XXH64 text-key aliases, independent of optional third-party packages."""
import struct
import re

MASK = (1 << 64) - 1
P1, P2, P3, P4, P5 = 11400714785074694791, 14029467366897019727, 1609587929392839161, 9650029242287828579, 2870177450012600261


def _rotate(value, bits):
    return ((value << bits) | (value >> (64 - bits))) & MASK


def _round(accumulator, value):
    return (_rotate((accumulator + value * P2) & MASK, 31) * P1) & MASK


def text_key(value):
    data = value.encode('utf-8')
    length, offset = len(data), 0
    if length >= 32:
        accumulators = [(P1 + P2) & MASK, P2, 0, (-P1) & MASK]
        while offset <= length - 32:
            for index in range(4):
                accumulators[index] = _round(accumulators[index], struct.unpack_from('<Q', data, offset)[0])
                offset += 8
        result = sum(_rotate(value, bits) for value, bits in zip(accumulators, (1, 7, 12, 18))) & MASK
        for accumulator in accumulators:
            result = ((result ^ _round(0, accumulator)) * P1 + P4) & MASK
    else:
        result = P5
    result = (result + length) & MASK
    while offset <= length - 8:
        result ^= _round(0, struct.unpack_from('<Q', data, offset)[0])
        result = (_rotate(result, 27) * P1 + P4) & MASK
        offset += 8
    if offset <= length - 4:
        result ^= struct.unpack_from('<I', data, offset)[0] * P1 & MASK
        result = (_rotate(result, 23) * P2 + P3) & MASK
        offset += 4
    while offset < length:
        result ^= data[offset] * P5 & MASK
        result = _rotate(result, 11) * P1 & MASK
        offset += 1
    result ^= result >> 33
    result = result * P2 & MASK
    result ^= result >> 29
    result = result * P3 & MASK
    result ^= result >> 32
    return str(result)


def resolve_named_references(value, known_keys, cache):
    """Turn verified string aliases into the same references used by raw Hash fields."""
    if isinstance(value, dict):
        return {key: resolve_named_references(item, known_keys, cache) for key, item in value.items()}
    if isinstance(value, list):
        return [resolve_named_references(item, known_keys, cache) for item in value]
    if isinstance(value, str) and '_' in value and re.fullmatch(r'[A-Za-z][A-Za-z0-9_]*', value):
        if value not in cache:
            candidate = text_key(value)
            cache[value] = candidate if candidate in known_keys else None
        if cache[value]:
            return {'Hash': cache[value]}
    return value
