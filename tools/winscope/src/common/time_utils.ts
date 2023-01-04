/*
 * Copyright (C) 2022 The Android Open Source Project
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {ElapsedTimestamp, RealTimestamp, Timestamp, TimestampType} from 'trace/timestamp';

export class TimeUtils {
  static compareFn(a: Timestamp, b: Timestamp): number {
    if (a.getType() !== b.getType()) {
      throw new Error('Attempted to compare two timestamps with different type');
    }
    return Number(a.getValueNs() - b.getValueNs());
  }

  static format(timestamp: Timestamp, hideNs = false): string {
    switch (timestamp.getType()) {
      case TimestampType.ELAPSED: {
        return TimeUtils.nanosecondsToHumanElapsed(timestamp.getValueNs(), hideNs);
      }
      case TimestampType.REAL: {
        return TimeUtils.nanosecondsToHumanReal(timestamp.getValueNs(), hideNs);
      }
      default: {
        throw Error('Unhandled timestamp type');
      }
    }
  }

  private static nanosecondsToHumanElapsed(timestampNanos: number | bigint, hideNs = true): string {
    timestampNanos = BigInt(timestampNanos);
    const units = TimeUtils.units;

    let leftNanos = timestampNanos;
    const parts = units
      .slice()
      .reverse()
      .map(({nanosInUnit, unit}) => {
        let amountOfUnit = BigInt(0);
        if (leftNanos >= nanosInUnit) {
          amountOfUnit = leftNanos / BigInt(nanosInUnit);
        }
        leftNanos = leftNanos % BigInt(nanosInUnit);
        return `${amountOfUnit}${unit}`;
      });

    if (hideNs) {
      parts.pop();
    }

    // Remove all 0ed units at start
    while (parts.length > 1 && parseInt(parts[0]) === 0) {
      parts.shift();
    }

    return parts.join('');
  }

  private static nanosecondsToHumanReal(timestampNanos: number | bigint, hideNs = true): string {
    timestampNanos = BigInt(timestampNanos);
    const ms = timestampNanos / 1000000n;
    const extraNanos = timestampNanos % 1000000n;
    const formattedTimestamp = new Date(Number(ms)).toISOString().replace('Z', '');

    if (hideNs) {
      return formattedTimestamp;
    } else {
      return `${formattedTimestamp}${extraNanos.toString().padStart(6, '0')}`;
    }
  }

  static parseHumanElapsed(timestampHuman: string): Timestamp {
    if (!TimeUtils.HUMAN_ELAPSED_TIMESTAMP_REGEX.test(timestampHuman)) {
      throw Error('Invalid elapsed timestamp format');
    }

    const units = TimeUtils.units;

    const usedUnits = timestampHuman.split(/[0-9]+/).filter((it) => it !== '');
    const usedValues = timestampHuman
      .split(/[a-z]+/)
      .filter((it) => it !== '')
      .map((it) => parseInt(it));

    let ns = BigInt(0);

    for (let i = 0; i < usedUnits.length; i++) {
      const unit = usedUnits[i];
      const value = usedValues[i];
      const unitData = units.find((it) => it.unit == unit)!;
      ns += BigInt(unitData.nanosInUnit) * BigInt(value);
    }

    return new ElapsedTimestamp(ns);
  }

  static parseHumanReal(timestampHuman: string): Timestamp {
    if (!TimeUtils.HUMAN_REAL_TIMESTAMP_REGEX.test(timestampHuman)) {
      throw Error('Invalid real timestamp format');
    }

    // Add trailing Z if it isn't there yet
    if (timestampHuman[timestampHuman.length - 1] != 'Z') {
      timestampHuman += 'Z';
    }

    // Date.parse only considers up to millisecond precision
    let nanoSeconds = 0;
    if (timestampHuman.includes('.')) {
      const milliseconds = timestampHuman.split('.')[1].replace('Z', '');
      nanoSeconds = parseInt(milliseconds.padEnd(9, '0').slice(3));
    }

    return new RealTimestamp(
      BigInt(Date.parse(timestampHuman)) * BigInt(TimeUtils.TO_NANO['ms']) + BigInt(nanoSeconds)
    );
  }

  static TO_NANO = {
    ns: 1,
    ms: 1000000,
    s: 1000000 * 1000,
    m: 1000000 * 1000 * 60,
    h: 1000000 * 1000 * 60 * 60,
    d: 1000000 * 1000 * 60 * 60 * 24,
  };

  static units = [
    {nanosInUnit: TimeUtils.TO_NANO['ns'], unit: 'ns'},
    {nanosInUnit: TimeUtils.TO_NANO['ms'], unit: 'ms'},
    {nanosInUnit: TimeUtils.TO_NANO['s'], unit: 's'},
    {nanosInUnit: TimeUtils.TO_NANO['m'], unit: 'm'},
    {nanosInUnit: TimeUtils.TO_NANO['h'], unit: 'h'},
    {nanosInUnit: TimeUtils.TO_NANO['d'], unit: 'd'},
  ];

  // (?=.) checks there is at least one character with a lookahead match
  static readonly HUMAN_ELAPSED_TIMESTAMP_REGEX =
    /^(?=.)([0-9]+d)?([0-9]+h)?([0-9]+m)?([0-9]+s)?([0-9]+ms)?([0-9]+ns)?$/;
  static readonly HUMAN_REAL_TIMESTAMP_REGEX =
    /^[0-9]{4}-((0[13578]|1[02])-(0[1-9]|[12][0-9]|3[01])|(0[469]|11)-(0[1-9]|[12][0-9]|30)|(02)-(0[1-9]|[12][0-9]))T(0[0-9]|1[0-9]|2[0-3]):(0[0-9]|[1-5][0-9]):(0[0-9]|[1-5][0-9])\.[0-9]{3}([0-9]{6})?Z?$/;
  static readonly NS_TIMESTAMP_REGEX = /^\s*[0-9]+(\s?ns)?\s*$/;
}
