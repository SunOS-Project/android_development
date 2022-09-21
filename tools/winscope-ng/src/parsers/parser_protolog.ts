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
import {FormattedLogMessage, LogMessage, UnformattedLogMessage} from "common/trace/protolog";
import {Timestamp, TimestampType} from "common/trace/timestamp";
import {TraceType} from "common/trace/trace_type";
import {Parser} from "./parser";
import {ProtoLogFileProto} from "./proto_types";
import configJson from "../../../../../frameworks/base/data/etc/services.core.protolog.json";

class ParserProtoLog extends Parser {
  constructor(trace: Blob) {
    super(trace);
  }

  override getTraceType(): TraceType {
    return TraceType.PROTO_LOG;
  }

  override getMagicNumber(): number[] {
    return ParserProtoLog.MAGIC_NUMBER;
  }

  override decodeTrace(buffer: Uint8Array): any[] {
    const fileProto: any = ProtoLogFileProto.decode(buffer);

    if (fileProto.version !== ParserProtoLog.PROTOLOG_VERSION) {
      const message = "Unsupported ProtoLog trace version";
      console.log(message);
      throw new TypeError(message);
    }

    if (configJson.version !== ParserProtoLog.PROTOLOG_VERSION) {
      const message = "Unsupported ProtoLog JSON config version";
      console.log(message);
      throw new TypeError(message);
    }

    this.realToElapsedTimeOffsetNs = BigInt(fileProto.realTimeToElapsedTimeOffsetMillis) * 1000000n;

    fileProto.log.sort((a: any, b: any) => {
      return Number(a.elapsedRealtimeNanos) - Number(b.elapsedRealtimeNanos);
    });

    return fileProto.log;
  }

  override getTimestamp(type: TimestampType, entryProto: any): undefined|Timestamp {
    if (type == TimestampType.ELAPSED) {
      return new Timestamp(type, BigInt(entryProto.elapsedRealtimeNanos));
    }
    else if (type == TimestampType.REAL) {
      return new Timestamp(type, BigInt(entryProto.elapsedRealtimeNanos) + this.realToElapsedTimeOffsetNs!);
    }
    return undefined;
  }

  override processDecodedEntry(entryProto: any): LogMessage {
    const message = (<any>configJson).messages[entryProto.messageHash];
    if (!message) {
      return new FormattedLogMessage(entryProto);
    }

    try {
      return new UnformattedLogMessage(entryProto, message);
    }
    catch (error) {
      if (error instanceof FormatStringMismatchError) {
        return new FormattedLogMessage(entryProto);
      }
      throw error;
    }
  }

  override getTraceEntries(): LogMessage[] {
    return this.decodedEntries.map((entryProto: any) => {
      return this.processDecodedEntry(entryProto);
    });
  }

  private realToElapsedTimeOffsetNs: undefined|bigint = undefined;
  private static readonly MAGIC_NUMBER = [0x09, 0x50, 0x52, 0x4f, 0x54, 0x4f, 0x4c, 0x4f, 0x47]; // .PROTOLOG
  private static readonly PROTOLOG_VERSION = "1.0.0";
}

class FormatStringMismatchError extends Error {
  constructor(message: string) {
    super(message);
  }
}

export {ParserProtoLog};
