#!/usr/bin/env python3
"""Turn a key exported from Teacher mode into the pins.js the site ships.

    python3 tools/key-to-pins.py ~/Downloads/bio40b-spelling-drill-pins.json

Writes pins.js in the repo root. Commit it and the new pin positions become
the answer key every visitor sees. Refuses to write a key that has lost
stations or pins relative to the one already committed, since the usual way
that happens is exporting from a browser whose storage was half wiped.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load_current():
    path = os.path.join(ROOT, 'pins.js')
    if not os.path.exists(path):
        return {}
    src = open(path, encoding='utf-8').read()
    m = re.search(r'const DRILL_KEYS = (\{.*\});\s*$', src, re.S)
    return json.loads(m.group(1)) if m else {}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)

    payload = json.load(open(sys.argv[1], encoding='utf-8'))
    keys = payload.get('keys', payload)
    if not isinstance(keys, dict) or not keys:
        sys.exit('No pin key found in that file.')

    for station, pins in keys.items():
        if not isinstance(pins, list) or not pins:
            sys.exit('Station %s has no pins.' % station)
        for i, pin in enumerate(pins):
            for field in ('word', 'x', 'y'):
                if field not in pin:
                    sys.exit('%s pin %d is missing "%s".' % (station, i, field))
            if not (0 <= float(pin['x']) <= 100 and 0 <= float(pin['y']) <= 100):
                sys.exit('%s pin %d sits off the image.' % (station, i))

    new_pins = sum(len(v) for v in keys.values())
    current = load_current()
    old_pins = sum(len(v) for v in current.values())
    if current and (len(keys) < len(current) or new_pins < old_pins):
        sys.exit('Refusing to shrink the key: %d stations/%d pins -> %d/%d.\n'
                 'Re-export from a browser holding the full key, or delete pins.js '
                 'first if the loss is deliberate.'
                 % (len(current), old_pins, len(keys), new_pins))

    header = open(os.path.join(ROOT, 'pins.js'), encoding='utf-8').read().split('const DRILL_KEYS')[0] \
        if current else ''
    body = json.dumps(keys, indent=2, ensure_ascii=False)
    open(os.path.join(ROOT, 'pins.js'), 'w', encoding='utf-8').write(
        '%sconst DRILL_KEYS = %s;\n' % (header, body))

    moved = sum(1 for st, pins in keys.items()
                for i, p in enumerate(pins)
                if st in current and i < len(current[st])
                and (float(p['x']) != float(current[st][i]['x'])
                     or float(p['y']) != float(current[st][i]['y'])))
    print('pins.js written: %d stations, %d pins, %d moved' % (len(keys), new_pins, moved))


if __name__ == '__main__':
    main()
