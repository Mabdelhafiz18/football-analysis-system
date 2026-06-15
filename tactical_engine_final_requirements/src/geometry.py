import math


def distance(a, b):
    return math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2)


def clamp(value, low, high):
    return max(low, min(high, value))


def mean(values):
    values = list(values)
    if not values:
        return 0.0
    return sum(values) / len(values)
