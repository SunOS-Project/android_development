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

import {ArrayUtils} from 'common/array_utils';
import {Timestamp, TimestampType} from 'trace/timestamp';
import {Trace, TraceFile} from 'trace/trace';
import {TraceType} from 'trace/trace_type';

abstract class Parser {
  protected trace: TraceFile;
  protected decodedEntries: any[] = [];
  private timestamps: Map<TimestampType, Timestamp[]> = new Map<TimestampType, Timestamp[]>();

  protected constructor(trace: TraceFile) {
    this.trace = trace;
  }

  async parse() {
    const traceBuffer = new Uint8Array(await this.trace.file.arrayBuffer());

    const magicNumber = this.getMagicNumber();
    if (magicNumber !== undefined) {
      const bufferContainsMagicNumber = ArrayUtils.equal(
        magicNumber,
        traceBuffer.slice(0, magicNumber.length)
      );
      if (!bufferContainsMagicNumber) {
        throw TypeError("buffer doesn't contain expected magic number");
      }
    }

    this.decodedEntries = this.decodeTrace(traceBuffer).map((it) => this.addDefaultProtoFields(it));

    for (const type of [TimestampType.ELAPSED, TimestampType.REAL]) {
      const timestamps: Timestamp[] = [];
      let areTimestampsValid = true;

      for (const entry of this.decodedEntries) {
        const timestamp = this.getTimestamp(type, entry);
        if (timestamp === undefined) {
          areTimestampsValid = false;
          break;
        }
        timestamps.push(timestamp);
      }

      if (areTimestampsValid) {
        this.timestamps.set(type, timestamps);
      }
    }
  }

  // Add default values to the proto objects.
  private addDefaultProtoFields(protoObj: any): any {
    if (!protoObj || protoObj !== Object(protoObj) || !protoObj.$type) {
      return protoObj;
    }

    for (const fieldName in protoObj.$type.fields) {
      if (Object.prototype.hasOwnProperty.call(protoObj.$type.fields, fieldName)) {
        const fieldProperties = protoObj.$type.fields[fieldName];
        const field = protoObj[fieldName];

        if (Array.isArray(field)) {
          field.forEach((item, _) => {
            this.addDefaultProtoFields(item);
          });
          continue;
        }

        if (!field) {
          protoObj[fieldName] = fieldProperties.defaultValue;
        }

        if (fieldProperties.resolvedType && fieldProperties.resolvedType.valuesById) {
          protoObj[fieldName] =
            fieldProperties.resolvedType.valuesById[protoObj[fieldProperties.name]];
          continue;
        }
        this.addDefaultProtoFields(protoObj[fieldName]);
      }
    }

    return protoObj;
  }

  abstract getTraceType(): TraceType;

  getTrace(): Trace {
    return {
      type: this.getTraceType(),
      traceFile: this.trace,
    };
  }

  getTimestamps(type: TimestampType): undefined | Timestamp[] {
    return this.timestamps.get(type);
  }

  //TODO (b/256564627): include this into the new type/abstraction passed to viewers
  getEntriesLength(): number {
    return this.decodedEntries.length;
  }

  //TODO (b/256564627):
  // - factor out timestamp search policy. Receive index parameter instead.
  // - make async for possible lazy disk reads in the future
  getTraceEntry(timestamp: Timestamp): undefined | any {
    const timestamps = this.getTimestamps(timestamp.getType());
    if (timestamps === undefined) {
      throw TypeError(`Timestamps with type "${timestamp.getType()}" not available`);
    }

    const index = ArrayUtils.binarySearchLowerOrEqual(timestamps, timestamp);
    if (index === undefined) {
      return undefined;
    }
    return this.processDecodedEntry(index, timestamp.getType(), this.decodedEntries[index]);
  }

  protected abstract getMagicNumber(): undefined | number[];
  protected abstract decodeTrace(trace: Uint8Array): any[];
  protected abstract getTimestamp(type: TimestampType, decodedEntry: any): undefined | Timestamp;
  protected abstract processDecodedEntry(
    index: number,
    timestampType: TimestampType,
    decodedEntry: any
  ): any;
}

export {Parser};
