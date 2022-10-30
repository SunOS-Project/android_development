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
import {Timestamp, TimestampType} from "common/trace/timestamp";
import {TraceType} from "common/trace/trace_type";
import {Parser} from "./parser";
import {AccessibilityTraceFileProto, TransactionsTraceFileProto} from "./proto_types";

class ParserTransactions extends Parser {
  constructor(trace: File) {
    super(trace);
    this.realToElapsedTimeOffsetNs = undefined;
  }

  override getTraceType(): TraceType {
    return TraceType.TRANSACTIONS;
  }

  override getMagicNumber(): number[] {
    return ParserTransactions.MAGIC_NUMBER;
  }

  override decodeTrace(buffer: Uint8Array): any[] {
    const decoded = <any>TransactionsTraceFileProto.decode(buffer);
    if (Object.prototype.hasOwnProperty.call(decoded, "realToElapsedTimeOffsetNanos")) {
      this.realToElapsedTimeOffsetNs = BigInt(decoded.realToElapsedTimeOffsetNanos);
    }
    else {
      this.realToElapsedTimeOffsetNs = undefined;
    }
    return decoded.entry;
  }

  override getTimestamp(type: TimestampType, entryProto: any): undefined|Timestamp {
    if (type === TimestampType.ELAPSED) {
      return new Timestamp(type, BigInt(entryProto.elapsedRealtimeNanos));
    }
    else if (type === TimestampType.REAL && this.realToElapsedTimeOffsetNs !== undefined) {
      return new Timestamp(type, this.realToElapsedTimeOffsetNs + BigInt(entryProto.elapsedRealtimeNanos));
    }
    return undefined;
  }

  override processDecodedEntry(index: number, entryProto: any): any {
    return entryProto;
  }

  private realToElapsedTimeOffsetNs: undefined|bigint;
  private static readonly MAGIC_NUMBER = [0x09, 0x54, 0x4e, 0x58, 0x54, 0x52, 0x41, 0x43, 0x45]; // .TNXTRACE
}

export {ParserTransactions};
